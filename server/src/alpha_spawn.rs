//! P0 First Playable staging-only, single-world spawn alignment.
//! No new zone, portal, collision rule, persistence or network packet.
//! The default live/world/Combat admission path is intentionally unchanged.

use anyhow::{bail, Result};
use myaso_server::simulation::World;
use std::net::IpAddr;

// Version-pinned to World #336/#478 authored Moonvale preview's (4110, 4160)
// public-area spawn. All four independent slots were checked walkable at a
// radius of 18 against its offline authored-preview collision in Oct 2026.
// This is staging evidence ONLY; real server obstacle authority is not wired.
const GREYHAVEN_SPAWNS: [(f32, f32); 4] = [
    (4110.0, 4160.0),
    (4206.0, 4160.0),
    (4110.0, 4256.0),
    (4206.0, 4256.0),
];
const MIN_SPAWN_SEPARATION_SQUARED: f32 = 44.0 * 44.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AlphaSpawnProfile {
    Existing,
    GreyhavenStaging,
}

impl AlphaSpawnProfile {
    pub(crate) fn parse(
        raw: Option<&str>,
        player_cap: usize,
        flight_background_players: usize,
    ) -> Result<Self> {
        match raw {
            None => Ok(Self::Existing),
            Some("greyhaven") => {
                if !(2..=GREYHAVEN_SPAWNS.len()).contains(&player_cap) {
                    bail!("MYASO_ALPHA_SPAWN=greyhaven requires MYASO_MAX_PLAYERS=2..4");
                }
                if flight_background_players != 0 {
                    bail!("MYASO_ALPHA_SPAWN=greyhaven forbids synthetic flight players");
                }
                Ok(Self::GreyhavenStaging)
            }
            Some(_) => bail!("MYASO_ALPHA_SPAWN must be unset or greyhaven"),
        }
    }

    pub(crate) fn is_greyhaven(self) -> bool {
        self == Self::GreyhavenStaging
    }

    /// Only an explicitly addressed loopback or private LAN interface can
    /// host this staging fixture. Reject 0.0.0.0/:: and public listeners
    /// before the WebTransport endpoint binds, never after it is exposed.
    pub(crate) fn staging_bind_allowed(bind: IpAddr) -> bool {
        match bind {
            IpAddr::V4(ip) => ip.is_loopback() || ip.is_private(),
            IpAddr::V6(ip) => ip.is_loopback() || ip.is_unique_local(),
        }
    }

