//! Phase B2 staging: atomic multi-zone simulation container.
//!
//! Deliberately unused by the current WebTransport handler. The live server
//! still has a single legacy World until protocol, replication, and client
//! reconciliation are explicitly wired and regression-tested.
use crate::simulation::{CombatEvent, Fighter, InputIntent, World};
use crate::zone::{PortalId, Position, ZoneAuthority, ZoneError, ZoneId, ZoneTransfer};

#[derive(Debug)]
pub struct ZoneWorlds {
    overworld: World,
    tavern: World,
    members: ZoneAuthority,
    server_tick: u32,
}

impl Default for ZoneWorlds {
    fn default() -> Self {
        Self::new()
    }
}

impl ZoneWorlds {
    pub fn new() -> Self {
        Self {
            overworld: World::default(),
            tavern: World::new(780.0, 620.0),
            members: ZoneAuthority::new(),
            server_tick: 0,
        }
    }

    pub fn server_tick(&self) -> u32 {
        self.server_tick
    }

    pub fn world(&self, zone: ZoneId) -> &World {
        match zone {
            ZoneId::Moonvale => &self.overworld,
            ZoneId::RedLionInn => &self.tavern,
        }
    }

    fn world_mut(&mut self, zone: ZoneId) -> &mut World {
        match zone {
            ZoneId::Moonvale => &mut self.overworld,
            ZoneId::RedLionInn => &mut self.tavern,
        }
    }

    pub fn zone_of(&self, authenticated_net_id: u32) -> Option<ZoneId> {
        self.members.zone_of(authenticated_net_id)
    }

    /// Admission is invoked only with the identity allocated by the server,
    /// never with an identity or position supplied by an untrusted client.
    pub fn admit_overworld(&mut self, net_id: u32, arrival: Position) -> Result<(), ZoneError> {
        if net_id == 0
            || !arrival.x.is_finite()
            || !arrival.y.is_finite()
            || !(18.0..=8174.0).contains(&arrival.x)
            || !(18.0..=8174.0).contains(&arrival.y)
        {
            return Err(ZoneError::InvalidPosition);
        }
        // Stage both changes before mutating persistent world membership.
        let mut registry = self.members.clone();
        registry.register(net_id)?;
        let mut world = self.overworld.clone();
        if !world.add_player_at(net_id, arrival.x, arrival.y, 0.0) {
            return Err(ZoneError::TransferConflict);
        }
        self.members = registry;
        self.overworld = world;
        Ok(())
    }

    pub fn disconnect(&mut self, net_id: u32) -> bool {
        let Some(zone) = self.members.zone_of(net_id) else {
            return false;
        };
        // The registry is authoritative and never leaves a ghost on disconnect.
        let removed = self.world_mut(zone).remove_player(net_id);
        assert!(removed, "registered fighter must exist in their zone world");
        self.members.unregister(net_id)
    }

    pub fn same_zone(&self, first: u32, second: u32) -> bool {
        self.members.same_zone(first, second)
    }

    /// Downstream snapshot construction must operate exclusively on this
    /// slice, never on a cross-zone global collection of fighter entities.
    pub fn visible_fighters(&self, viewer: u32) -> Option<&[Fighter]> {
        self.members
            .zone_of(viewer)
            .map(|zone| self.world(zone).fighters())
    }

    pub fn set_input(&mut self, authenticated_net_id: u32, input: InputIntent) -> bool {
        let Some(zone) = self.members.zone_of(authenticated_net_id) else {
            return false;
        };
        self.world_mut(zone).set_input(authenticated_net_id, input)
    }

    /// Each zone resolves movement/collisions/combat independently. A sword in
    /// one zone has no fighter in the other world's hit candidate set.
    pub fn step(&mut self) -> (Vec<CombatEvent>, Vec<CombatEvent>) {
        self.server_tick = self.server_tick.wrapping_add(1);
        (self.overworld.step(), self.tavern.step())
    }

