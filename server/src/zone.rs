//! Phase B1: fail-closed, server-owned shared zone and doorway authority.
//!
//! This module is intentionally NOT wired into the existing WebTransport
//! handler, snapshots, or combat simulation. Until all those paths are zone-
//! scoped, enabling real transfers would leak entity state and cross-zone hits.
//! Never trust a client-specified destination map or arrival coordinate.

use std::collections::BTreeMap;

use crate::simulation::{Action, Fighter};

pub const MAP_MANIFEST_VERSION: u16 = 1;
pub const PORTAL_COOLDOWN_TICKS: u32 = 120; // Two seconds at 60Hz.
pub const PORTAL_REACH: f32 = 16.0; // Server permits 16 units of edge reach.
pub const MAX_FIGHTERS_PER_ZONE: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ZoneId {
    Moonvale,
    RedLionInn,
}

impl ZoneId {
    pub const fn manifest_id(self) -> &'static str {
        match self {
            Self::Moonvale => "moonvale-overworld",
            Self::RedLionInn => "red-lion-inn",
        }
    }

    pub const fn bounds(self) -> (f32, f32) {
        match self {
            Self::Moonvale => (8192.0, 8192.0),
            Self::RedLionInn => (780.0, 620.0),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PortalId {
    RedLionEnter,
    RedLionExit,
}

impl PortalId {
    pub const fn manifest_id(self) -> &'static str {
        match self {
            Self::RedLionEnter => "red-lion-enter",
            Self::RedLionExit => "red-lion-exit",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

impl Position {
    fn valid_for(self, zone: ZoneId) -> bool {
        let (width, height) = zone.bounds();
        self.x.is_finite()
            && self.y.is_finite()
            && self.x >= 18.0
            && self.y >= 18.0
            && self.x <= width - 18.0
            && self.y <= height - 18.0
    }
}

#[derive(Debug, Clone, Copy)]
struct Portal {
    id: PortalId,
    source: ZoneId,
    at: Position,
    radius: f32,
    target: ZoneId,
    spawn: Position,
}

const PORTALS: [Portal; 2] = [
    Portal {
        id: PortalId::RedLionEnter,
        source: ZoneId::Moonvale,
        at: Position { x: 4365.0, y: 4075.0 },
        radius: 52.0,
        target: ZoneId::RedLionInn,
        spawn: Position { x: 390.0, y: 480.0 },
    },
    Portal {
        id: PortalId::RedLionExit,
        source: ZoneId::RedLionInn,
        at: Position { x: 390.0, y: 550.0 },
        radius: 42.0,
        target: ZoneId::Moonvale,
        spawn: Position { x: 4365.0, y: 4143.0 },
    },
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoneError {
    UnknownFighter,
    DuplicateFighter,
    WrongSource,
    InvalidPosition,
    TooFarFromDoor,
    CombatLocked,
    TransferCooldown,
    StaleRequest,
    ZoneCapacity,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ZoneTransfer {
    pub fighter: u32,
    pub from: ZoneId,
    pub to: ZoneId,
    pub arrival: Position,
    pub accepted_tick: u32,
    pub request_nonce: u32,
    pub manifest_version: u16,
}

#[derive(Debug, Clone, Copy)]
struct Member {
    zone: ZoneId,
    previous_nonce: Option<u32>,
    last_transfer_tick: Option<u32>,
}

/// Registry is keyed by *authenticated connection's* net ID. Callers must
/// never source fighter IDs, positions or source zones from untrusted packets.
#[derive(Debug, Default)]
pub struct ZoneAuthority {
    members: BTreeMap<u32, Member>,
}

impl ZoneAuthority {
    pub fn new() -> Self {
        Self::default()
    }

    /// Called only after game server admission. Duplicate IDs fail closed.
    pub fn register(&mut self, authenticated_net_id: u32) -> Result<(), ZoneError> {
        if authenticated_net_id == 0 {
            return Err(ZoneError::UnknownFighter);
        }
        if self.members.contains_key(&authenticated_net_id) {
            return Err(ZoneError::DuplicateFighter);
        }
        if self.occupants(ZoneId::Moonvale) >= MAX_FIGHTERS_PER_ZONE {
            return Err(ZoneError::ZoneCapacity);
        }
        self.members.insert(
            authenticated_net_id,
            Member {
                zone: ZoneId::Moonvale,
                previous_nonce: None,
                last_transfer_tick: None,
            },
        );
        Ok(())
    }

    pub fn unregister(&mut self, authenticated_net_id: u32) -> bool {
        self.members.remove(&authenticated_net_id).is_some()
    }

    pub fn zone_of(&self, authenticated_net_id: u32) -> Option<ZoneId> {
        self.members.get(&authenticated_net_id).map(|member| member.zone)
    }

    pub fn occupants(&self, zone: ZoneId) -> usize {
        self.members.values().filter(|member| member.zone == zone).count()
    }

    /// Filter replication visibility and combat candidate sets by both
    /// authenticated fighter IDs; unknown identities are never visible.
    pub fn same_zone(&self, a: u32, b: u32) -> bool {
        match (self.zone_of(a), self.zone_of(b)) {
            (Some(left), Some(right)) => left == right,
            _ => false,
        }
    }

    pub fn peers(&self, viewer: u32) -> impl Iterator<Item = u32> + '_ {
        let zone = self.zone_of(viewer);
        self.members
            .iter()
            .filter(move |(id, member)| **id != viewer && Some(member.zone) == zone && zone.is_some())
            .map(|(id, _)| *id)
    }

    /// Validate against a server-authoritative fighter snapshot and current
    /// server tick. Only portal ID/nonce are request parameters. The caller
    /// owns atomic movement between separate simulations in a later phase.
    /// This function is intentionally unused by live networking in Phase B1.
    pub fn authorize(
        &mut self,
        authenticated_net_id: u32,
        portal_id: PortalId,
        request_nonce: u32,
        authoritative_tick: u32,
        fighter: &Fighter,
    ) -> Result<ZoneTransfer, ZoneError> {
        let member = *self
            .members
            .get(&authenticated_net_id)
            .ok_or(ZoneError::UnknownFighter)?;
        if fighter.net_id != authenticated_net_id {
            return Err(ZoneError::UnknownFighter);
        }
        if member.previous_nonce.is_some_and(|previous| {
            let elapsed = request_nonce.wrapping_sub(previous);
            elapsed == 0 || elapsed >= 0x8000_0000
        }) {
            return Err(ZoneError::StaleRequest);
        }
        if member.last_transfer_tick.is_some_and(|previous| {
            let elapsed = authoritative_tick.wrapping_sub(previous);
            elapsed < PORTAL_COOLDOWN_TICKS || elapsed >= 0x8000_0000
        }) {
            return Err(ZoneError::TransferCooldown);
        }
        // Do not allow doors during any attack/defense/windup/dodge/stun/death.
        // The server may later add a stricter combat-recently-active timer.
        if fighter.action != Action::Idle || fighter.hp <= 0.0 {
            return Err(ZoneError::CombatLocked);
        }
        let at = Position {
            x: fighter.x,
            y: fighter.y,
        };
        if !at.valid_for(member.zone) {
            return Err(ZoneError::InvalidPosition);
        }
        let portal = PORTALS
            .iter()
            .find(|portal| portal.id == portal_id)
            .expect("closed PortalId enum must exist in fixed manifest");
        if portal.source != member.zone {
            return Err(ZoneError::WrongSource);
        }
        if (portal.at.x - at.x).hypot(portal.at.y - at.y)
            > portal.radius + PORTAL_REACH
        {
            return Err(ZoneError::TooFarFromDoor);
        }
        if !portal.spawn.valid_for(portal.target) {
            return Err(ZoneError::InvalidPosition);
        }
        if self.occupants(portal.target) >= MAX_FIGHTERS_PER_ZONE {
            return Err(ZoneError::ZoneCapacity);
        }

        let current = self
            .members
            .get_mut(&authenticated_net_id)
            .expect("membership checked above");
        current.zone = portal.target;
        current.previous_nonce = Some(request_nonce);
        current.last_transfer_tick = Some(authoritative_tick);
        Ok(ZoneTransfer {
            fighter: authenticated_net_id,
            from: portal.source,
            to: portal.target,
            arrival: portal.spawn,
            accepted_tick: authoritative_tick,
            request_nonce,
            manifest_version: MAP_MANIFEST_VERSION,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::World;

    fn fighter(net_id: u32, x: f32, y: f32) -> Fighter {
        let mut world = World::default();
        assert!(world.add_player_at(net_id, x, y, 0.0));
        world.fighter(net_id).unwrap().clone()
    }

    #[test]
    fn constant_ids_match_authored_client_manifest() {
        assert_eq!(ZoneId::Moonvale.manifest_id(), "moonvale-overworld");
        assert_eq!(ZoneId::RedLionInn.manifest_id(), "red-lion-inn");
        assert_eq!(PortalId::RedLionEnter.manifest_id(), "red-lion-enter");
        assert_eq!(PortalId::RedLionExit.manifest_id(), "red-lion-exit");
        assert_eq!(ZoneId::RedLionInn.bounds(), (780.0, 620.0));
        assert_eq!(MAP_MANIFEST_VERSION, 1);
        assert_eq!(PORTAL_COOLDOWN_TICKS, 120);
    }

    #[test]
    fn shared_public_interior_and_isolated_outdoor_players() {
        let mut zones = ZoneAuthority::new();
        for id in [1, 2, 3] {
            zones.register(id).unwrap();
        }
        assert!(zones.same_zone(1, 2));
        assert!(!zones.same_zone(1, 99));
        assert_eq!(zones.register(1), Err(ZoneError::DuplicateFighter));

        let a = zones
            .authorize(1, PortalId::RedLionEnter, 1, 1000, &fighter(1, 4365.0, 4075.0))
            .unwrap();
        let b = zones
            .authorize(2, PortalId::RedLionEnter, 6, 1000, &fighter(2, 4365.0, 4075.0))
            .unwrap();
        assert_eq!(a.to, ZoneId::RedLionInn);
        assert_eq!(a.arrival, Position { x: 390.0, y: 480.0 });
        assert_eq!(b.to, a.to);
        assert!(zones.same_zone(1, 2));
        assert!(!zones.same_zone(1, 3));
        assert_eq!(zones.peers(1).collect::<Vec<_>>(), vec![2]);
        assert_eq!(zones.occupants(ZoneId::RedLionInn), 2);
        assert_eq!(zones.occupants(ZoneId::Moonvale), 1);

        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 2, 1050, &fighter(1, 390.0, 550.0)),
            Err(ZoneError::TransferCooldown)
        );
        let exit = zones
            .authorize(1, PortalId::RedLionExit, 2, 1120, &fighter(1, 390.0, 550.0))
            .unwrap();
        assert_eq!(exit.to, ZoneId::Moonvale);
        assert_eq!(exit.arrival, Position { x: 4365.0, y: 4143.0 });
        assert!(zones.same_zone(1, 3));
        assert!(!zones.same_zone(1, 2));
        assert!(zones.unregister(2));
        assert!(!zones.same_zone(2, 1));
    }

    #[test]
    fn forged_remote_request_stale_nonce_wrong_door_and_distance_denied() {
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        assert_eq!(
            zones.authorize(1, PortalId::RedLionEnter, 4, 500, &fighter(2, 4365.0, 4075.0)),
            Err(ZoneError::UnknownFighter)
        );
        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 4, 500, &fighter(1, 4365.0, 4075.0)),
            Err(ZoneError::WrongSource)
        );
        assert_eq!(
            zones.authorize(1, PortalId::RedLionEnter, 4, 500, &fighter(1, 4020.0, 4170.0)),
            Err(ZoneError::TooFarFromDoor)
        );
        zones.authorize(1, PortalId::RedLionEnter, 4, 500, &fighter(1, 4365.0, 4075.0)).unwrap();
        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 4, 700, &fighter(1, 390.0, 550.0)),
            Err(ZoneError::StaleRequest)
        );
        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 3, 700, &fighter(1, 390.0, 550.0)),
            Err(ZoneError::StaleRequest)
        );
        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 5, 700, &fighter(1, f32::NAN, 550.0)),
            Err(ZoneError::InvalidPosition)
        );
    }

    #[test]
    fn busy_fighter_denied_and_unknown_never_joins_zone() {
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        assert_eq!(
            zones.authorize(99, PortalId::RedLionEnter, 1, 500, &fighter(99, 4365.0, 4075.0)),
            Err(ZoneError::UnknownFighter)
        );
        let mut busy = fighter(1, 4365.0, 4075.0);
        busy.hp = 0.0;
        assert_eq!(
            zones.authorize(1, PortalId::RedLionEnter, 1, 500, &busy),
            Err(ZoneError::CombatLocked)
        );
        assert_eq!(zones.zone_of(1), Some(ZoneId::Moonvale));
    }

    #[test]
    fn authority_identity_replay_and_cooldown_use_server_tick() {
        let mut zones = ZoneAuthority::new();
        assert_eq!(zones.register(0), Err(ZoneError::UnknownFighter));
        zones.register(1).unwrap();
        let accepted = zones
            .authorize(1, PortalId::RedLionEnter, u32::MAX - 1, 200, &fighter(1, 4365.0, 4075.0))
            .unwrap();
        assert_eq!(accepted.request_nonce, u32::MAX - 1);
        assert_eq!(
            zones.authorize(1, PortalId::RedLionExit, 1, 250, &fighter(1, 390.0, 550.0)),
            Err(ZoneError::TransferCooldown)
        );
        let wrapped = zones
            .authorize(1, PortalId::RedLionExit, 1, 320, &fighter(1, 390.0, 550.0))
            .unwrap();
        assert_eq!(wrapped.from, ZoneId::RedLionInn);
        assert_eq!(wrapped.to, ZoneId::Moonvale);
    }
}
