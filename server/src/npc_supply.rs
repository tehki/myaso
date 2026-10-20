//! LW-1C local-only micro-world: bounded NPC-to-NPC supply transfers.
//! No player inventory, money, crafting entitlement, persistence, or client mutation.
use crate::{npc_worksites, PROTOCOL_VERSION};
use std::collections::VecDeque;

pub const SUPPLY_PACKET_TYPE: u8 = 9;
const CYCLE: u32 = 2_400;
const PICKUP: u32 = 600;
const DROP_OFF: u32 = 1_800;
const FORGE: u32 = 300;
const HISTORY_LIMIT: usize = 12;
const COMPLETED_WORK_TTL_TICKS: u32 = 120 * 60;
const WATER_TOTAL: u16 = 8;
const FOOD_TOTAL: u16 = 8;
const IRON_TOTAL: u16 = 6;

// Explicit demo-only demand targets. Reserves are kept untouched so
// the NPC pilot cannot consume all world inputs on a fixed timer.
const TARGET_YARD_WATER: u8 = 4;
const TARGET_MARKET_FOOD: u8 = 4;
const TARGET_FORGE_NAILS: u8 = 3;
// LW-1N opt-in deterministic loopback-only event fixture. This is a
// staged maintenance outage, not player damage or actual world collision.
const MAINTENANCE_CLOSE_TICK: u32 = 900;
const MAINTENANCE_REOPEN_TICK: u32 = 2100;
const WORK_YARD_CLOSED: [bool; npc_worksites::WORKSITES.len()] = [true, false, true, true, true];

/// An NPC's decision is recomputed only from conserved server stocks;
/// a chat request can read it but never submit or execute it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkDecision {
    Rest,
    ForgeNails,
    CollectWater,
    DeliverWater,
    CollectFood,
    DeliverFood,
}

impl WorkDecision {
    pub const fn description(self) -> &'static str {
        match self {
            Self::Rest => "resting: no currently feasible settlement task",
            Self::ForgeNails => "forging a needed bundle of nails",
            Self::CollectWater => "collecting water for the work yard",
            Self::DeliverWater => "delivering carried water to the work yard",
            Self::CollectFood => "collecting provisions for the market",
            Self::DeliverFood => "delivering carried provisions to the market",
        }
    }
}

/// All containers belong to the server's pilot world; players cannot edit them.
/// Water and food move without changing totals. Iron becomes nails at 1:1.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SupplyStocks {
    pub well_water: u8,
    pub tomas_water: u8,
    pub yard_water: u8,
    pub depot_food: u8,
    pub elara_food: u8,
    pub stall_food: u8,
    pub forge_iron: u8,
    pub forge_nails: u8,
}
impl Default for SupplyStocks {
    fn default() -> Self {
        Self {
            well_water: WATER_TOTAL as u8,
            tomas_water: 0,
            yard_water: 0,
            depot_food: FOOD_TOTAL as u8,
            elara_food: 0,
            stall_food: 0,
            forge_iron: IRON_TOTAL as u8,
            forge_nails: 0,
        }
    }
}
impl SupplyStocks {
    pub fn conserved(&self) -> bool {
        u16::from(self.well_water) + u16::from(self.tomas_water) + u16::from(self.yard_water)
            == WATER_TOTAL
            && u16::from(self.depot_food) + u16::from(self.elara_food) + u16::from(self.stall_food)
                == FOOD_TOTAL
            && u16::from(self.forge_iron) + u16::from(self.forge_nails) == IRON_TOTAL
    }

    pub fn wire(&self) -> [u8; 8] {
        [
            self.well_water,
            self.tomas_water,
            self.yard_water,
            self.depot_food,
            self.elara_food,
            self.stall_food,
            self.forge_iron,
            self.forge_nails,
        ]
    }
}