    pub(crate) fn admit(self, world: &mut World, net_id: u32) -> bool {
        if self == Self::Existing {
            return world.add_player(net_id);
        }
        // The operator may allow only 2-4 real players in this opt-in mode.
        // Select a free server-authoritative location based on *current*
        // occupancy, not monotonic connection IDs, so abrupt disconnect and
        // subsequent join cannot reuse a still-occupied arrival slot.
        if world.fighters().len() >= GREYHAVEN_SPAWNS.len() {
            return false;
        }
        let available = GREYHAVEN_SPAWNS.iter().copied().find(|(x, y)| {
            world.fighters().iter().all(|fighter| {
                let dx = fighter.x - x;
                let dy = fighter.y - y;
                let spawn_dx = fighter.spawn_x - x;
                let spawn_dy = fighter.spawn_y - y;
                // Reserve occupied fighters' immutable respawn anchors,
                // even after they walk away; otherwise a later arrival
                // could receive a slot that another fighter will respawn to.
                dx * dx + dy * dy >= MIN_SPAWN_SEPARATION_SQUARED
                    && spawn_dx * spawn_dx + spawn_dy * spawn_dy >= MIN_SPAWN_SEPARATION_SQUARED
            })
        });
        let Some((x, y)) = available else {
            return false;
        };
        // This uses the existing World admission API, without client-supplied
        // positions, zone transfers, changes to collision or response packets.
        world.add_player_at(net_id, x, y, 0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_spawn_is_unchanged_without_explicit_opt_in() {
        let profile = AlphaSpawnProfile::parse(None, 512, 100).unwrap();
        assert_eq!(profile, AlphaSpawnProfile::Existing);
        let mut existing = World::default();
        let mut baseline = World::default();
        assert!(profile.admit(&mut existing, 17));
        assert!(baseline.add_player(17));
        let a = existing.fighter(17).unwrap();
        let b = baseline.fighter(17).unwrap();
        assert_eq!((a.x, a.y, a.facing), (b.x, b.y, b.facing));
    }

    #[test]
    fn greyhaven_opt_in_requires_bounded_real_players() {
        assert_eq!(
            AlphaSpawnProfile::parse(Some("greyhaven"), 2, 0).unwrap(),
            AlphaSpawnProfile::GreyhavenStaging
        );
        assert!(AlphaSpawnProfile::parse(Some("greyhaven"), 4, 0).is_ok());
        assert!(AlphaSpawnProfile::parse(Some("greyhaven"), 512, 0).is_err());
        assert!(AlphaSpawnProfile::parse(Some("greyhaven"), 1, 0).is_err());
        assert!(AlphaSpawnProfile::parse(Some("greyhaven"), 2, 1).is_err());
        assert!(AlphaSpawnProfile::parse(Some("unknown"), 2, 0).is_err());
    }

    #[test]
    fn four_players_are_bounded_and_server_spaced_near_greyhaven() {
        let mut world = World::default();
        let profile = AlphaSpawnProfile::GreyhavenStaging;
        for (id, &(x, y)) in (1..=4).zip(GREYHAVEN_SPAWNS.iter()) {
            assert!(profile.admit(&mut world, id));
            let fighter = world.fighter(id).unwrap();
            assert_eq!((fighter.x, fighter.y), (x, y));
        }
        assert!(!profile.admit(&mut world, 5));
        assert_eq!(world.fighters().len(), 4);
        assert!(!profile.admit(&mut world, 1)); // duplicate admission
    }

    #[test]
    fn abrupt_leave_then_new_connection_reuses_only_a_free_slot() {
        let mut world = World::default();
        let profile = AlphaSpawnProfile::GreyhavenStaging;
        assert!(profile.admit(&mut world, 1));
        assert!(profile.admit(&mut world, 2));
        assert!(world.remove_player(1));
        assert!(profile.admit(&mut world, 42));
        let returning = world.fighter(42).unwrap();
        assert_eq!((returning.x, returning.y), GREYHAVEN_SPAWNS[0]);
        assert_eq!(world.fighters().len(), 2);
        assert!(!profile.admit(&mut world, 0)); // never admit invalid ID
    }

    #[test]
    fn travelling_fighter_cannot_lose_reserved_respawn_anchor() {
        use myaso_server::simulation::InputIntent;
        let mut world = World::default();
        let profile = AlphaSpawnProfile::GreyhavenStaging;
        assert!(profile.admit(&mut world, 1));
        assert!(world.set_input(
            1,
            InputIntent {
                move_x: 1.0,
                ..InputIntent::default()
            }
        ));
        for _ in 0..60 {
            world.step();
        }
        let first = world.fighter(1).unwrap();
        assert!(first.x > GREYHAVEN_SPAWNS[0].0 + 44.0);
        assert_eq!((first.spawn_x, first.spawn_y), GREYHAVEN_SPAWNS[0]);
        assert!(profile.admit(&mut world, 2));
        let second = world.fighter(2).unwrap();
        assert_eq!((second.spawn_x, second.spawn_y), GREYHAVEN_SPAWNS[1]);
        assert!(world.remove_player(1));
        assert!(profile.admit(&mut world, 3));
        assert_eq!(
            (
                world.fighter(3).unwrap().spawn_x,
                world.fighter(3).unwrap().spawn_y
            ),
            GREYHAVEN_SPAWNS[0]
        );
    }

    #[test]
    fn private_staging_bind_guard_rejects_public_and_unspecified_ips() {
        for address in ["127.0.0.1", "192.168.2.85", "10.8.1.5", "::1", "fd00::1"] {
            assert!(
                AlphaSpawnProfile::staging_bind_allowed(address.parse().unwrap()),
                "{address}"
            );
        }
        for address in [
            "0.0.0.0",
            "::",
            "8.8.8.8",
            "1.1.1.1",
            "2001:4860:4860::8888",
        ] {
            assert!(
                !AlphaSpawnProfile::staging_bind_allowed(address.parse().unwrap()),
                "{address}"
            );
        }
    }

    #[test]
    fn unsafe_congested_arrivals_fail_closed() {
        let mut world = World::default();
        // Any occupant near a staging position blocks that arrival.
        for (id, &(x, y)) in (1..=4).zip(GREYHAVEN_SPAWNS.iter()) {
            assert!(world.add_player_at(id, x, y, 0.0));
        }
        assert!(!AlphaSpawnProfile::GreyhavenStaging.admit(&mut world, 5));
    }
}
