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
const GUARD_WATCH_RADIUS: i32 = 80;
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

/// A bounded *assignment*, not a proof a building has been inspected or
/// repaired. The guard's existing route and server fighter state are unchanged.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct GuardSiteWatch {
    site_id: u8,
    revision: u32,
    source_id: u8,
    assigned_tick: u32,
}

/// Optional pilot-only detour uses a server-planned, reversible path.
/// The original patrol clock is paused and resumes where the guard left it,
/// never teleporting back to a time-shifted baseline.
#[derive(Debug, Clone)]
struct GuardDetour {
    site_id: u8,
    revision: u32,
    start_tick: u32,
    route: npc_navigation::PilotInspectionPath,
    reversing: Option<(u32, u32)>, // reverse started tick, path progress at reversal
    route_progress: u32,           // only updated from accepted server ticks
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
    guard_watch: Option<GuardSiteWatch>,
    detours_enabled: bool,
    guard_detour: Option<GuardDetour>,
    guard_patrol_pause_ticks: u32,
    last_movement_tick: Option<u32>,
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

    /// Explicit third opt-in gate. This still requires the existing
    /// loopback-only pilot and opt-in staged closure fixture at startup.
    pub fn enable_pilot_guard_detours(&mut self) {
        self.detours_enabled = true;
    }

