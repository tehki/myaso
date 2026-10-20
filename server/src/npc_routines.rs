//! Loopback-only LW-1 NPC schedule and witnessed events.
//! Staging positions follow pilot-only obstacle-aware navigation, isolated from combat collision.
//! This module never drives a physics actor and stores no conversation bodies.
use crate::living_world::NPCS;
use crate::npc_navigation;
use crate::npc_supply::{worksite_name, NpcSupplyWorld, WorkDecision};
use crate::npc_worksites::WORKSITES;
use crate::PROTOCOL_VERSION;

pub const STATE_TYPE: u8 = 8;
pub const STATE_INTERVAL_TICKS: u32 = 60;
const LEG_TICKS: u32 = 600;
const CYCLE_TICKS: u32 = 4 * LEG_TICKS;
const WITNESS_RADIUS: f32 = 235.0;
const WITNESS_MEMORY_TICKS: u32 = 120 * 60;
const GOSSIP_RADIUS: f32 = 105.0;
const SOCIAL_INTERVAL_TICKS: u32 = 60;
const MEETING_RADIUS: f32 = 105.0;
const MEETING_REARM_RADIUS: f32 = 125.0;
const MEETING_FRESH_TICKS: u32 = 120 * 60;
// Five fixed NPCs have ten unique unordered pairs, never player identities.
const NPC_PAIR_COUNT: usize = NPCS.len() * (NPCS.len() - 1) / 2;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct Encounter {
    last_met_tick: Option<u32>,
    count: u8,
    // Edge-triggered: staying side by side cannot manufacture more meetings.
    in_contact: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HeardReport {
    original_event_tick: u32,
    heard_tick: u32,
    source_id: u8,
}

/// Tiny bounded knowledge slot per fixed NPC; source_id=None means the
/// operator received the server-verified notice for their own assigned site,
/// NOT that they watched a door or building being repaired in the world.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WorksiteNews {
    event_tick: u32,
    learned_tick: u32,
    revision: u32,
    site_id: u8,
    active: bool,
    source_id: Option<u8>,
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
    // Fixed-size NPC-only encounter evidence. No chat or player/account data.
    encounters: [Encounter; NPC_PAIR_COUNT],
    worksite_news: [Option<WorksiteNews>; NPCS.len()],
    last_worksite_social_tick: Option<u32>,
    last_worksite_event_revision: u32,
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
        self.record_encounters(tick, &positions);
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

    /// Real, server-owned worksite news is learned first by its assigned NPC
    /// operator, then by exactly one-hop face-to-face communication within
    /// the pilot social radius and line-of-sight. No client action, secondhand
    /// retransmission or unseen friendship can generate knowledge.
    /// Invoke *after* NpcSupplyWorld::advance on the authoritative server tick.
    pub fn advance_worksite_social(&mut self, tick: u32, supply: &NpcSupplyWorld) {
        if tick == 0
            || tick % SOCIAL_INTERVAL_TICKS != 0
            || self.last_worksite_social_tick.is_some_and(|old| {
                tick.wrapping_sub(old) == 0 || tick.wrapping_sub(old) >= (1 << 31)
            })
        {
            return;
        }
        self.last_worksite_social_tick = Some(tick);
        let revision = supply.worksite_revision();
        if let Some(event) = supply.latest_worksite_event(tick) {
            // Only the first social cadence after an actual accepted
            // transition may create operator knowledge. A late caller
            // cannot retroactively fabricate a meeting at the incident.
            if event.revision > self.last_worksite_event_revision
                && tick >= event.tick
                && tick - event.tick < SOCIAL_INTERVAL_TICKS
            {
                self.last_worksite_event_revision = event.revision;
                self.worksite_news.fill(None);
                for site in WORKSITES {
                    let Some(active) = event.changed_site(site.id) else {
                        continue;
                    };
                    let Some(operator) = NPCS.iter().position(|npc| npc.id == site.actor) else {
                        continue;
                    };
                    // In a multi-site update choose the lowest matching site,
                    // never allocate one slot per event or per player.
                    if self.worksite_news[operator].is_none() {
                        self.worksite_news[operator] = Some(WorksiteNews {
                            event_tick: event.tick,
                            learned_tick: tick,
                            revision,
                            site_id: site.id,
                            active,
                            source_id: None,
                        });
                    }
                }
            }
        }
        let positions = NPCS.map(|npc| Self::position(npc.id, tick).expect("fixed roster"));
        // Snapshot before dissemination: hearing on this tick cannot
        // instantly retransmit on to a third NPC.
        let prior = self.worksite_news;
        for (source_index, candidate) in prior.iter().enumerate() {
            let Some(news) = candidate else { continue };
            if news.source_id.is_some()
                || news.revision != revision
                || tick < news.event_tick
                || tick - news.event_tick > MEETING_FRESH_TICKS
            {
                continue;
            }
            for receiver_index in 0..NPCS.len() {
                if receiver_index == source_index
                    || self.worksite_news[receiver_index]
                        .is_some_and(|known| known.revision >= revision)
                {
                    continue;
                }
                let dx =
                    i32::from(positions[source_index].x) - i32::from(positions[receiver_index].x);
                let dy =
                    i32::from(positions[source_index].y) - i32::from(positions[receiver_index].y);
                if dx * dx + dy * dy > (GOSSIP_RADIUS as i32).pow(2)
                    || !npc_navigation::pilot_line_of_sight(
                        (positions[source_index].x, positions[source_index].y),
                        (positions[receiver_index].x, positions[receiver_index].y),
                    )
                {
                    continue;
                }
                self.worksite_news[receiver_index] = Some(WorksiteNews {
                    learned_tick: tick,
                    source_id: Some(NPCS[source_index].id),
                    ..*news
                });
                // One reliable operator source per NPC per revision.
            }
        }
    }

    /// NPC-local report only: direct operational notice vs one-hop hearsay.
    /// Current status can still be requested separately from the server
    /// ledger; this ephemeral story must not outlive its event or revision.
    pub fn worksite_social_report(
        &self,
        npc_id: u8,
        tick: u32,
        current_revision: u32,
    ) -> Option<String> {
        let index = NPCS.iter().position(|npc| npc.id == npc_id)?;
        let news = self.worksite_news[index]?;
        if news.revision != current_revision
            || tick < news.event_tick
            || tick - news.event_tick > MEETING_FRESH_TICKS
            || tick < news.learned_tick
        {
            return None;
        }
        let name = worksite_name(news.site_id)?;
        let verb = if news.active {
            "became available"
        } else {
            "became unavailable"
        };
        let provenance = match news.source_id {
            None => "I received a verified server notice about my assigned worksite.".to_string(),
            Some(source_id) => {
                let source = NPCS.iter().find(|npc| npc.id == source_id)?.name;
                format!("I heard that from {source} in person, not from the server directly.")
            }
        };
        Some(format!(
            "{name} {verb} at server tick {} (revision {}). {provenance} Cause not verified.",
            news.event_tick, news.revision
        ))
    }

    fn pair_index(a: usize, b: usize) -> usize {
        debug_assert!(a < b && b < NPCS.len());
        a * (2 * NPCS.len() - a - 1) / 2 + (b - a - 1)
    }

    fn record_encounters(&mut self, tick: u32, positions: &[NpcState; NPCS.len()]) {
        for i in 0..NPCS.len() {
            for j in (i + 1)..NPCS.len() {
                let x = f32::from(positions[i].x) - f32::from(positions[j].x);
                let y = f32::from(positions[i].y) - f32::from(positions[j].y);
                let distance_squared = x * x + y * y;
                let record = &mut self.encounters[Self::pair_index(i, j)];
                if distance_squared > MEETING_REARM_RADIUS * MEETING_REARM_RADIUS {
                    record.in_contact = false;
                } else if !record.in_contact
                    && distance_squared <= MEETING_RADIUS * MEETING_RADIUS
                    && npc_navigation::pilot_line_of_sight(
                        (positions[i].x, positions[i].y),
                        (positions[j].x, positions[j].y),
                    )
                {
                    record.last_met_tick = Some(tick);
                    record.count = record.count.saturating_add(1).min(8);
                    record.in_contact = true;
                }
            }
        }
    }

    /// Deterministic account-free NPC social context. Never describes an
    /// unseen friendship or a connection outside a verified nearby meeting.
    pub fn recent_acquaintance(&self, id: u8, tick: u32) -> Option<(&'static str, u8)> {
        let origin = NPCS.iter().position(|npc| npc.id == id)?;
        let mut best: Option<(u32, usize, u8)> = None;
        for (other, npc) in NPCS.iter().enumerate() {
            if other == origin {
                continue;
            }
            let pair = Self::pair_index(origin.min(other), origin.max(other));
            let evidence = self.encounters[pair];
            let Some(observed) = evidence.last_met_tick else {
                continue;
            };
            let age = tick.wrapping_sub(observed);
            if age > MEETING_FRESH_TICKS {
                continue;
            }
            if best.is_none_or(|(old_age, old, _)| {
                age < old_age || (age == old_age && npc.id < NPCS[old].id)
            }) {
                best = Some((age, other, evidence.count));
            }
        }
        best.map(|(_, other, count)| (NPCS[other].name, count))
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

    /// Task-aware duty description from the *same* finite authoritative
    /// ledger that controls actual pickup/forge/delivery. A worker is never
    /// described as carrying a resource whose carried stock is zero, nor
    /// working at a closed site. No player message can schedule work.
    pub fn context_with_supply(
        &self,
        id: u8,
        tick: u32,
        supply: &NpcSupplyWorld,
    ) -> Option<(&'static str, bool)> {
        let (_, witnessed) = self.context(id, tick)?;
        let position = Self::position(id, tick)?;
        let activity = match id {
            2 => match supply.decision(2) {
                WorkDecision::ForgeNails if position.activity != 0 => "forging needed nails",
                _ => "waiting for a feasible forge task",
            },
            4 => match supply.decision(4) {
                WorkDecision::CollectFood => "travelling to collect provisions for the market",
                WorkDecision::DeliverFood => "carrying provisions to the market",
                _ if supply.stocks().elara_food > 0 => {
                    "holding provisions until the market can receive them"
                }
                _ if position.activity == 1 => "walking the market route without an active job",
                _ => "waiting for an available market supply task",
            },
            5 => match supply.decision(5) {
                WorkDecision::CollectWater => "travelling to collect water for the work yard",
                WorkDecision::DeliverWater => "carrying water to the work yard",
                _ if supply.stocks().tomas_water > 0 => {
                    "holding water until the work yard can receive it"
                }
                _ if position.activity == 1 => "walking the well route without an active job",
                _ => "waiting for an available water delivery task",
            },
            _ => return self.context(id, tick),
        };
        Some((activity, witnessed))
    }

    /// Mirrors the existing 38-byte pilot marker format, never player combat
    /// entity state. Stationary workers switch to idle after satisfying needs;
    /// walking workers remain marked walking because routes still move.
    pub fn state_packet_with_supply(tick: u32, supply: &NpcSupplyWorld) -> Vec<u8> {
        let mut packet = Vec::with_capacity(8 + NPCS.len() * 6);
        packet.extend_from_slice(&[PROTOCOL_VERSION, STATE_TYPE, NPCS.len() as u8, 0]);
        packet.extend_from_slice(&tick.to_le_bytes());
        for npc in NPCS {
            let state = Self::position(npc.id, tick).expect("authored NPC ID");
            let activity = match npc.id {
                2 if supply.decision(2) == WorkDecision::Rest => 0,
                4 | 5 if supply.decision(npc.id) == WorkDecision::Rest && state.activity == 2 => 0,
                _ => state.activity,
            };
            packet.push(state.id);
            packet.extend_from_slice(&state.x.to_le_bytes());
            packet.extend_from_slice(&state.y.to_le_bytes());
            packet.push(activity);
        }
        packet
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

    #[test]
    fn npc_acquaintance_requires_real_meeting_and_is_not_faked_by_staying_nearby() {
        let mut town = NpcRoutines::default();
        assert_eq!(town.recent_acquaintance(1, 59), None);
        town.advance_social(59);
        assert_eq!(town.recent_acquaintance(1, 59), None);
        town.advance_social(60);
        assert_eq!(town.recent_acquaintance(1, 60), Some(("Marta", 1)));
        assert_eq!(town.recent_acquaintance(2, 60), Some(("Aldric", 1)));
        let pair = NpcRoutines::pair_index(0, 1);
        assert_eq!(town.encounters[pair].count, 1);
        for tick in (120..=2400).step_by(60) {
            town.advance_social(tick);
        }
        assert_eq!(town.encounters[pair].count, 1);
        assert_eq!(
            town.recent_acquaintance(1, 60 + MEETING_FRESH_TICKS + 1),
            None
        );
        assert_eq!(NpcRoutines::default().recent_acquaintance(1, 60), None);
    }

    #[test]
    fn only_separation_and_new_los_meeting_can_increment_bounded_contact_count() {
        let mut town = NpcRoutines::default();
        let mut states = NPCS.map(|npc| NpcState {
            id: npc.id,
            x: npc.x,
            y: npc.y,
            activity: 1,
        });
        town.record_encounters(60, &states);
        let pair = NpcRoutines::pair_index(0, 1);
        assert_eq!(town.encounters[pair].count, 1);
        town.record_encounters(120, &states);
        assert_eq!(town.encounters[pair].count, 1);
        states[1].x = 460;
        states[1].y = 310;
        town.record_encounters(180, &states);
        assert!(!town.encounters[pair].in_contact);
        states[1].x = 210;
        states[1].y = 65;
        town.record_encounters(240, &states);
        assert_eq!(town.encounters[pair].count, 2);
        assert_eq!(town.recent_acquaintance(1, 240), Some(("Marta", 2)));

        // Two other NPCs are geographically close, but the pilot supply
        // crate separates their line of sight: don't invent a meeting.
        states[2].x = 275;
        states[2].y = 190;
        states[4].x = 340;
        states[4].y = 255;
        town.record_encounters(300, &states);
        let blocked = NpcRoutines::pair_index(2, 4);
        assert_eq!(town.encounters[blocked].count, 0);
    }

    #[test]
    fn npc_acquaintance_counter_saturates_and_sources_are_fixed_roster() {
        let mut town = NpcRoutines::default();
        let mut states = NPCS.map(|npc| NpcState {
            id: npc.id,
            x: npc.x,
            y: npc.y,
            activity: 1,
        });
        let pair = NpcRoutines::pair_index(0, 1);
        for i in 0..20 {
            let tick = 60 + i * 180;
            town.record_encounters(tick, &states);
            states[1].x = 460;
            states[1].y = 310;
            town.record_encounters(tick + 60, &states);
            states[1].x = 210;
            states[1].y = 65;
        }
        assert_eq!(town.encounters[pair].count, 8);
        assert_eq!(
            town.recent_acquaintance(1, 60 + 19 * 180),
            Some(("Marta", 8))
        );
        assert_eq!(town.recent_acquaintance(99, 6000), None);
    }

    #[test]
    fn duty_descriptions_follow_verified_cargo_and_worksite_closure() {
        let routines = NpcRoutines::default();
        let mut supply = NpcSupplyWorld::default();
        let (before, _) = routines.context_with_supply(5, 0, &supply).unwrap();
        assert!(before.contains("travelling to collect water"));
        assert!(!before.contains("carrying"));
        assert!(routines
            .context_with_supply(4, 0, &supply)
            .unwrap()
            .0
            .contains("collect provisions"));
        for tick in 0..=600 {
            supply.advance(tick);
        }
        assert!(routines
            .context_with_supply(5, 600, &supply)
            .unwrap()
            .0
            .contains("carrying water"));
        assert!(routines
            .context_with_supply(4, 600, &supply)
            .unwrap()
            .0
            .contains("carrying provisions"));
        supply.enable_pilot_maintenance();
        for tick in 601..=900 {
            supply.advance(tick);
        }
        assert!(routines
            .context_with_supply(5, 900, &supply)
            .unwrap()
            .0
            .contains("holding water"));
        assert!(!routines
            .context_with_supply(5, 900, &supply)
            .unwrap()
            .0
            .contains("carrying"));
        assert!(routines
            .context_with_supply(4, 900, &supply)
            .unwrap()
            .0
            .contains("carrying provisions"));
        // Default worksite status is not rewritten by the player or dialogue.
        assert_eq!(supply.worksite_revision(), 2);
        for tick in 901..=2100 {
            supply.advance(tick);
        }
        assert!(routines
            .context_with_supply(5, 2100, &supply)
            .unwrap()
            .0
            .contains("carrying water"));
        assert_eq!(supply.worksite_revision(), 3);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn task_aware_state_packet_preserves_position_format_and_exposes_idle() {
        let mut supply = NpcSupplyWorld::default();
        let original = NpcRoutines::state_packet(900);
        let assigned = NpcRoutines::state_packet_with_supply(900, &supply);
        assert_eq!(assigned.len(), original.len());
        assert_eq!(assigned.len(), 38);
        // Before finite demand is satisfied the existing duty state remains.
        assert_eq!(assigned, original);
        for tick in 0..=40_000 {
            supply.advance(tick);
        }
        let idle = NpcRoutines::state_packet_with_supply(900, &supply);
        assert_eq!(&idle[0..8], &original[0..8]);
        for i in 0..5 {
            let offset = 8 + i * 6;
            assert_eq!(&idle[offset..offset + 5], &original[offset..offset + 5]);
        }
        // Marta, Elara and Tomas no longer claim to be actively working at a
        // stationary post after real demand has been fulfilled.
        assert_eq!(idle[8 + 6 + 5], 0);
        assert_eq!(idle[8 + 3 * 6 + 5], 0);
        assert_eq!(idle[8 + 4 * 6 + 5], 0);
        let routines = NpcRoutines::default();
        assert!(routines
            .context_with_supply(2, 900, &supply)
            .unwrap()
            .0
            .contains("waiting"));
        assert!(routines
            .context_with_supply(5, 900, &supply)
            .unwrap()
            .0
            .contains("waiting"));
        assert_eq!(supply.decision(2), WorkDecision::Rest);
        assert_eq!(supply.decision(4), WorkDecision::Rest);
        assert_eq!(supply.decision(5), WorkDecision::Rest);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn no_assignment_does_not_hide_real_patrol_or_fabricate_personal_witness() {
        let mut supply = NpcSupplyWorld::default();
        let mut routines = NpcRoutines::default();
        for tick in 0..=40_000 {
            supply.advance(tick);
        }
        // The same stable route still moves; it must be described as
        // unassigned walking rather than carrying fabricated resources.
        assert!(routines
            .context_with_supply(5, 200, &supply)
            .unwrap()
            .0
            .contains("walking"));
        assert_eq!(
            NpcRoutines::state_packet_with_supply(200, &supply)[8 + 4 * 6 + 5],
            1
        );
        assert!(routines
            .context_with_supply(3, 200, &supply)
            .unwrap()
            .0
            .contains("walking the watch"));
        routines.witness_death(201, 0.0, 0.0);
        assert!(routines.context_with_supply(1, 201, &supply).unwrap().1);
        assert!(!routines.context_with_supply(5, 201, &supply).unwrap().1);
        assert!(routines.context_with_supply(99, 200, &supply).is_none());
    }

    #[test]
    fn operator_news_reaches_rowan_only_after_real_pilot_meeting() {
        let mut town = NpcSupplyWorld::default();
        town.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        for tick in 0..=900 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        let direct = npcs.worksite_social_report(5, 900, 2).unwrap();
        assert!(direct.contains("work yard became unavailable"));
        assert!(direct.contains("verified server notice"));
        assert_eq!(npcs.worksite_social_report(3, 900, 2), None);
        assert_eq!(npcs.worksite_social_report(4, 900, 2), None);
        assert_eq!(npcs.worksite_social_report(99, 900, 2), None);
        // The supply crate blocks the shortcut between Tomas and Rowan.
        for tick in 901..=1200 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        assert!(npcs.worksite_social_report(3, 1200, 2).is_none());
        for tick in 1201..=1380 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        let heard = npcs.worksite_social_report(3, 1380, 2).unwrap();
        assert!(heard.contains("heard that from Tomas in person"));
        assert!(heard.contains("tick 900 (revision 2)"));
        assert!(!heard.contains("I received a verified server notice"));
        // A secondhand Rowan cannot create another verified source.
        assert_eq!(npcs.worksite_social_report(1, 1380, 2), None);
        assert_eq!(npcs.worksite_news[2].unwrap().source_id, Some(5));
        assert_eq!(npcs.worksite_news[4].unwrap().source_id, None);
    }

    #[test]
    fn newer_reopening_supersedes_closed_hearsay_without_retransmitting_it() {
        let mut town = NpcSupplyWorld::default();
        town.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        for tick in 0..=2100 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        assert_eq!(town.worksite_revision(), 3);
        let operator = npcs.worksite_social_report(5, 2100, 3).unwrap();
        assert!(operator.contains("work yard became available"));
        assert!(operator.contains("revision 3"));
        assert!(!operator.contains("became unavailable"));
        // No old news may leak during the exact reopening window.
        assert!(npcs.worksite_social_report(3, 2100, 3).is_none());
        assert!(npcs.worksite_social_report(3, 2100, 2).is_none());
        for tick in 2101..=2580 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        let heard = npcs.worksite_social_report(3, 2580, 3).unwrap();
        assert!(heard.contains("work yard became available"));
        assert!(heard.contains("heard that from Tomas"));
        assert!(!heard.contains("became unavailable"));
        assert!(npcs.worksite_social_report(3, 2100 + 7201, 3).is_none());
        assert!(town.stocks().conserved());
    }

    #[test]
    fn no_player_claim_or_repeated_social_tick_can_fabricate_worksite_news() {
        let mut town = NpcSupplyWorld::default();
        let mut npcs = NpcRoutines::default();
        for tick in 0..=900 {
            town.advance(tick);
            npcs.advance_worksite_social(tick, &town);
        }
        assert!(npcs.worksite_social_report(5, 900, 1).is_none());
        let mut active = [true; 5];
        active[1] = false;
        assert!(town
            .adopt_server_worksites(crate::zone::ZoneId::RedLionInn, 1, 2, active)
            .is_err());
        npcs.advance_worksite_social(900, &town);
        assert!(npcs.worksite_social_report(5, 900, 1).is_none());
        town.adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 2, active)
            .unwrap();
        // Notice is not arbitrarily learned from an old update at tick 960.
        npcs.advance_worksite_social(960, &town);
        assert!(npcs.worksite_social_report(5, 960, 2).is_none());
        assert!(town.stocks().conserved());
    }

    #[test]
    fn secondhand_sources_never_relay_or_claim_to_be_direct_operators() {
        let town = NpcSupplyWorld::default();
        let mut npcs = NpcRoutines::default();
        npcs.worksite_news[0] = Some(WorksiteNews {
            event_tick: 60,
            learned_tick: 60,
            revision: 1,
            site_id: 2,
            active: false,
            source_id: Some(5),
        });
        npcs.advance_worksite_social(120, &town);
        assert_eq!(npcs.worksite_news[1], None);
        assert!(npcs
            .worksite_social_report(1, 120, 1)
            .unwrap()
            .contains("heard that from Tomas"));
        assert_eq!(npcs.worksite_social_report(1, 120, 2), None);
    }
}