    /// Atomic in-memory membership + entity migration.
    /// No caller may reach this path from the old wire protocol in Phase B2.
    pub fn enter_portal(
        &mut self,
        authenticated_net_id: u32,
        portal_id: PortalId,
        request_nonce: u32,
    ) -> Result<ZoneTransfer, ZoneError> {
        let from = self
            .members
            .zone_of(authenticated_net_id)
            .ok_or(ZoneError::UnknownFighter)?;
        let source_world = self.world(from);
        let authoritative = source_world
            .fighter(authenticated_net_id)
            .ok_or(ZoneError::UnknownFighter)?
            .clone();
        let source_now_ms = source_world.now_ms;

        // The zone registry's current authorize() mutates the registry. Work
        // on a staged clone so denial or destination failure cannot partially
        // move a real fighter or commit the nonce/cooldown.
        let mut registry_next = self.members.clone();
        let transfer = registry_next.authorize(
            authenticated_net_id,
            portal_id,
            request_nonce,
            self.server_tick,
            &authoritative,
        )?;

        let mut previous_world = source_world.clone();
        let mut destination_world = self.world(transfer.to).clone();
        if destination_world.fighter(authenticated_net_id).is_some() {
            return Err(ZoneError::TransferConflict);
        }
        if !previous_world.remove_player(authenticated_net_id)
            || !destination_world.add_transferred_player(
                &authoritative,
                source_now_ms,
                transfer.arrival.x,
                transfer.arrival.y,
            )
        {
            return Err(ZoneError::TransferConflict);
        }

        // One commit boundary: no observer can see the registry while only
        // one of the two Zone Worlds is updated.
        match (from, transfer.to) {
            (ZoneId::Moonvale, ZoneId::RedLionInn) => {
                self.overworld = previous_world;
                self.tavern = destination_world;
            }
            (ZoneId::RedLionInn, ZoneId::Moonvale) => {
                self.tavern = previous_world;
                self.overworld = destination_world;
            }
            _ => return Err(ZoneError::TransferConflict),
        }
        self.members = registry_next;
        Ok(transfer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::Action;

    fn door() -> Position {
        Position {
            x: 4365.0,
            y: 4075.0,
        }
    }

    #[test]
    fn two_players_share_one_public_tavern_while_outsider_has_no_visibility() {
        let mut world = ZoneWorlds::new();
        world.admit_overworld(1, door()).unwrap();
        world.admit_overworld(2, door()).unwrap();
        world
            .admit_overworld(3, Position { x: 390.0, y: 480.0 })
            .unwrap();
        assert_eq!(world.visible_fighters(1).unwrap().len(), 3);

        let first = world.enter_portal(1, PortalId::RedLionEnter, 1).unwrap();
        let second = world.enter_portal(2, PortalId::RedLionEnter, 2).unwrap();
        assert_eq!(first.to, ZoneId::RedLionInn);
        assert_eq!(second.to, first.to);
        assert!(world.same_zone(1, 2));
        assert!(!world.same_zone(1, 3));
        let interior = world.visible_fighters(1).unwrap();
        assert_eq!(interior.len(), 2);
        assert!(interior
            .iter()
            .all(|player| player.net_id == 1 || player.net_id == 2));
        assert_eq!(world.visible_fighters(3).unwrap().len(), 1);
        assert_eq!(world.world(ZoneId::Moonvale).fighter(1), None);
        assert!(world.world(ZoneId::RedLionInn).fighter(1).is_some());
    }

    #[test]
    fn rejected_requests_never_mutate_nonce_membership_or_player_position() {
        let mut zones = ZoneWorlds::new();
        zones.admit_overworld(1, door()).unwrap();
        let before = zones.world(ZoneId::Moonvale).fighter(1).unwrap().clone();
        assert_eq!(
            zones.enter_portal(1, PortalId::RedLionExit, 4),
            Err(ZoneError::WrongSource)
        );
        assert_eq!(zones.zone_of(1), Some(ZoneId::Moonvale));
        assert_eq!(*zones.world(ZoneId::Moonvale).fighter(1).unwrap(), before);
        zones.enter_portal(1, PortalId::RedLionEnter, 4).unwrap();
        assert_eq!(
            zones.enter_portal(1, PortalId::RedLionExit, 4),
            Err(ZoneError::StaleRequest)
        );
        assert_eq!(zones.zone_of(1), Some(ZoneId::RedLionInn));
        assert_eq!(zones.world(ZoneId::Moonvale).fighter(1), None);
    }

    #[test]
    fn short_cooldown_and_roundtrip_keep_one_fighter_in_exactly_one_zone() {
        let mut zones = ZoneWorlds::new();
        zones.admit_overworld(1, door()).unwrap();
        zones.enter_portal(1, PortalId::RedLionEnter, 1).unwrap();
        let interior = zones.world(ZoneId::RedLionInn).fighter(1).unwrap();
        assert_eq!((interior.x, interior.y), (390.0, 480.0));
        for _ in 0..120 {
            zones.step();
        }
        // Door radius 42 + reach 16; move toward interior door via inputs.
        for _ in 0..20 {
            zones.set_input(
                1,
                InputIntent {
                    move_y: 1.0,
                    facing_radians: std::f32::consts::FRAC_PI_2,
                    ..InputIntent::default()
                },
            );
            zones.step();
        }
        zones.set_input(1, InputIntent::default());
        let player = zones.world(ZoneId::RedLionInn).fighter(1).unwrap();
        assert!(player.y > 505.0 && player.action == Action::Idle);
        let out = zones.enter_portal(1, PortalId::RedLionExit, 2).unwrap();
        assert_eq!(out.to, ZoneId::Moonvale);
        assert_eq!(zones.visible_fighters(1).unwrap().len(), 1);
        assert_eq!(zones.world(ZoneId::RedLionInn).fighter(1), None);
        let returned = zones.world(ZoneId::Moonvale).fighter(1).unwrap();
        assert_eq!((returned.x, returned.y), (4365.0, 4143.0));
    }

    #[test]
    fn combat_and_replication_never_consider_fighters_in_other_zone() {
        let mut zones = ZoneWorlds::new();
        zones.admit_overworld(1, door()).unwrap();
        zones
            .admit_overworld(2, Position { x: 390.0, y: 480.0 })
            .unwrap();
        zones.enter_portal(1, PortalId::RedLionEnter, 1).unwrap();
        assert!(!zones.same_zone(1, 2));
        let hp_before = zones.world(ZoneId::Moonvale).fighter(2).unwrap().hp;
        zones.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            },
        );
        for _ in 0..24 {
            zones.step();
        }
        assert_eq!(
            zones.world(ZoneId::Moonvale).fighter(2).unwrap().hp,
            hp_before
        );
        assert_eq!(zones.visible_fighters(1).unwrap().len(), 1);
        assert_eq!(zones.visible_fighters(2).unwrap().len(), 1);
    }