/// A bounded source-of-truth audit of simulated NPC-only movements.
/// Each event is appended only after a verified server-owned stock mutation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SupplyEvent {
    pub tick: u32,
    pub sequence: u32,
    pub actor: u8,
    pub operation: u8,
    /// Server worldsite authority revision that permitted this mutation.
    /// Audit-only, never a browser command or player-reward entitlement.
    pub worksite_revision: u32,
}

#[derive(Debug, Clone)]
pub struct NpcSupplyWorld {
    stocks: SupplyStocks,
    history: VecDeque<SupplyEvent>,
    last_step: Option<u32>,
    sequence: u32,
    sites: npc_worksites::WorksiteAuthority,
    pilot_maintenance: bool,
}

impl Default for NpcSupplyWorld {
    fn default() -> Self {
        Self {
            stocks: SupplyStocks::default(),
            history: VecDeque::with_capacity(HISTORY_LIMIT),
            last_step: None,
            sequence: 0,
            sites: npc_worksites::WorksiteAuthority::default(),
            pilot_maintenance: false,
        }
    }
}

impl NpcSupplyWorld {
    pub fn stocks(&self) -> SupplyStocks {
        self.stocks
    }

    pub fn history(&self) -> &VecDeque<SupplyEvent> {
        &self.history
    }

    /// Future server-owned Moonvale worksite changes, independent of combat
    /// geometry. No incoming chat, player datagram or browser route calls it.
    pub fn adopt_server_worksites(
        &mut self,
        zone: crate::zone::ZoneId,
        version: u16,
        revision: u32,
        active: [bool; npc_worksites::WORKSITES.len()],
    ) -> Result<(), npc_worksites::WorksiteRevisionError> {
        self.sites
            .adopt_server_manifest(zone, version, revision, active)
    }

    pub fn worksite_revision(&self) -> u32 {
        self.sites.revision()
    }

    /// Called only by the loopback server startup with a separate opt-in flag.
    /// It never grants client-side authority and cannot persist or mint stock.
    pub fn enable_pilot_maintenance(&mut self) {
        self.pilot_maintenance = true;
    }

    fn advance_pilot_maintenance(&mut self, tick: u32) {
        if !self.pilot_maintenance {
            return;
        }
        // Fail closed if a real trusted source has already advanced the object
        // revision or changed any sites: never override another authority.
        match tick {
            MAINTENANCE_CLOSE_TICK
                if self.sites.revision() == 1
                    && self.sites.active_flags() == [true; npc_worksites::WORKSITES.len()] =>
            {
                let _ = self.adopt_server_worksites(
                    crate::zone::ZoneId::Moonvale,
                    1,
                    2,
                    WORK_YARD_CLOSED,
                );
            }
            MAINTENANCE_REOPEN_TICK
                if self.sites.revision() == 2 && self.sites.active_flags() == WORK_YARD_CLOSED =>
            {
                let _ = self.adopt_server_worksites(
                    crate::zone::ZoneId::Moonvale,
                    1,
                    3,
                    [true; npc_worksites::WORKSITES.len()],
                );
            }
            _ => {}
        }
    }

    pub fn worksite_status_packet(&self) -> [u8; 12] {
        self.sites.status_packet()
    }

    /// Finite, need-driven assignment with deterministic profession ownership.
    /// Inventory already in transit is reserved against demand to prevent
    /// over-collection; delivery of carried goods always takes precedence.
    pub fn decision(&self, actor: u8) -> WorkDecision {
        let s = self.stocks;
        match actor {
            2 if s.forge_iron > 0
                && s.forge_nails < TARGET_FORGE_NAILS
                && self.sites.active_for(2, 5) =>
            {
                WorkDecision::ForgeNails
            }
            5 if s.tomas_water > 0 && self.sites.active_for(5, 2) => WorkDecision::DeliverWater,
            5 if s.well_water > 0
                && self.sites.active_for(5, 1)
                && self.sites.active_for(5, 2)
                && s.yard_water.saturating_add(s.tomas_water) < TARGET_YARD_WATER =>
            {
                WorkDecision::CollectWater
            }
            4 if s.elara_food > 0 && self.sites.active_for(4, 4) => WorkDecision::DeliverFood,
            4 if s.depot_food > 0
                && self.sites.active_for(4, 3)
                && self.sites.active_for(4, 4)
                && s.stall_food.saturating_add(s.elara_food) < TARGET_MARKET_FOOD =>
            {
                WorkDecision::CollectFood
            }
            _ => WorkDecision::Rest,
        }
    }

