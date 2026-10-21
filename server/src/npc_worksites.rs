//! LW-1K: five bounded, server-owned *pilot* worksite objects.
//!
//! These are staged NPC micro-world resource anchors, NOT production items,
//! map collision, economic inventory, or interactable player objects. NPC
//! jobs need a scheduled work opportunity AND authenticated server proximity.
//! No client supplied action, coordinate, object id, or entity can authorize work.
use crate::{npc_navigation, npc_routines::NpcRoutines, zone::ZoneId, PROTOCOL_VERSION};

pub const WORKSITE_PACKET_TYPE: u8 = 11;
pub const WORKSITE_STATUS_PACKET_TYPE: u8 = 12;
const INTERACTION_RADIUS: i32 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkSite {
    pub id: u8,
    pub actor: u8,
    pub operation: u8,
    pub x: u16,
    pub y: u16,
}

/// Source/destination placement uses fixed loopback NPC navigation endpoints.
/// Walking NPCs pick up at their outer endpoint on tick phase 600 and deliver
/// at their inner endpoint on phase 1800; Marta forges at her fixed post.
pub const WORKSITES: [WorkSite; 5] = [
    WorkSite {
        id: 1,
        actor: 5,
        operation: 1,
        x: 340,
        y: 255,
    }, // well
    WorkSite {
        id: 2,
        actor: 5,
        operation: 2,
        x: 270,
        y: 220,
    }, // work yard
    WorkSite {
        id: 3,
        actor: 4,
        operation: 3,
        x: 395,
        y: 150,
    }, // depot
    WorkSite {
        id: 4,
        actor: 4,
        operation: 4,
        x: 315,
        y: 110,
    }, // market
    WorkSite {
        id: 5,
        actor: 2,
        operation: 5,
        x: 210,
        y: 65,
    }, // forge
];

/// Future trusted-server object lifecycle; not exposed on any player or
/// browser request route. Pilot worksite positions are fixed and nonphysical.
/// The site-state manifest belongs to Moonvale ONLY, never tavern/interior.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorksiteRevisionError {
    WrongZone,
    InvalidVersion,
    StaleRevision,
}

#[derive(Debug, Clone, Copy)]
pub struct WorksiteAuthority {
    revision: u32,
    active: [bool; WORKSITES.len()],
}

impl Default for WorksiteAuthority {
    fn default() -> Self {
        Self {
            revision: 1,
            active: [true; WORKSITES.len()],
        }
    }
}

impl WorksiteAuthority {
    pub fn revision(&self) -> u32 {
        self.revision
    }

    pub fn active_for(&self, actor: u8, operation: u8) -> bool {
        WORKSITES
            .iter()
            .position(|site| site.actor == actor && site.operation == operation)
            .is_some_and(|index| self.active[index])
    }

    pub fn active_flags(&self) -> [bool; WORKSITES.len()] {
        self.active
    }

    /// Dedicated 12-byte reliable, read-only v1 availability status.
    /// Byte 8 is a five-bit active mask in immutable worksite-id order.
    /// Clients must require monotonic revisions and zero reserved bits.
    pub fn status_packet(&self) -> [u8; 12] {
        let mask = self
            .active
            .iter()
            .enumerate()
            .fold(0_u8, |mask, (i, active)| mask | u8::from(*active) << i);
        let mut frame = [0_u8; 12];
        frame[0] = PROTOCOL_VERSION;
        frame[1] = WORKSITE_STATUS_PACKET_TYPE;
        frame[2] = 1; // immutable v1 status schema
        frame[4..8].copy_from_slice(&self.revision.to_le_bytes());
        frame[8] = mask;
        frame
    }

    /// Atomic full-snapshot adoption from an approved authoritative server
    /// world object registry. A stale, invalid or cross-zone manifest MUST NOT
    /// partially flip an object state or resurrect a destroyed/closed site.
    pub fn adopt_server_manifest(
        &mut self,
        zone: ZoneId,
        version: u16,
        revision: u32,
        active: [bool; WORKSITES.len()],
    ) -> Result<(), WorksiteRevisionError> {
        if zone != ZoneId::Moonvale {
            return Err(WorksiteRevisionError::WrongZone);
        }
        if version != 1 {
            return Err(WorksiteRevisionError::InvalidVersion);
        }
        if revision <= self.revision {
            return Err(WorksiteRevisionError::StaleRevision);
        }
        self.active = active;
        self.revision = revision;
        Ok(())
    }

    pub fn allows(&self, actor: u8, operation: u8, tick: u32) -> bool {
        self.active_for(actor, operation) && allows(actor, operation, tick)
    }
}

pub fn allows(actor: u8, operation: u8, tick: u32) -> bool {
    let Some(site) = WORKSITES
        .iter()
        .find(|site| site.actor == actor && site.operation == operation)
    else {
        return false;
    };
    if actor != 2 && !npc_navigation::valid_route(actor) {
        return false;
    }
    let Some(worker) = NpcRoutines::position(actor, tick) else {
        return false;
    };
    let dx = i32::from(worker.x) - i32::from(site.x);
    let dy = i32::from(worker.y) - i32::from(site.y);
    dx * dx + dy * dy <= INTERACTION_RADIUS * INTERACTION_RADIUS
        && npc_navigation::pilot_line_of_sight((worker.x, worker.y), (site.x, site.y))
}

