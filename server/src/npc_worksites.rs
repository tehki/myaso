//! LW-1K: five bounded, server-owned *pilot* worksite objects.
//!
//! These are staged NPC micro-world resource anchors, NOT production items,
//! map collision, economic inventory, or interactable player objects. NPC
//! jobs need a scheduled work opportunity AND authenticated server proximity.
//! No client supplied action, coordinate, object id, or entity can authorize work.
use crate::{npc_navigation, npc_routines::NpcRoutines, PROTOCOL_VERSION};

pub const WORKSITE_PACKET_TYPE: u8 = 11;
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
}
