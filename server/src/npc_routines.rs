//! Loopback-only LW-1 NPC schedule and witnessed events.
//! Staging positions follow pilot-only obstacle-aware navigation, isolated from combat collision.
//! This module never drives a physics actor and stores no conversation bodies.
use crate::living_world::NPCS;
use crate::npc_navigation;
use crate::PROTOCOL_VERSION;

pub const STATE_TYPE: u8 = 8;
pub const STATE_INTERVAL_TICKS: u32 = 60;
const LEG_TICKS: u32 = 600;
const CYCLE_TICKS: u32 = 4 * LEG_TICKS;
const WITNESS_RADIUS: f32 = 235.0;
const WITNESS_MEMORY_TICKS: u32 = 120 * 60;
const GOSSIP_RADIUS: f32 = 105.0;
const SOCIAL_INTERVAL_TICKS: u32 = 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HeardReport {
    original_event_tick: u32,
    heard_tick: u32,
    source_id: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NpcState {
    pub id: u8,
    pub x: u16,
    pub y: u16,
    pub activity: u8,
}

#[derive(Debug, Clone, Default)]
pub struct NpcRoutines {
    // Transient server-simulated observations of verified deaths nearby.
    // No combat identities, chat text, persistent player IDs, or logs.
    witnessed_death_tick: [Option<u32>; NPCS.len()],
    // Only a verified direct witness may pass on a report at a real NPC meeting.
    // Neither recipient nor source can create a new combat event or reward.
    heard_report: [Option<HeardReport>; NPCS.len()],
    last_social_tick: Option<u32>,
}

impl NpcRoutines {
    pub fn position(id: u8, tick: u32) -> Option<NpcState> {
        let npc = NPCS.iter().find(|npc| npc.id == id)?;
        let phase = tick % CYCLE_TICKS;
        let (numerator, activity) = if phase < LEG_TICKS {
            (phase, 1)
        } else if phase < 2 * LEG_TICKS {
            (LEG_TICKS, 2)
        } else if phase < 3 * LEG_TICKS {
            (3 * LEG_TICKS - phase, 1)
        } else {
            (0, 0)
        };
        let (x, y) = match id {
            3..=5 => npc_navigation::position(id, numerator).unwrap_or((npc.x, npc.y)),
            _ => (npc.x, npc.y),
        };
        // Stationary professions have an alternating shift rather than
        // reporting an imaginary walk.
        let activity = match id {
            1 | 2 => u8::from(phase < 3 * LEG_TICKS),
            _ => activity,
        };
        Some(NpcState { id, x, y, activity })
    }

    pub fn witness_death(&mut self, tick: u32, x: f32, y: f32) {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        for (index, npc) in NPCS.iter().enumerate() {
            let Some(state) = Self::position(npc.id, tick) else {
                continue;
            };
            let dx = x - f32::from(state.x);
            let dy = y - f32::from(state.y);
            if dx * dx + dy * dy <= WITNESS_RADIUS * WITNESS_RADIUS {
                self.witnessed_death_tick[index] = Some(tick);
                self.heard_report[index] = None;
            }
        }
    }

    /// Bounded NPC-NPC local event relay, executed at most once per simulated
    /// second and only on trusted world clock ticks. No second-hand retransmit.
    pub fn advance_social(&mut self, tick: u32) {
        if tick == 0
            || tick % SOCIAL_INTERVAL_TICKS != 0
            || self.last_social_tick.is_some_and(|previous| {
                let elapsed = tick.wrapping_sub(previous);
                elapsed == 0 || elapsed >= (1 << 31)
            })
        {
            return;
        }
        self.last_social_tick = Some(tick);
        let positions =
            NPCS.map(|npc| Self::position(npc.id, tick).expect("authored NPC position"));
        // Snapshot firsthand witnesses before choosing recipients. Knowledge
        // shared this tick cannot recursively spread to further NPCs.
        for (source_index, source) in NPCS.iter().enumerate() {
            let Some(event_tick) = self.witnessed_death_tick[source_index] else {
                continue;
            };
            if tick.wrapping_sub(event_tick) > WITNESS_MEMORY_TICKS {
                continue;
            }
            for (receiver_index, _) in NPCS.iter().enumerate() {
                if source_index == receiver_index {
                    continue;
                }
                if self.witnessed_death_tick[receiver_index]
                    .is_some_and(|seen| tick.wrapping_sub(seen) <= WITNESS_MEMORY_TICKS)
                {
                    continue;
                }
                let dx =
                    f32::from(positions[source_index].x) - f32::from(positions[receiver_index].x);
                let dy =
                    f32::from(positions[source_index].y) - f32::from(positions[receiver_index].y);
                if dx * dx + dy * dy > GOSSIP_RADIUS * GOSSIP_RADIUS
                    || !npc_navigation::pilot_line_of_sight(
                        (positions[source_index].x, positions[source_index].y),
                        (positions[receiver_index].x, positions[receiver_index].y),
                    )
                {
                    continue;
                }
                let replaces = self.heard_report[receiver_index].is_none_or(|old| {
                    tick.wrapping_sub(old.original_event_tick) > WITNESS_MEMORY_TICKS
                        || (event_tick != old.original_event_tick
                            && event_tick.wrapping_sub(old.original_event_tick) < (1 << 31))
                        || (event_tick == old.original_event_tick && source.id < old.source_id)
                });
                if replaces {
                    self.heard_report[receiver_index] = Some(HeardReport {
                        original_event_tick: event_tick,
                        heard_tick: tick,
                        source_id: source.id,
                    });
                }
            }
        }
    }

    /// Returned name is from the trusted fixed NPC roster, never a claimed
    /// player nickname. The source must have actually witnessed a death.
    pub fn rumor_source(&self, id: u8, tick: u32) -> Option<&'static str> {
        let index = NPCS.iter().position(|npc| npc.id == id)?;
        if self.witnessed_death_tick[index]
            .is_some_and(|seen| tick.wrapping_sub(seen) <= WITNESS_MEMORY_TICKS)
        {
            return None;
        }
        let heard = self.heard_report[index]?;
        if tick.wrapping_sub(heard.original_event_tick) > WITNESS_MEMORY_TICKS
            || tick.wrapping_sub(heard.heard_tick) > WITNESS_MEMORY_TICKS
        {
            return None;
        }
        NPCS.iter()
            .find(|npc| npc.id == heard.source_id)
            .map(|npc| npc.name)
    }

    pub fn context(&self, id: u8, tick: u32) -> Option<(&'static str, bool)> {
        let index = NPCS.iter().position(|npc| npc.id == id)?;
        let state = Self::position(id, tick)?;
        let activity = match (id, state.activity) {
            (1, 0) => "resting after a busy shift",
            (1, _) => "serving guests",
            (2, 0) => "taking a break from the forge",
            (2, _) => "working at the forge",
            (3, 0) => "resting at the watch post",
            (3, 1) => "walking the watch route",
            (3, _) => "standing watch",
            (4, 0) => "resting at the market",
            (4, 1) => "walking between market stalls",
            (4, _) => "checking the market stalls",
            (5, 0) => "resting near the well",
            (5, 1) => "carrying supplies",
            (5, _) => "checking the well",
            _ => return None,
        };
        // wrapping_sub is safe for bounded age and tick rollover.
        let saw = self.witnessed_death_tick[index]
            .is_some_and(|seen| tick.wrapping_sub(seen) <= WITNESS_MEMORY_TICKS);
        Some((activity, saw))
    }

    pub fn state_packet(tick: u32) -> Vec<u8> {
        let mut packet = Vec::with_capacity(8 + NPCS.len() * 6);
        packet.extend_from_slice(&[PROTOCOL_VERSION, STATE_TYPE, NPCS.len() as u8, 0]);
        packet.extend_from_slice(&tick.to_le_bytes());
        for npc in NPCS {
            let state = Self::position(npc.id, tick).expect("authored NPC IDs are unique");
            packet.push(state.id);
            packet.extend_from_slice(&state.x.to_le_bytes());
            packet.extend_from_slice(&state.y.to_le_bytes());
            packet.push(state.activity);
        }
        packet
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authored_routes_are_bounded_periodic_and_do_not_move_stationary_workers() {
        for npc in NPCS {
            let start = NpcRoutines::position(npc.id, 0).unwrap();
            assert_eq!((start.x, start.y), (npc.x, npc.y));
            let end = NpcRoutines::position(npc.id, LEG_TICKS).unwrap();
            let returned = NpcRoutines::position(npc.id, 3 * LEG_TICKS).unwrap();
            let cycle = NpcRoutines::position(npc.id, CYCLE_TICKS).unwrap();
            assert_eq!((returned.x, returned.y), (npc.x, npc.y));
            assert_eq!(cycle, start);
            assert!((end.x as i32 - npc.x as i32).abs() <= 120);
            assert!((end.y as i32 - npc.y as i32).abs() <= 60);
        }
        assert_eq!(NpcRoutines::position(1, 600).unwrap().x, 120);
        assert_eq!(NpcRoutines::position(2, 600).unwrap().x, 210);
        assert!(NpcRoutines::position(3, 600).unwrap().x > 155);
        assert!(NpcRoutines::position(0, 1).is_none());
    }

    #[test]
    fn observation_is_grounded_local_recent_and_expires_across_wraparound() {
        let mut world = NpcRoutines::default();
        assert!(!world.context(1, 0).unwrap().1);
        world.witness_death(100, 8000.0, 8000.0);
        assert!(!world.context(1, 100).unwrap().1);
        world.witness_death(101, 120.0, 95.0);
        assert!(world.context(1, 101).unwrap().1);
        assert!(!world.context(1, 101 + WITNESS_MEMORY_TICKS + 1).unwrap().1);
        assert!(world.context(99, 1).is_none());
        let mut across_wrap = NpcRoutines::default();
        across_wrap.witness_death(u32::MAX - 4, 120.0, 95.0);
        assert!(across_wrap.context(1, 5).unwrap().1);
        assert!(!across_wrap.context(1, WITNESS_MEMORY_TICKS + 10).unwrap().1);
    }

    #[test]
    fn state_packet_is_small_deterministic_and_has_distinct_type() {
        let packet = NpcRoutines::state_packet(600);
        assert_eq!(&packet[0..8], &[1, STATE_TYPE, 5, 0, 88, 2, 0, 0]);
        assert_eq!(packet.len(), 8 + 5 * 6);
        assert_eq!(packet, NpcRoutines::state_packet(600));
        assert_eq!(packet[8], 1);
        assert_eq!(packet[8 + 2 * 6], 3);
    }

    #[test]
    fn firsthand_report_passes_only_at_npc_meeting_with_explicit_source() {
        let mut town = NpcRoutines::default();
        // A real combat death near Aldric, but too distant for Marta.
        town.witness_death(60, 10.0, 250.0);
        assert!(town.context(1, 60).unwrap().1);
        assert!(!town.context(2, 60).unwrap().1);
        assert_eq!(town.rumor_source(2, 60), None);
        town.advance_social(59); // social cadence cannot be client-triggered
        assert_eq!(town.rumor_source(2, 60), None);
        town.advance_social(60);
        assert_eq!(town.rumor_source(2, 60), Some("Aldric"));
        assert!(!town.context(2, 60).unwrap().1);
        assert_eq!(town.rumor_source(4, 60), None); // too far from witnesses
        assert_eq!(town.rumor_source(99, 60), None);
        assert_eq!(town.heard_report[1].unwrap().original_event_tick, 60);
        town.advance_social(60);
        assert_eq!(town.heard_report[1].unwrap().heard_tick, 60);
        assert_eq!(town.rumor_source(2, 60 + WITNESS_MEMORY_TICKS + 1), None);
    }

    #[test]
    fn hearsay_cannot_retransmit_and_real_witness_takes_precedence() {
        let mut town = NpcRoutines::default();
        town.heard_report[0] = Some(HeardReport {
            original_event_tick: 60,
            heard_tick: 60,
            source_id: 2,
        });
        town.advance_social(60);
        assert!(town.heard_report[1].is_none());
        assert!(town.heard_report[2].is_none());

        let mut meeting = NpcRoutines::default();
        meeting.witness_death(60, 10.0, 250.0);
        meeting.advance_social(60);
        assert!(meeting.rumor_source(2, 60).is_some());
        meeting.witness_death(120, 210.0, 65.0);
        assert_eq!(meeting.rumor_source(2, 120), None);
        assert!(meeting.context(2, 120).unwrap().1);
    }

    #[test]
    fn gossip_is_transient_and_nonpersonal_through_tick_wraparound() {
        let mut town = NpcRoutines::default();
        let event = u32::MAX - 64;
        town.witness_death(event, 10.0, 250.0);
        // Explicit social cadence after wraparound.
        town.advance_social(60);
        assert_eq!(town.rumor_source(2, 60), Some("Aldric"));
        assert_eq!(town.rumor_source(2, 60 + WITNESS_MEMORY_TICKS + 100), None);
    }
}