/// Read-only site list, once per authenticated loopback pilot connection.
/// Header: protocol, distinct type 11, five sites, zero reserved.
/// Entries: id (1), actor (1), x (u16 LE), y (u16 LE). Site ids uniquely
/// identify an immutable source/destination; client never provides them back.
pub fn packet() -> Vec<u8> {
    let mut bytes = Vec::with_capacity(4 + WORKSITES.len() * 6);
    bytes.extend_from_slice(&[
        PROTOCOL_VERSION,
        WORKSITE_PACKET_TYPE,
        WORKSITES.len() as u8,
        0,
    ]);
    for site in WORKSITES {
        bytes.extend_from_slice(&[site.id, site.actor]);
        bytes.extend_from_slice(&site.x.to_le_bytes());
        bytes.extend_from_slice(&site.y.to_le_bytes());
    }
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_authorized_worker_at_matching_server_site_can_act() {
        for (actor, op, tick) in [
            (5, 1, 600),
            (5, 2, 1800),
            (4, 3, 600),
            (4, 4, 1800),
            (2, 5, 300),
        ] {
            assert!(allows(actor, op, tick), "{actor}/{op}/{tick}");
        }
        for (actor, op, tick) in [
            (4, 1, 600),
            (5, 3, 600),
            (2, 2, 1800),
            (3, 5, 300),
            (1, 5, 300),
            (5, 5, 300),
            (0, 1, 600),
            (4, 99, 600),
            (5, 1, 1800),
            (5, 2, 600),
            (4, 3, 1800),
            (4, 4, 600),
            (4, 3, 300),
            (5, 1, 300),
        ] {
            assert!(!allows(actor, op, tick), "must refuse {actor}/{op}/{tick}");
        }
    }

    #[test]
    fn every_site_is_unique_on_navigable_pilot_ground() {
        let mut sites = std::collections::BTreeSet::new();
        for site in WORKSITES {
            assert!(sites.insert(site.id));
            assert!(npc_navigation::pilot_line_of_sight(
                (site.x, site.y),
                (site.x, site.y)
            ));
            assert!((60..=460).contains(&site.x));
            assert!((30..=320).contains(&site.y));
        }
        assert_eq!(sites.len(), 5);
    }

    #[test]
    fn compact_worksites_wire_only_reports_bounded_immutable_coordinates() {
        let data = packet();
        assert_eq!(data.len(), 34);
        assert_eq!(&data[0..4], &[1, 11, 5, 0]);
        assert_eq!(&data[4..10], &[1, 5, 84, 1, 255, 0]);
        assert_eq!(&data[28..34], &[5, 2, 210, 0, 65, 0]);
    }

    #[test]
    fn status_is_exact_read_only_revision_snapshot_and_rejects_stale_changes() {
        let mut sites = WorksiteAuthority::default();
        assert_eq!(
            sites.status_packet(),
            [1, 12, 1, 0, 1, 0, 0, 0, 31, 0, 0, 0]
        );
        let mut active = [true; 5];
        active[0] = false;
        active[3] = false;
        sites
            .adopt_server_manifest(ZoneId::Moonvale, 1, 2, active)
            .unwrap();
        assert_eq!(
            sites.status_packet(),
            [1, 12, 1, 0, 2, 0, 0, 0, 22, 0, 0, 0]
        );
        assert_eq!(
            sites.adopt_server_manifest(ZoneId::Moonvale, 1, 1, [true; 5]),
            Err(WorksiteRevisionError::StaleRevision)
        );
        assert_eq!(sites.status_packet()[8], 22);
        sites
            .adopt_server_manifest(ZoneId::Moonvale, 1, 3, [true; 5])
            .unwrap();
        assert_eq!(
            sites.status_packet(),
            [1, 12, 1, 0, 3, 0, 0, 0, 31, 0, 0, 0]
        );
    }

    #[test]
    fn world_object_outages_use_atomic_monotonic_moonvale_revisions() {
        let mut authority = WorksiteAuthority::default();
        assert_eq!(authority.revision(), 1);
        assert_eq!(authority.active_flags(), [true; 5]);
        assert!(authority.allows(5, 1, 600));
        let mut closed = [true; 5];
        closed[0] = false; // Well is unavailable.
        assert_eq!(
            authority.adopt_server_manifest(ZoneId::RedLionInn, 1, 2, closed),
            Err(WorksiteRevisionError::WrongZone)
        );
        assert_eq!(
            authority.adopt_server_manifest(ZoneId::Moonvale, 2, 2, closed),
            Err(WorksiteRevisionError::InvalidVersion)
        );
        assert_eq!(
            authority.adopt_server_manifest(ZoneId::Moonvale, 1, 1, closed),
            Err(WorksiteRevisionError::StaleRevision)
        );
        assert!(authority.allows(5, 1, 600));
        assert_eq!(authority.revision(), 1);
        assert!(authority
            .adopt_server_manifest(ZoneId::Moonvale, 1, 2, closed)
            .is_ok());
        assert_eq!(authority.revision(), 2);
        assert!(!authority.active_for(5, 1));
        assert!(!authority.allows(5, 1, 600));
        assert!(authority.allows(5, 2, 1800));
        assert_eq!(
            authority.adopt_server_manifest(ZoneId::Moonvale, 1, 2, [true; 5]),
            Err(WorksiteRevisionError::StaleRevision)
        );
        assert!(!authority.allows(5, 1, 600));
        assert!(authority
            .adopt_server_manifest(ZoneId::Moonvale, 1, 3, [true; 5])
            .is_ok());
        assert!(authority.allows(5, 1, 600));
    }
}
