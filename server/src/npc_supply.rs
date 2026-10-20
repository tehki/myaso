//! LW-1C local-only micro-world: bounded NPC-to-NPC supply transfers.
//! No player inventory, money, crafting entitlement, persistence, or client mutation.
use crate::PROTOCOL_VERSION;
use std::collections::VecDeque;

pub const SUPPLY_PACKET_TYPE: u8 = 9;
const CYCLE: u32 = 2_400;
const PICKUP: u32 = 600;
const DROP_OFF: u32 = 1_800;
const FORGE: u32 = 300;
const HISTORY_LIMIT: usize = 12;
const WATER_TOTAL: u16 = 8;
const FOOD_TOTAL: u16 = 8;
const IRON_TOTAL: u16 = 6;

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
}

#[derive(Debug, Clone)]
pub struct NpcSupplyWorld {
    stocks: SupplyStocks,
    history: VecDeque<SupplyEvent>,
    last_step: Option<u32>,
    sequence: u32,
}

impl Default for NpcSupplyWorld {
    fn default() -> Self {
        Self {
            stocks: SupplyStocks::default(),
            history: VecDeque::with_capacity(HISTORY_LIMIT),
            last_step: None,
            sequence: 0,
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
        match tick % CYCLE {
            FORGE => {
                if self.stocks.forge_iron > 0 {
                    self.stocks.forge_iron -= 1;
                    self.stocks.forge_nails += 1;
                    self.record(tick, 2, 5);
                }
            }
            PICKUP => {
                if self.stocks.well_water > 0 && self.stocks.tomas_water == 0 {
                    self.stocks.well_water -= 1;
                    self.stocks.tomas_water += 1;
                    self.record(tick, 5, 1);
                }
                if self.stocks.depot_food > 0 && self.stocks.elara_food == 0 {
                    self.stocks.depot_food -= 1;
                    self.stocks.elara_food += 1;
                    self.record(tick, 4, 3);
                }
            }
            DROP_OFF => {
                if self.stocks.tomas_water > 0 {
                    self.stocks.tomas_water -= 1;
                    self.stocks.yard_water += 1;
                    self.record(tick, 5, 2);
                }
                if self.stocks.elara_food > 0 {
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
    fn fixed_supply_exhausts_without_refills_and_history_is_bounded() {
        let mut world = NpcSupplyWorld::default();
        run_until(&mut world, 0, 40_000);
        let stock = world.stocks();
        assert_eq!(stock.well_water, 0);
        assert_eq!(stock.yard_water, 8);
        assert_eq!(stock.depot_food, 0);
        assert_eq!(stock.stall_food, 8);
        assert_eq!(stock.forge_iron, 0);
        assert_eq!(stock.forge_nails, 6);
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
}