    /// Concise ordered summary of genuine shortages and finite constraints.
    /// Read-only; none of these tasks can become a player job or reward.
    pub fn needs_report(&self) -> String {
        let s = self.stocks;
        let mut shortages = [
            (
                "yard water",
                TARGET_YARD_WATER.saturating_sub(s.yard_water),
                s.well_water,
                5,
            ),
            (
                "market provisions",
                TARGET_MARKET_FOOD.saturating_sub(s.stall_food),
                s.depot_food,
                4,
            ),
            (
                "forge nails",
                TARGET_FORGE_NAILS.saturating_sub(s.forge_nails),
                s.forge_iron,
                2,
            ),
        ];
        // Three constant-sized needs, ranked by largest observed shortfall.
        shortages.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.3.cmp(&b.3)));
        let mut summary = String::from("Settlement priorities (NPC simulation only): ");
        let mut first = true;
        for (name, deficit, available, actor) in shortages {
            if deficit == 0 {
                continue;
            }
            if !first {
                summary.push_str("; ");
            }
            first = false;
            let assignment = self.decision(actor);
            let label = if assignment != WorkDecision::Rest {
                assignment.description()
            } else if available == 0 {
                "blocked: source empty"
            } else {
                "blocked: required worksite unavailable"
            };
            summary.push_str(&format!("{name}: {deficit} still needed ({label})"));
        }
        if first {
            summary.push_str("all finite demand targets met; no new tasks");
        }
        summary.push_str(". No player contracts or payments.");
        summary
    }

    /// Invoked by the server world clock, never by chat or a client command.
    /// The simulation advances one authoritative tick at a time. Repetition
    /// and discontinuous call sequences fail closed, not duplicating stock.
    pub fn advance(&mut self, tick: u32) {
        if let Some(last) = self.last_step {
            let elapsed = tick.wrapping_sub(last);
            if elapsed != 1 {
                return;
            }
        }
        self.last_step = Some(tick);
        if tick == 0 {
            return;
        }
        self.advance_pilot_maintenance(tick);
        match tick % CYCLE {
            FORGE => {
                if self.decision(2) == WorkDecision::ForgeNails && self.sites.allows(2, 5, tick) {
                    self.stocks.forge_iron -= 1;
                    self.stocks.forge_nails += 1;
                    self.record(tick, 2, 5);
                }
            }
            PICKUP => {
                if self.decision(5) == WorkDecision::CollectWater && self.sites.allows(5, 1, tick) {
                    self.stocks.well_water -= 1;
                    self.stocks.tomas_water += 1;
                    self.record(tick, 5, 1);
                }
                if self.decision(4) == WorkDecision::CollectFood && self.sites.allows(4, 3, tick) {
                    self.stocks.depot_food -= 1;
                    self.stocks.elara_food += 1;
                    self.record(tick, 4, 3);
                }
            }
            DROP_OFF => {
                if self.decision(5) == WorkDecision::DeliverWater && self.sites.allows(5, 2, tick) {
                    self.stocks.tomas_water -= 1;
                    self.stocks.yard_water += 1;
                    self.record(tick, 5, 2);
                }
                if self.decision(4) == WorkDecision::DeliverFood && self.sites.allows(4, 4, tick) {
                    self.stocks.elara_food -= 1;
                    self.stocks.stall_food += 1;
                    self.record(tick, 4, 4);
                }
            }
            _ => {}
        }
        debug_assert!(self.stocks.conserved());
    }

    fn record(&mut self, tick: u32, actor: u8, operation: u8) {
        self.sequence = self.sequence.wrapping_add(1);
        if self.history.len() == HISTORY_LIMIT {
            self.history.pop_front();
        }
        self.history.push_back(SupplyEvent {
            tick,
            sequence: self.sequence,
            actor,
            operation,
            worksite_revision: self.sites.revision(),
        });
    }

    /// 22-byte reliable snapshot. No personal data or player-world authority.
    /// Header: protocol(1), type(1), reserved(2), tick(4), seq(4).
    /// Then 8 immutable-order stock counts and the last action's actor/kind.
    pub fn packet(&self, tick: u32) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(22);
        bytes.extend_from_slice(&[PROTOCOL_VERSION, SUPPLY_PACKET_TYPE, 0, 0]);
        bytes.extend_from_slice(&tick.to_le_bytes());
        bytes.extend_from_slice(&self.sequence.to_le_bytes());
        bytes.extend_from_slice(&self.stocks.wire());
        let recent = self.history.back().copied();
        bytes.push(recent.map_or(0, |event| event.actor));
        bytes.push(recent.map_or(0, |event| event.operation));
        bytes
    }

    /// A verified, read-only proof of the most recent *completed* NPC task.
    /// Collection alone is not delivery. Every line comes from a committed
    /// stock mutation, never from an NPC chat request or model output.
    pub fn recent_completed_work(&self, tick: u32) -> Option<String> {
        self.history.iter().rev().find_map(|event| {
            if tick.wrapping_sub(event.tick) > COMPLETED_WORK_TTL_TICKS {
                return None;
            }
            let outcome = match (event.actor, event.operation) {
                (2, 5) => "Marta forged one bundle of nails from available iron",
                (5, 2) => "Tomas delivered one water bucket to the work yard",
                (4, 4) => "Elara delivered one ration to the market stall",
                // Picking up stock is not a completed delivery.
                _ => return None,
            };
            Some(format!(
                "The settlement ledger confirms: {outcome} (task #{}, server tick {}). This is an NPC task, not a player contract.",
                event.sequence, event.tick
            ))
        })
    }

    pub fn report(&self, npc_id: u8) -> Option<String> {
        let stocks = self.stocks;
        match npc_id {
            1 => Some(format!(
                "The yard has {} water buckets. We have no player trade ledger yet.",
                stocks.yard_water
            )),
            2 => Some(format!(
                "The forge has {} iron bars and {} {} of nails, from verified work.",
                stocks.forge_iron,
                stocks.forge_nails,
                if stocks.forge_nails == 1 {
                    "bundle"
                } else {
                    "bundles"
                }
            )),
            4 => Some(format!(
                "The supply depot holds {} rations; the market stall holds {}.",
                stocks.depot_food, stocks.stall_food
            )),
            5 => Some(format!(
                "The well holds {} buckets, I carry {}, and the yard holds {}.",
                stocks.well_water, stocks.tomas_water, stocks.yard_water
            )),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run_until(world: &mut NpcSupplyWorld, from: u32, to: u32) {
        for tick in from..=to {
            world.advance(tick);
        }
    }

    #[test]
    fn every_operation_is_server_scheduled_and_conserves_resources() {
        let mut world = NpcSupplyWorld::default();
        assert_eq!(world.stocks().wire(), [8, 0, 0, 8, 0, 0, 6, 0]);
        run_until(&mut world, 0, 299);
        assert_eq!(world.history().len(), 0);
        world.advance(300);
        assert_eq!(world.stocks().forge_nails, 1);
        assert_eq!(world.stocks().forge_iron, 5);
        run_until(&mut world, 301, 599);
        world.advance(600);
        assert_eq!(world.stocks().tomas_water, 1);
        assert_eq!(world.stocks().elara_food, 1);
        assert_eq!(world.stocks().well_water, 7);
        assert_eq!(world.stocks().depot_food, 7);
        run_until(&mut world, 601, 1800);
        assert_eq!(world.stocks().tomas_water, 0);
        assert_eq!(world.stocks().yard_water, 1);
        assert_eq!(world.stocks().elara_food, 0);
        assert_eq!(world.stocks().stall_food, 1);
        assert!(world.stocks().conserved());
        assert_eq!(world.history().back().unwrap().operation, 4);
    }

    #[test]
    fn repeated_skipped_ticks_cannot_duplicate_or_inflate_stocks() {
        let mut world = NpcSupplyWorld::default();
        run_until(&mut world, 0, 600);
        let before = world.stocks();
        let events = world.history().len();
        world.advance(600);
        world.advance(1_800);
        assert_eq!(world.stocks(), before);
        assert_eq!(world.history().len(), events);
        assert!(world.stocks().conserved());
    }

    #[test]
    fn finite_demand_preserves_reserves_and_history_is_bounded() {
        let mut world = NpcSupplyWorld::default();
        run_until(&mut world, 0, 40_000);
        let stock = world.stocks();
        assert_eq!(stock.well_water, 4);
        assert_eq!(stock.yard_water, TARGET_YARD_WATER);
        assert_eq!(stock.depot_food, 4);
        assert_eq!(stock.stall_food, TARGET_MARKET_FOOD);
        assert_eq!(stock.forge_iron, 3);
        assert_eq!(stock.forge_nails, TARGET_FORGE_NAILS);
        assert!(stock.conserved());
        assert_eq!(world.history().len(), HISTORY_LIMIT);
        assert!(world
            .history()
            .iter()
            .all(|event| event.actor == 2 || event.actor == 4 || event.actor == 5));
        run_until(&mut world, 40_001, 45_000);
        assert_eq!(world.stocks(), stock);
    }

    #[test]
    fn compact_wire_has_explicit_provenance_and_known_size() {
        let mut world = NpcSupplyWorld::default();
        let before = world.packet(0);
        assert_eq!(
            before,
            [1, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 6, 0, 0, 0]
        );
        run_until(&mut world, 0, 300);
        let packet = world.packet(300);
        assert_eq!(packet.len(), 22);
        assert_eq!(&packet[0..4], &[1, 9, 0, 0]);
        assert_eq!(&packet[8..12], &[1, 0, 0, 0]);
        assert_eq!(&packet[20..], &[2, 5]);
        assert!(world.report(2).unwrap().contains("1 bundle of nails"));
        assert!(world.report(3).is_none());
    }
    #[test]
    fn work_proofs_are_only_from_committed_completed_inventory_tasks() {
        let mut town = NpcSupplyWorld::default();
        assert!(town.recent_completed_work(0).is_none());
        run_until(&mut town, 0, 300);
        let proof = town
            .recent_completed_work(300)
            .expect("forge action committed");
        assert!(proof.contains("Marta forged one bundle of nails"));
        assert!(proof.contains("task #1, server tick 300"));
        let before = town.stocks();
        assert_eq!(town.recent_completed_work(300).unwrap(), proof);
        assert_eq!(town.stocks(), before);

        run_until(&mut town, 301, 600);
        // Collection is not a completed delivery, so Marta remains the
        // most recent confirmed completed task at tick 600.
        assert!(town
            .recent_completed_work(600)
            .unwrap()
            .contains("Marta forged"));
        run_until(&mut town, 601, 1800);
        let delivered = town.recent_completed_work(1800).unwrap();
        assert!(delivered.contains("Elara delivered one ration to the market stall"));
        assert!(delivered.contains("task #5, server tick 1800"));
        assert_eq!(town.stocks().stall_food, 1);
        assert_eq!(town.stocks().yard_water, 1);
        assert!(town.stocks().conserved());

        // This conversation fact is time-bounded; historical state remains
        // available to the simulation but is not presented as recent news.
        assert!(town
            .recent_completed_work(1800 + COMPLETED_WORK_TTL_TICKS + 1)
            .is_none());
    }

    #[test]
    fn no_completed_delivery_is_fabricated_from_pickup_only() {
        let mut town = NpcSupplyWorld::default();
        town.record(600, 5, 1);
        town.record(600, 4, 3);
        assert!(town.recent_completed_work(600).is_none());
        // Unknown op/actor combinations are not independently trusted.
        town.record(601, 5, 4);
        assert!(town.recent_completed_work(601).is_none());
    }

    #[test]
    fn actors_select_feasible_work_from_live_demand_and_reserve_in_transit() {
        let mut world = NpcSupplyWorld::default();
        assert_eq!(world.decision(2), WorkDecision::ForgeNails);
        assert_eq!(world.decision(4), WorkDecision::CollectFood);
        assert_eq!(world.decision(5), WorkDecision::CollectWater);
        assert_eq!(world.decision(1), WorkDecision::Rest);
        assert!(world
            .needs_report()
            .contains("market provisions: 4 still needed"));
        assert!(world.needs_report().contains("yard water: 4 still needed"));
        run_until(&mut world, 0, 600);
        assert_eq!(world.decision(2), WorkDecision::ForgeNails);
        assert_eq!(world.decision(4), WorkDecision::DeliverFood);
        assert_eq!(world.decision(5), WorkDecision::DeliverWater);
        assert!(world.needs_report().contains("delivering carried water"));
        assert!(world
            .needs_report()
            .contains("delivering carried provisions"));
        assert_eq!(world.stocks().yard_water, 0);
        assert_eq!(world.stocks().stall_food, 0);
        run_until(&mut world, 601, 1800);
        assert_eq!(world.decision(4), WorkDecision::CollectFood);
        assert_eq!(world.decision(5), WorkDecision::CollectWater);
        assert_eq!(world.stocks().yard_water, 1);
        assert_eq!(world.stocks().stall_food, 1);
        assert!(world.stocks().conserved());
    }

    #[test]
    fn workers_stop_after_feasible_goals_and_preserve_finite_reserves() {
        let mut world = NpcSupplyWorld::default();
        run_until(&mut world, 0, 40_000);
        assert_eq!(world.decision(2), WorkDecision::Rest);
        assert_eq!(world.decision(4), WorkDecision::Rest);
        assert_eq!(world.decision(5), WorkDecision::Rest);
        let stocks = world.stocks();
        assert_eq!(stocks.wire(), [4, 0, 4, 4, 0, 4, 3, 3]);
        assert!(world
            .needs_report()
            .contains("all finite demand targets met"));
        let count = world.history().back().unwrap().sequence;
        run_until(&mut world, 40_001, 120_000);
        assert_eq!(world.stocks(), stocks);
        assert_eq!(world.history().back().unwrap().sequence, count);
        assert!(world.stocks().conserved());
    }

    #[test]
    fn chat_need_queries_cannot_commit_a_supply_action() {
        let world = NpcSupplyWorld::default();
        let old = world.stocks();
        let plan = world.needs_report();
        let decision = world.decision(5);
        assert!(plan.contains("No player contracts or payments"));
        assert_eq!(decision, WorkDecision::CollectWater);
        assert_eq!(world.stocks(), old);
        assert!(world.history().is_empty());
    }

    #[test]
    fn unavailable_destination_blocks_pickup_without_inventing_task_or_losing_cargo() {
        use crate::zone::ZoneId;
        let mut town = NpcSupplyWorld::default();
        let mut flags = [true; npc_worksites::WORKSITES.len()];
        flags[1] = false; // Work yard missing: do not pick up well water.
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 2, flags)
            .unwrap();
        run_until(&mut town, 0, 600);
        assert_eq!(town.decision(5), WorkDecision::Rest);
        assert_eq!(town.stocks().well_water, 8);
        assert_eq!(town.stocks().tomas_water, 0);
        assert_eq!(town.stocks().yard_water, 0);
        assert!(town
            .needs_report()
            .contains("blocked: required worksite unavailable"));
        assert!(town.history().iter().all(|record| record.actor != 5));
        assert!(town.stocks().conserved());

        // Restore the destination, then collect at the NEXT authorized pickup
        // tick; a prior skipped phase never becomes a catch-up teleport.
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 3, [true; 5])
            .unwrap();
        run_until(&mut town, 601, 2999);
        assert_eq!(town.stocks().well_water, 8);
        town.advance(3000);
        assert_eq!(town.stocks().well_water, 7);
        assert_eq!(town.stocks().tomas_water, 1);

        // A destination closes after collection. The bucket remains with Tomas
        // even after arriving at the old worksite; no task is credited.
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 4, flags)
            .unwrap();
        run_until(&mut town, 3001, 4200);
        assert_eq!(town.stocks().tomas_water, 1);
        assert_eq!(town.stocks().yard_water, 0);
        assert_eq!(town.decision(5), WorkDecision::Rest);
        assert!(town
            .history()
            .iter()
            .all(|record| !(record.actor == 5 && record.operation == 2)));
        assert!(town.stocks().conserved());

        // An old revision may not re-open the site. Only a newer authoritative
        // snapshot allows exactly one eventual on-site handoff.
        assert_eq!(
            town.adopt_server_worksites(ZoneId::Moonvale, 1, 3, [true; 5]),
            Err(npc_worksites::WorksiteRevisionError::StaleRevision)
        );
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 5, [true; 5])
            .unwrap();
        run_until(&mut town, 4201, 6600);
        assert_eq!(town.stocks().well_water, 7);
        assert_eq!(town.stocks().tomas_water, 0);
        assert_eq!(town.stocks().yard_water, 1);
        assert_eq!(
            town.history()
                .iter()
                .filter(|event| event.actor == 5 && event.operation == 2)
                .count(),
            1
        );
        assert_eq!(
            town.history()
                .iter()
                .find(|event| event.actor == 5 && event.operation == 2)
                .unwrap()
                .worksite_revision,
            5
        );
        assert!(town.stocks().conserved());
    }

    #[test]
    fn revoked_forge_can_resume_on_new_server_revision_only() {
        use crate::zone::ZoneId;
        let mut town = NpcSupplyWorld::default();
        let mut flags = [true; npc_worksites::WORKSITES.len()];
        flags[4] = false; // Forge physically unavailable.
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 2, flags)
            .unwrap();
        run_until(&mut town, 0, 300);
        assert_eq!(town.stocks().forge_iron, 6);
        assert_eq!(town.stocks().forge_nails, 0);
        assert!(!town.history().iter().any(|event| event.actor == 2));
        assert_eq!(town.decision(2), WorkDecision::Rest);
        assert!(town
            .needs_report()
            .contains("blocked: required worksite unavailable"));
        town.adopt_server_worksites(ZoneId::Moonvale, 1, 3, [true; 5])
            .unwrap();
        run_until(&mut town, 301, 2700);
        assert_eq!(town.stocks().forge_iron, 5);
        assert_eq!(town.stocks().forge_nails, 1);
        assert_eq!(
            town.history()
                .iter()
                .filter(|event| event.actor == 2)
                .count(),
            1
        );
        assert!(town.stocks().conserved());
    }

    #[test]
    fn pilot_maintenance_live_clock_closes_and_restores_workyard_without_lost_cargo() {
        let mut town = NpcSupplyWorld::default();
        town.enable_pilot_maintenance();
        assert_eq!(town.worksite_revision(), 1);
        assert_eq!(town.worksite_status_packet()[8], 31);
        run_until(&mut town, 0, 600);
        assert_eq!(town.stocks().tomas_water, 1);
        assert_eq!(town.stocks().well_water, 7);
        assert_eq!(town.worksite_revision(), 1);

        run_until(&mut town, 601, MAINTENANCE_CLOSE_TICK);
        assert_eq!(town.worksite_revision(), 2);
        assert_eq!(
            town.worksite_status_packet(),
            [1, 12, 1, 0, 2, 0, 0, 0, 29, 0, 0, 0]
        );
        assert_eq!(town.decision(5), WorkDecision::Rest);
        assert!(town
            .needs_report()
            .contains("blocked: required worksite unavailable"));
        run_until(&mut town, MAINTENANCE_CLOSE_TICK + 1, 1800);
        assert_eq!(town.stocks().tomas_water, 1);
        assert_eq!(town.stocks().yard_water, 0);
        assert_eq!(
            town.history()
                .iter()
                .filter(|e| e.actor == 5 && e.operation == 2)
                .count(),
            0
        );

        run_until(&mut town, 1801, MAINTENANCE_REOPEN_TICK);
        assert_eq!(town.worksite_revision(), 3);
        assert_eq!(
            town.worksite_status_packet(),
            [1, 12, 1, 0, 3, 0, 0, 0, 31, 0, 0, 0]
        );
        assert_eq!(town.decision(5), WorkDecision::DeliverWater);
        run_until(&mut town, MAINTENANCE_REOPEN_TICK + 1, 4200);
        assert_eq!(town.stocks().yard_water, 1);
        assert_eq!(town.stocks().tomas_water, 0);
        assert_eq!(town.stocks().well_water, 7);
        let deliveries: Vec<_> = town
            .history()
            .iter()
            .filter(|e| e.actor == 5 && e.operation == 2)
            .collect();
        assert_eq!(deliveries.len(), 1);
        assert_eq!(deliveries[0].tick, 4200);
        assert_eq!(deliveries[0].worksite_revision, 3);
        assert!(town.stocks().conserved());
    }

    #[test]
    fn pilot_maintenance_disabled_by_default_and_never_overrides_other_authority() {
        let mut disabled = NpcSupplyWorld::default();
        run_until(&mut disabled, 0, MAINTENANCE_REOPEN_TICK);
        assert_eq!(disabled.worksite_revision(), 1);
        assert_eq!(disabled.stocks().yard_water, 1);
        assert_eq!(disabled.worksite_status_packet()[8], 31);

        let mut third_party = NpcSupplyWorld::default();
        third_party.enable_pilot_maintenance();
        let custom = [false, true, true, true, true];
        third_party
            .adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 2, custom)
            .unwrap();
        run_until(&mut third_party, 0, MAINTENANCE_REOPEN_TICK);
        assert_eq!(third_party.worksite_revision(), 2);
        assert_eq!(third_party.worksite_status_packet()[8], 30);
        assert!(third_party.stocks().conserved());

        let mut superseded = NpcSupplyWorld::default();
        superseded.enable_pilot_maintenance();
        run_until(&mut superseded, 0, MAINTENANCE_CLOSE_TICK);
        assert_eq!(superseded.worksite_status_packet()[8], 29);
        superseded
            .adopt_server_worksites(crate::zone::ZoneId::Moonvale, 1, 3, custom)
            .unwrap();
        run_until(
            &mut superseded,
            MAINTENANCE_CLOSE_TICK + 1,
            MAINTENANCE_REOPEN_TICK,
        );
        assert_eq!(superseded.worksite_revision(), 3);
        assert_eq!(superseded.worksite_status_packet()[8], 30);
    }

    #[test]
    fn replayed_or_skipped_clock_ticks_cannot_trigger_fake_outage_transitions() {
        let mut town = NpcSupplyWorld::default();
        town.enable_pilot_maintenance();
        town.advance(0);
        town.advance(MAINTENANCE_CLOSE_TICK);
        assert_eq!(town.worksite_revision(), 1);
        run_until(&mut town, 1, MAINTENANCE_CLOSE_TICK);
        assert_eq!(town.worksite_revision(), 2);
        town.advance(MAINTENANCE_CLOSE_TICK);
        town.advance(MAINTENANCE_REOPEN_TICK);
        assert_eq!(town.worksite_revision(), 2);
        run_until(
            &mut town,
            MAINTENANCE_CLOSE_TICK + 1,
            MAINTENANCE_REOPEN_TICK,
        );
        assert_eq!(town.worksite_revision(), 3);
    }
}