    /// Chat authority uses the very same committed NPC pilot coordinate
    /// as the type-8 replication packet and encounter/witness checks.
    /// A player cannot talk to the ghost of Rowan's original patrol while
    /// an approved inspection detour is active.
    pub fn speaking_target(
        &self,
        id: u8,
        tick: u32,
        player_x: f32,
        player_y: f32,
        alive: bool,
    ) -> Result<&'static crate::living_world::Npc, crate::living_world::ChatError> {
        let npc = self
            .position_at(id, tick)
            .ok_or(crate::living_world::ChatError::UnknownNpc)?;
        // Preserve the established liveness, finite-coordinate and
        // 180-unit distance guards before checking authored pilot occlusion.
        let target =
            crate::living_world::nearby_npc_at(id, player_x, player_y, alive, npc.x, npc.y)?;
        // Continuous collision avoids five-unit sampling gaps and rounded
        // fighter coordinates accidentally piercing a barrier corner.
        // Includes the finite and unsigned pilot-domain input checks.
        if !npc_navigation::pilot_chat_line_of_sight((player_x, player_y), (npc.x, npc.y)) {
            return Err(crate::living_world::ChatError::OutOfRange);
        }
        Ok(target)
    }

    pub fn position_at(&self, id: u8, tick: u32) -> Option<NpcState> {
        if id != 3 {
            return Self::position(id, tick);
        }
        if let Some(detour) = &self.guard_detour {
            let (x, y) = detour.route.position(detour.route_progress);
            return Some(NpcState {
                id,
                x,
                y,
                activity: 1,
            });
        }
        Self::position(id, tick.wrapping_sub(self.guard_patrol_pause_ticks))
    }

    /// A movement tick is accepted only when it is the *next* 60Hz
    /// authoritative world tick. Future-position queries do not advance
    /// the route. A new site revision reverses on the exact world tick
    /// at which the server adopted it, not on the next 60-tick social call.
    pub fn advance_pilot_movement(&mut self, tick: u32, supply: &NpcSupplyWorld) {
        if !self.detours_enabled {
            return;
        }
        if self
            .last_movement_tick
            .is_some_and(|last| tick != last.wrapping_add(1))
        {
            return;
        }
        self.last_movement_tick = Some(tick);
        let Some(detour) = self.guard_detour.as_mut() else {
            return;
        };
        let closed = detour.revision == supply.worksite_revision()
            && supply.site_is_available(detour.site_id) == Some(false);
        if detour.reversing.is_none()
            && (!closed
                || tick.saturating_sub(detour.start_tick) >= npc_navigation::WALK_TICKS + 300)
        {
            detour.reversing = Some((tick, detour.route_progress));
        } else if detour.reversing.is_none() {
            detour.route_progress = detour
                .route_progress
                .saturating_add(1)
                .min(npc_navigation::WALK_TICKS);
        } else {
            detour.route_progress = detour.route_progress.saturating_sub(1);
        }
        if detour.reversing.is_some() && detour.route_progress == 0 {
            self.guard_patrol_pause_ticks = self
                .guard_patrol_pause_ticks
                .wrapping_add(tick.wrapping_sub(detour.start_tick));
            self.guard_detour = None;
        }
    }

    fn begin_detour_if_allowed(&mut self, tick: u32, supply: &NpcSupplyWorld) {
        if !self.detours_enabled || self.guard_detour.is_some() {
            return;
        }
        let Some(watch) = self.guard_watch else {
            return;
        };
        if watch.revision != supply.worksite_revision()
            || supply.site_is_available(watch.site_id) != Some(false)
        {
            return;
        }
        let Some(site) = WORKSITES.iter().find(|site| site.id == watch.site_id) else {
            return;
        };
        let Some(origin) = self.position_at(3, tick) else {
            return;
        };
        // This planner is a strictly server-authored miniature pilot
        // collision test window. No live-world collision authority yet.
        let Some(route) =
            npc_navigation::pilot_inspection_plan((origin.x, origin.y), (site.x, site.y))
        else {
            return;
        };
        self.guard_detour = Some(GuardDetour {
            site_id: watch.site_id,
            revision: watch.revision,
            start_tick: tick,
            route,
            reversing: None,
            route_progress: 0,
        });
    }

    pub fn witness_death(&mut self, tick: u32, x: f32, y: f32) {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        for (index, npc) in NPCS.iter().enumerate() {
            let Some(state) = self.position_at(npc.id, tick) else {
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
        let positions = NPCS.map(|npc| {
            self.position_at(npc.id, tick)
                .expect("authored NPC position")
        });
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
        // A server revision supersedes all old watch assignments, even when
        // the operator's next face-to-face meeting has not happened yet.
        if self
            .guard_watch
            .is_some_and(|watch| watch.revision != revision)
        {
            self.guard_watch = None;
        }
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
        let positions = NPCS.map(|npc| self.position_at(npc.id, tick).expect("fixed roster"));
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
        self.consider_guard_watch(tick, supply, &positions);
        self.begin_detour_if_allowed(tick, supply);
    }

    /// A colleague's warning may prompt Rowan to prioritize a nearby
    /// worksite, but ONLY if the current server registry independently
    /// confirms it is unavailable and Rowan is on a clear nearby pilot route.
    /// This never edits the task ledger, site manifest, or patrol coordinates.
    fn consider_guard_watch(
        &mut self,
        tick: u32,
        supply: &NpcSupplyWorld,
        positions: &[NpcState; NPCS.len()],
    ) {
        let Some(guard_index) = NPCS.iter().position(|npc| npc.id == 3) else {
            return;
        };
        let Some(news) = self.worksite_news[guard_index] else {
            return;
        };
        let Some(source_id) = news.source_id else {
            return;
        };
        if news.active
            || news.revision != supply.worksite_revision()
            || tick < news.learned_tick
            || tick < news.event_tick
            || tick - news.event_tick > MEETING_FRESH_TICKS
            || supply.site_is_available(news.site_id) != Some(false)
        {
            return;
        }
        let Some(site) = WORKSITES.iter().find(|site| site.id == news.site_id) else {
            return;
        };
        let guard = positions[guard_index];
        let dx = i32::from(guard.x) - i32::from(site.x);
        let dy = i32::from(guard.y) - i32::from(site.y);
        if dx * dx + dy * dy > GUARD_WATCH_RADIUS * GUARD_WATCH_RADIUS
            || !npc_navigation::pilot_line_of_sight((guard.x, guard.y), (site.x, site.y))
        {
            return;
        }
        if self.guard_watch.is_none() {
            self.guard_watch = Some(GuardSiteWatch {
                site_id: news.site_id,
                revision: news.revision,
                source_id,
                assigned_tick: tick,
            });
        }
    }

    /// Read-only priority watch declaration grounded in a prior in-person
    /// notice, current live site closure, and actual guard/site reach.
    pub fn guard_watch_report(
        &self,
        npc_id: u8,
        tick: u32,
        supply: &NpcSupplyWorld,
    ) -> Option<String> {
        if npc_id != 3 {
            return None;
        }
        let watch = self.guard_watch?;
        if watch.revision != supply.worksite_revision()
            || supply.site_is_available(watch.site_id) != Some(false)
            || tick < watch.assigned_tick
            || tick - watch.assigned_tick > MEETING_FRESH_TICKS
        {
            return None;
        }
        let site = worksite_name(watch.site_id)?;
        let source = NPCS.iter().find(|npc| npc.id == watch.source_id)?.name;
        let movement =
            if self.guard_detour.as_ref().is_some_and(|detour| {
                detour.revision == watch.revision && detour.reversing.is_none()
            }) {
                "I am taking a bounded, pilot-only inspection detour. I have not repaired it."
            } else {
                "I have not repaired it or changed my normal patrol route."
            };
        Some(format!(
            "I marked the {site} for priority attention after {source} told me in person.              The server still confirms it unavailable (revision {}). {movement}",
            watch.revision
        ))
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
        let state = self.position_at(id, tick)?;
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
        let position = self.position_at(id, tick)?;
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
            3 if self.guard_watch_report(3, tick, supply).is_some() => {
                "giving priority attention to a confirmed worksite outage along my existing patrol"
            }
            _ => return self.context(id, tick),
        };
        Some((activity, witnessed))
    }

    /// Mirrors the existing 38-byte pilot marker format, never player combat
    /// entity state. Stationary workers switch to idle after satisfying needs;
    /// walking workers remain marked walking because routes still move.
    pub fn state_packet_with_supply(&self, tick: u32, supply: &NpcSupplyWorld) -> Vec<u8> {
        let mut packet = Vec::with_capacity(8 + NPCS.len() * 6);
        packet.extend_from_slice(&[PROTOCOL_VERSION, STATE_TYPE, NPCS.len() as u8, 0]);
        packet.extend_from_slice(&tick.to_le_bytes());
        for npc in NPCS {
            let state = self.position_at(npc.id, tick).expect("authored NPC ID");
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
        let assigned = NpcRoutines::default().state_packet_with_supply(900, &supply);
        assert_eq!(assigned.len(), original.len());
        assert_eq!(assigned.len(), 38);
        // Before finite demand is satisfied the existing duty state remains.
        assert_eq!(assigned, original);
        for tick in 0..=40_000 {
            supply.advance(tick);
        }
        let idle = NpcRoutines::default().state_packet_with_supply(900, &supply);
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
            NpcRoutines::default().state_packet_with_supply(200, &supply)[8 + 4 * 6 + 5],
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

    #[test]
    fn rowan_marks_verified_outage_for_watch_only_after_tomas_meeting_and_site_recheck() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut town = NpcRoutines::default();
        for tick in 0..=1200 {
            supply.advance(tick);
            town.advance_worksite_social(tick, &supply);
        }
        assert!(town.guard_watch_report(3, 1200, &supply).is_none());
        // Site closure alone does not assign Rowan; he needs the in-person
        // report *and* to be near the actual still-closed site on his route.
        for tick in 1201..=1380 {
            supply.advance(tick);
            town.advance_worksite_social(tick, &supply);
        }
        let watch = town
            .guard_watch_report(3, 1380, &supply)
            .expect("real meet and lookout");
        assert!(watch.contains("after Tomas told me in person"));
        assert!(watch.contains("revision 2"));
        assert!(watch.contains("not repaired"));
        let first = town.guard_watch.unwrap();
        assert_eq!(first.site_id, 2);
        assert_eq!(first.source_id, 5);
        assert_eq!(first.revision, 2);
        town.advance_worksite_social(1380, &supply);
        assert_eq!(town.guard_watch, Some(first));
        assert!(town
            .context_with_supply(3, 1380, &supply)
            .unwrap()
            .0
            .contains("priority attention"));
        assert!(town.guard_watch_report(5, 1380, &supply).is_none());
        assert_eq!(supply.stocks().tomas_water, 1);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn stale_guard_watch_is_cancelled_on_reopening_without_moving_fighters_or_creating_a_repair() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut town = NpcRoutines::default();
        for tick in 0..=1380 {
            supply.advance(tick);
            town.advance_worksite_social(tick, &supply);
        }
        assert!(town.guard_watch.is_some());
        for tick in 1381..=2100 {
            supply.advance(tick);
            town.advance_worksite_social(tick, &supply);
        }
        assert_eq!(supply.worksite_revision(), 3);
        assert!(town.guard_watch.is_none());
        assert!(town.guard_watch_report(3, 2100, &supply).is_none());
        assert!(!town
            .context_with_supply(3, 2100, &supply)
            .unwrap()
            .0
            .contains("priority attention"));
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn forged_hearsay_cannot_cause_guard_assignment_without_live_server_closure_or_proximity() {
        let mut supply = NpcSupplyWorld::default();
        let mut town = NpcRoutines::default();
        town.worksite_news[2] = Some(WorksiteNews {
            event_tick: 60,
            learned_tick: 60,
            revision: 1,
            site_id: 2,
            active: false,
            source_id: Some(5),
        });
        // Even near the staged yard, a forged report about an open site does
        // not count as a decision or update authoritative availability.
        town.advance_worksite_social(120, &supply);
        assert!(town.guard_watch_report(3, 120, &supply).is_none());
        assert!(town.guard_watch.is_none());
        assert_eq!(supply.site_is_available(2), Some(true));
        // A different source update (not originating from user chat) still
        // requires Rowan's physical proximity. Tick 120 is far from yard.
        let mut active = [true; 5];
        active[1] = false;
        supply
            .adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 2, active)
            .unwrap();
        town.worksite_news[2] = Some(WorksiteNews {
            event_tick: 120,
            learned_tick: 120,
            revision: 2,
            site_id: 2,
            active: false,
            source_id: Some(5),
        });
        town.advance_worksite_social(180, &supply);
        assert!(town.guard_watch.is_none());
        assert_eq!(supply.site_is_available(2), Some(false));
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn pilot_detour_moves_rowan_to_server_worksite_and_returns_without_teleport() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1380 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let start = NpcRoutines::position(3, 1380).unwrap();
        assert_eq!(npcs.position_at(3, 1380), Some(start));
        assert!(npcs.guard_detour.is_some());
        let detour = npcs.guard_detour.as_ref().unwrap();
        assert_eq!(detour.revision, 2);
        assert!(detour.route.len() >= 2);
        assert_eq!(detour.route.first().copied(), Some((start.x, start.y)));
        assert_eq!(detour.route.last().copied(), Some((270, 220)));
        assert!(npcs
            .guard_watch_report(3, 1380, &supply)
            .unwrap()
            .contains("pilot-only inspection detour"));
        let initial_supply = supply.stocks();
        for tick in 1381..=1980 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
            let guard = npcs.position_at(3, tick).unwrap();
            assert!(npc_navigation::pilot_line_of_sight(
                (guard.x, guard.y),
                (guard.x, guard.y)
            ));
        }
        let arrived = npcs.position_at(3, 1980).unwrap();
        assert_eq!((arrived.x, arrived.y), (270, 220));
        assert_ne!((arrived.x, arrived.y), (start.x, start.y));
        for tick in 1981..=2100 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        assert_eq!(supply.worksite_revision(), 3);
        assert!(npcs.guard_watch.is_none());
        assert!(npcs.guard_detour.as_ref().unwrap().reversing.is_some());
        for tick in 2101..=2700 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        assert!(npcs.guard_detour.is_none());
        assert_eq!(npcs.position_at(3, 2700), Some(start));
        assert_eq!(npcs.guard_patrol_pause_ticks, 1320);
        // Original authored route resumes with the same local phase that
        // was paused, rather than snapping to its absolute-world-clock site.
        assert_eq!(npcs.position_at(3, 2760), NpcRoutines::position(3, 1440));
        assert_eq!(npcs.position_at(4, 2760), NpcRoutines::position(4, 2760));
        assert_eq!(npcs.position_at(5, 2760), NpcRoutines::position(5, 2760));
        assert_eq!(supply.stocks().well_water, initial_supply.well_water);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn closed_site_without_three_flag_opt_in_cannot_change_guard_patrol_coordinates() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        for tick in 0..=3000 {
            supply.advance(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
            assert_eq!(npcs.position_at(3, tick), NpcRoutines::position(3, tick));
        }
        assert!(npcs.guard_detour.is_none());
        assert_eq!(npcs.guard_patrol_pause_ticks, 0);
    }

    #[test]
    fn early_server_reopening_reverses_before_reaching_site_without_position_jump() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1500 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        assert!(npcs.guard_detour.is_some());
        let departure = NpcRoutines::position(3, 1380).unwrap();
        let at1500 = npcs.position_at(3, 1500).unwrap();
        assert_ne!(at1500, departure);
        let mut flags = [true; 5];
        flags[1] = true; // strictly newer authenticated revision
        supply
            .adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 3, flags)
            .unwrap();
        for tick in 1501..=1560 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let before_retreat = npcs.position_at(3, 1560).unwrap();
        assert_ne!(before_retreat, departure);
        assert!(npcs.guard_detour.as_ref().unwrap().reversing.is_some());
        assert!(npcs.guard_watch.is_none());
        for tick in 1561..=1621 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        assert!(npcs.guard_detour.is_none());
        assert_eq!(npcs.position_at(3, 1621), Some(departure));
        assert_eq!(npcs.guard_patrol_pause_ticks, 241);
        for tick in 1622..=1800 {
            supply.advance(tick);
            npcs.advance_social(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        assert_eq!(npcs.position_at(3, 1740), NpcRoutines::position(3, 1499));
        assert_eq!(npcs.position_at(3, 1800), NpcRoutines::position(3, 1559));
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn optional_detour_replicates_real_guard_position_without_changing_wire_format() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1560 {
            supply.advance(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let frame = npcs.state_packet_with_supply(1560, &supply);
        let old = NpcRoutines::state_packet(1560);
        assert_eq!(frame.len(), 38);
        assert_eq!(&frame[0..8], &old[0..8]);
        let guard = npcs.position_at(3, 1560).unwrap();
        let index = 8 + 2 * 6;
        assert_eq!(
            u16::from_le_bytes(frame[index + 1..index + 3].try_into().unwrap()),
            guard.x
        );
        assert_eq!(
            u16::from_le_bytes(frame[index + 3..index + 5].try_into().unwrap()),
            guard.y
        );
        assert_eq!(frame[index + 5], 1);
        assert_ne!(&frame[index + 1..index + 5], &old[index + 1..index + 5]);
        for npc_index in [0_usize, 1, 3, 4] {
            let offset = 8 + 6 * npc_index;
            assert_eq!(&frame[offset..offset + 5], &old[offset..offset + 5]);
        }
        assert!(npcs
            .guard_watch_report(3, 1560, &supply)
            .unwrap()
            .contains("pilot-only inspection detour"));
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn detour_reverses_on_exact_authoritative_reopening_tick_not_social_cadence() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1500 {
            supply.advance(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let old = npcs.position_at(3, 1500).unwrap();
        assert_eq!(npcs.guard_detour.as_ref().unwrap().route_progress, 120);
        let mut flags = [true; 5];
        flags[1] = true;
        supply
            .adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 3, flags)
            .unwrap();
        supply.advance(1501);
        npcs.advance_pilot_movement(1501, &supply);
        let detour = npcs.guard_detour.as_ref().unwrap();
        assert_eq!(detour.reversing, Some((1501, 120)));
        assert_eq!(detour.route_progress, 120);
        assert_eq!(npcs.position_at(3, 1501), Some(old));
        // Querying a future time does not move an authenticated pilot actor.
        assert_eq!(npcs.position_at(3, 60_000), Some(old));
        // The guard's previous watch answer is immediately invalid even
        // before the next one-second social-memory maintenance tick.
        assert!(npcs.guard_watch_report(3, 1501, &supply).is_none());
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn replayed_skipped_and_future_ticks_cannot_move_detouring_guard() {
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1440 {
            supply.advance(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let before = npcs.position_at(3, 1440).unwrap();
        let progress = npcs.guard_detour.as_ref().unwrap().route_progress;
        npcs.advance_pilot_movement(1450, &supply); // discontinuous request
        npcs.advance_pilot_movement(1440, &supply); // replay
        assert_eq!(npcs.guard_detour.as_ref().unwrap().route_progress, progress);
        assert_eq!(npcs.position_at(3, 1450), Some(before));
        npcs.advance_pilot_movement(1441, &supply);
        assert_eq!(
            npcs.guard_detour.as_ref().unwrap().route_progress,
            progress + 1
        );
        npcs.advance_pilot_movement(1441, &supply); // duplicate
        assert_eq!(
            npcs.guard_detour.as_ref().unwrap().route_progress,
            progress + 1
        );
        npcs.advance_pilot_movement(1442, &supply);
        assert_eq!(
            npcs.guard_detour.as_ref().unwrap().route_progress,
            progress + 2
        );
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn chat_proximity_follows_rowans_actual_opt_in_detour_not_ghost_patrol() {
        use crate::living_world::{ChatError, SPEAK_RADIUS};
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut moving = NpcRoutines::default();
        moving.enable_pilot_guard_detours();
        let mut ordinary = NpcRoutines::default();
        for tick in 0..=1980 {
            supply.advance(tick);
            moving.advance_pilot_movement(tick, &supply);
            moving.advance_worksite_social(tick, &supply);
            ordinary.advance_worksite_social(tick, &supply);
        }
        assert_eq!(SPEAK_RADIUS, 180.0);
        assert_eq!(supply.worksite_revision(), 2);
        assert!(moving.guard_detour.is_some());
        let actual = moving.position_at(3, 1980).unwrap();
        let original = NpcRoutines::position(3, 1980).unwrap();
        assert_eq!((actual.x, actual.y), (270, 220));
        assert_eq!((original.x, original.y), (155, 205));

        // A player at the *real detouring* NPC can speak, despite the
        // original static schedule now being >180 units away. The unobstructed
        // approach is 175 units from the real detouring Rowan.
        let npc = moving.speaking_target(3, 1980, 270.0, 45.0, true).unwrap();
        assert_eq!(npc.id, 3);
        assert_eq!(
            ordinary
                .speaking_target(3, 1980, 270.0, 45.0, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );

        // The converse: a player near the abandoned patrol coordinate
        // cannot address Rowan through a phantom duplicate of himself.
        assert_eq!(
            moving
                .speaking_target(3, 1980, 60.0, 205.0, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        assert!(ordinary.speaking_target(3, 1980, 60.0, 205.0, true).is_ok());

        // The actual location is the exact server-replicated type-8
        // coordinate, with no second client-inferred movement source.
        let frame = moving.state_packet_with_supply(1980, &supply);
        let index = 8 + 2 * 6;
        assert_eq!(
            u16::from_le_bytes([frame[index + 1], frame[index + 2]]),
            actual.x
        );
        assert_eq!(
            u16::from_le_bytes([frame[index + 3], frame[index + 4]]),
            actual.y
        );
        assert_eq!(moving.position_at(3, 1980), Some(actual));
    }

    #[test]
    fn chat_range_keeps_dead_unknown_and_invalid_player_checks_during_detour() {
        use crate::living_world::ChatError;
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut moving = NpcRoutines::default();
        moving.enable_pilot_guard_detours();
        for tick in 0..=1560 {
            supply.advance(tick);
            moving.advance_pilot_movement(tick, &supply);
            moving.advance_worksite_social(tick, &supply);
        }
        let actual = moving.position_at(3, 1560).unwrap();
        assert_eq!(
            moving
                .speaking_target(3, 1560, f32::from(actual.x), f32::from(actual.y), false)
                .unwrap_err(),
            ChatError::Dead
        );
        assert_eq!(
            moving
                .speaking_target(3, 1560, f32::NAN, f32::from(actual.y), true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        assert_eq!(
            moving
                .speaking_target(3, 1560, 0.0, f32::INFINITY, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        assert_eq!(
            moving
                .speaking_target(99, 1560, f32::from(actual.x), f32::from(actual.y), true)
                .unwrap_err(),
            ChatError::UnknownNpc
        );
        assert!(moving
            .speaking_target(3, 1560, f32::from(actual.x), f32::from(actual.y), true)
            .is_ok());
        assert_eq!(supply.stocks().tomas_water, 1);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn resumed_patrol_restores_chat_proximity_after_authoritative_site_reopening() {
        use crate::living_world::ChatError;
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut moving = NpcRoutines::default();
        moving.enable_pilot_guard_detours();
        for tick in 0..=2700 {
            supply.advance(tick);
            moving.advance_pilot_movement(tick, &supply);
            moving.advance_worksite_social(tick, &supply);
        }
        assert_eq!(supply.worksite_revision(), 3);
        assert!(moving.guard_detour.is_none());
        let departure = NpcRoutines::position(3, 1380).unwrap();
        assert_eq!(moving.position_at(3, 2700), Some(departure));
        assert!(moving
            .speaking_target(
                3,
                2700,
                f32::from(departure.x) - 179.0,
                f32::from(departure.y),
                true
            )
            .is_ok());
        assert_eq!(
            moving
                .speaking_target(3, 2700, 449.0, 220.0, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        assert_eq!(
            supply.stocks().well_water + supply.stocks().tomas_water + supply.stocks().yard_water,
            8
        );
    }

    #[test]
    fn pilot_chat_rejects_hidden_npcs_even_when_within_speaking_radius() {
        use crate::living_world::{ChatError, SPEAK_RADIUS};
        let npcs = NpcRoutines::default();
        assert_eq!(SPEAK_RADIUS, 180.0);
        // Rowan's default route starts west of a 35x35 watch barricade.
        // This player is merely 90 world units away, but a pilot wall
        // cuts across the line between them.
        assert_eq!(
            npcs.speaking_target(3, 0, 245.0, 205.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
        assert!(npcs.speaking_target(3, 0, 155.0, 100.0, true).is_ok());
        // The supply crate blocks a nearby approach to Tomas.
        assert_eq!(
            npcs.speaking_target(5, 0, 325.0, 220.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
        assert!(npcs.speaking_target(5, 0, 270.0, 160.0, true).is_ok());
        // The market stall likewise blocks an apparent shortcut to Elara.
        assert_eq!(
            npcs.speaking_target(4, 0, 395.0, 110.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
        assert!(npcs.speaking_target(4, 0, 315.0, 65.0, true).is_ok());
        // Reject an invalid negative fighter position instead of creating a
        // saturated pilot grid coordinate from a float-to-u16 cast.
        assert_eq!(
            npcs.speaking_target(3, 0, -1.0, 205.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
    }

    #[test]
    fn detouring_rowan_requires_both_current_location_and_clear_line_of_sight() {
        use crate::living_world::ChatError;
        let mut supply = NpcSupplyWorld::default();
        supply.enable_pilot_maintenance();
        let mut npcs = NpcRoutines::default();
        npcs.enable_pilot_guard_detours();
        for tick in 0..=1980 {
            supply.advance(tick);
            npcs.advance_pilot_movement(tick, &supply);
            npcs.advance_worksite_social(tick, &supply);
        }
        let actual = npcs.position_at(3, 1980).unwrap();
        assert_eq!((actual.x, actual.y), (270, 220));
        // 90 units away, but the crate at x294..318 occludes speaking.
        assert_eq!(
            npcs.speaking_target(3, 1980, 360.0, 220.0, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        // 175 units away and on a clear vertical approach.
        assert!(npcs.speaking_target(3, 1980, 270.0, 45.0, true).is_ok());
        // The guard's abandoned static position is not an alternate target.
        assert_eq!(
            npcs.speaking_target(3, 1980, 60.0, 205.0, true)
                .unwrap_err(),
            ChatError::OutOfRange
        );
        // An unsuccessful request has not moved NPCs or spent carried water.
        assert_eq!(npcs.position_at(3, 1980), Some(actual));
        assert_eq!(supply.stocks().tomas_water, 1);
        assert!(supply.stocks().conserved());
    }

    #[test]
    fn chat_cannot_authorize_obstacle_corner_crossings_between_coarse_samples() {
        use crate::living_world::ChatError;
        let npcs = NpcRoutines::default();
        let previously_missed = [
            (3_u8, (257.174_f32, 142.377_f32)), // Rowan: watch barricade
            (5, (178.291, 129.519)),            // Tomas: watch barricade
            (4, (369.496, 182.511)),            // Elara: market stall
        ];
        for (id, (player_x, player_y)) in previously_missed {
            assert_eq!(
                npcs.speaking_target(id, 0, player_x, player_y, true)
                    .unwrap_err(),
                ChatError::OutOfRange,
                "server speaking authority must not pierce a pilot obstacle"
            );
        }
        assert!(npcs.speaking_target(3, 0, 155.0, 100.0, true).is_ok());
        assert!(npcs.speaking_target(5, 0, 270.0, 160.0, true).is_ok());
        assert!(npcs.speaking_target(4, 0, 315.0, 65.0, true).is_ok());
    }
}