    #[test]
    fn preserved_vitals_no_heal_and_action_edges_reset_across_portal() {
        let mut zones = ZoneWorlds::new();
        zones.admit_overworld(1, door()).unwrap();
        let from = zones.world(ZoneId::Moonvale).fighter(1).unwrap().clone();
        let mut wounded = from.clone();
        wounded.hp = 49.0;
        wounded.guard = 24.0;
        wounded.stamina = 33.0;
        let mut destination = World::new(780.0, 620.0);
        assert!(destination.add_transferred_player(&wounded, 0.0, 390.0, 480.0));
        let after = destination.fighter(1).unwrap();
        assert_eq!((after.hp, after.guard, after.stamina), (49.0, 24.0, 33.0));
        assert_eq!(after.action, Action::Idle);
        assert_eq!(after.input(), InputIntent::default());
        assert_eq!(after.kills, 0);
    }

    #[test]
    fn duplicate_or_invalid_admission_fails_closed() {
        let mut zones = ZoneWorlds::new();
        assert_eq!(
            zones.admit_overworld(0, door()),
            Err(ZoneError::InvalidPosition)
        );
        assert_eq!(
            zones.admit_overworld(
                9,
                Position {
                    x: f32::NAN,
                    y: 100.0
                }
            ),
            Err(ZoneError::InvalidPosition)
        );
        zones.admit_overworld(1, door()).unwrap();
        assert_eq!(
            zones.admit_overworld(1, door()),
            Err(ZoneError::DuplicateFighter)
        );
        assert!(!zones.disconnect(1000));
        assert!(zones.disconnect(1));
        assert!(zones.zone_of(1).is_none());
        assert!(zones.visible_fighters(1).is_none());
    }
}
