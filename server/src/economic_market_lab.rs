//! E3b: deterministic offline supply-chain and order-book shock laboratory.
//! Nonredeemable credits, artificial agents, NO realtime, custody, wallets,
//! property transfers, Moon Coin, live price oracle, or player data.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Gatherer,
    Crafter,
    Merchant,
    Fighter,
    Newcomer,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum Good {
    Ore,
    Equipment,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Agent {
    pub role: Role,
    pub credits: u64,
    pub ore: u64,
    pub equipment: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Shock {
    /// 100 = normal authored harvest, 0 = complete disruption, 200 = double.
    pub harvest_percent: u16,
    pub fee_bps: u16,
    pub equipment_decay_days: u32,
    pub newcomer_grant: u64,
    pub daily_grant_budget: u64,
    pub treasury_floor: u64,
}

impl Shock {
    pub fn baseline() -> Self {
        Self {
            harvest_percent: 100,
            fee_bps: 300,
            equipment_decay_days: 3,
            newcomer_grant: 3,
            daily_grant_budget: 300,
            treasury_floor: 500,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    EmptyPopulation,
    InvalidPolicy,
    InvalidOrder,
    InadequateCredits,
    InadequateStock,
    Overflow,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Fill {
    pub buyer: usize,
    pub seller: usize,
    pub good: Good,
    pub quantity: u64,
    pub price_per_unit: u64,
    pub gross: u64,
    pub treasury_fee: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Report {
    pub days: u32,
    pub total_credits: u128,
    pub circulating_credits: u128,
    pub treasury_credits: u64,
    pub ore_present: u128,
    pub ore_harvested: u128,
    pub ore_crafted_away: u128,
    pub equipment_present: u128,
    pub equipment_crafted: u128,
    pub equipment_destroyed: u128,
    pub ore_traded: u128,
    pub equipment_traded: u128,
    pub ore_gross_value: u128,
    pub equipment_gross_value: u128,
    pub fees_collected: u128,
    pub grants_paid: u128,
    pub trade_count: u64,
}

impl Report {
    pub fn ore_vwap(&self) -> Option<u128> {
        (self.ore_traded > 0).then(|| self.ore_gross_value / self.ore_traded)
    }

    pub fn equipment_vwap(&self) -> Option<u128> {
        (self.equipment_traded > 0).then(|| self.equipment_gross_value / self.equipment_traded)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Side {
    Bid,
    Ask,
}

#[derive(Clone, Copy, Debug)]
struct Order {
    account: usize,
    good: Good,
    side: Side,
    remaining: u64,
    limit: u64,
    sequence: u64,
}

/// A deterministic *illustration*, not a forecasting model. Matching uses
/// fixed price-time priority. Any actual multiplayer exchange needs an
/// authenticated, durable, concurrency-safe, reserved-inventory order book.
#[derive(Clone, Debug)]
pub struct MarketLab {
    agents: Vec<Agent>,
    treasury: u64,
    initial_credit_supply: u128,
    initial_ore: u128,
    initial_equipment: u128,
    mined: u128,
    crafted_ore: u128,
    crafted_equipment: u128,
    destroyed_equipment: u128,
    ore_traded: u128,
    equipment_traded: u128,
    ore_gross: u128,
    equipment_gross: u128,
    fees: u128,
    grants: u128,
    fills: u64,
    day: u32,
    rng: u64,
}

impl MarketLab {
    pub fn new(agents: Vec<Agent>, treasury: u64, seed: u64) -> Result<Self, Error> {
        if agents.is_empty() || agents.len() > 10_000 {
            return Err(Error::EmptyPopulation);
        }
        let initial_credit_supply = agents
            .iter()
            .try_fold(u128::from(treasury), |a, b| {
                a.checked_add(u128::from(b.credits))
            })
            .ok_or(Error::Overflow)?;
        let initial_ore = agents.iter().map(|a| u128::from(a.ore)).sum();
        let initial_equipment = agents.iter().map(|a| u128::from(a.equipment)).sum();
        Ok(Self {
            agents,
            treasury,
            initial_credit_supply,
            initial_ore,
            initial_equipment,
            mined: 0,
            crafted_ore: 0,
            crafted_equipment: 0,
            destroyed_equipment: 0,
            ore_traded: 0,
            equipment_traded: 0,
            ore_gross: 0,
            equipment_gross: 0,
            fees: 0,
            grants: 0,
            fills: 0,
            day: 0,
            rng: if seed == 0 {
                0x5EED_CAFE_1234_5678
            } else {
                seed
            },
        })
    }

    pub fn example_population(count: usize) -> Vec<Agent> {
        (0..count)
            .map(|i| {
                let role = match i % 5 {
                    0 => Role::Gatherer,
                    1 => Role::Crafter,
                    2 => Role::Merchant,
                    3 => Role::Fighter,
                    _ => Role::Newcomer,
                };
                Agent {
                    role,
                    credits: 100,
                    ore: if role == Role::Crafter { 2 } else { 0 },
                    equipment: if role == Role::Fighter { 2 } else { 0 },
                }
            })
            .collect()
    }

    pub fn agent(&self, id: usize) -> Option<Agent> {
        self.agents.get(id).copied()
    }

    pub fn treasury(&self) -> u64 {
        self.treasury
    }

    fn next_random(&mut self) -> u64 {
        self.rng ^= self.rng << 13;
        self.rng ^= self.rng >> 7;
        self.rng ^= self.rng << 17;
        self.rng
    }

    fn validate_policy(&self, policy: Shock) -> Result<(), Error> {
        if policy.harvest_percent > 200
            || policy.fee_bps > 1_000
            || policy.equipment_decay_days == 0
            || policy.treasury_floor > self.treasury
            || policy.newcomer_grant > policy.daily_grant_budget
        {
            return Err(Error::InvalidPolicy);
        }
        Ok(())
    }

    /// Settle one trusted in-memory test fill. All checked arithmetic is
    /// performed before mutating balances or resources. This method is not
    /// exposed as an API and never accepts real-client trading instructions.
    fn settle(
        &mut self,
        buyer: usize,
        seller: usize,
        good: Good,
        quantity: u64,
        unit_price: u64,
        fee_bps: u16,
    ) -> Result<Fill, Error> {
        if buyer == seller
            || buyer >= self.agents.len()
            || seller >= self.agents.len()
            || quantity == 0
            || unit_price == 0
            || fee_bps > 1_000
        {
            return Err(Error::InvalidOrder);
        }
        let gross = quantity.checked_mul(unit_price).ok_or(Error::Overflow)?;
        let fee = u64::try_from((u128::from(gross) * u128::from(fee_bps)) / 10_000)
            .map_err(|_| Error::Overflow)?;
        let buyer_before = self.agents[buyer];
        let seller_before = self.agents[seller];
        let seller_stock = match good {
            Good::Ore => seller_before.ore,
            Good::Equipment => seller_before.equipment,
        };
        if buyer_before.credits < gross {
            return Err(Error::InadequateCredits);
        }
        if seller_stock < quantity {
            return Err(Error::InadequateStock);
        }
        let seller_payout = gross - fee;
        let seller_next_credits = seller_before
            .credits
            .checked_add(seller_payout)
            .ok_or(Error::Overflow)?;
        let next_treasury = self.treasury.checked_add(fee).ok_or(Error::Overflow)?;
        let buyer_stock = match good {
            Good::Ore => buyer_before.ore,
            Good::Equipment => buyer_before.equipment,
        };
        let buyer_next_stock = buyer_stock.checked_add(quantity).ok_or(Error::Overflow)?;
        let next_fills = self.fills.checked_add(1).ok_or(Error::Overflow)?;
        let next_fees = self
            .fees
            .checked_add(u128::from(fee))
            .ok_or(Error::Overflow)?;
        let next_volume = match good {
            Good::Ore => self.ore_traded.checked_add(u128::from(quantity)),
            Good::Equipment => self.equipment_traded.checked_add(u128::from(quantity)),
        }
        .ok_or(Error::Overflow)?;
        let next_gross = match good {
            Good::Ore => self.ore_gross.checked_add(u128::from(gross)),
            Good::Equipment => self.equipment_gross.checked_add(u128::from(gross)),
        }
        .ok_or(Error::Overflow)?;

        self.agents[buyer].credits -= gross;
        self.agents[seller].credits = seller_next_credits;
        match good {
            Good::Ore => {
                self.agents[buyer].ore = buyer_next_stock;
                self.agents[seller].ore -= quantity;
                self.ore_traded = next_volume;
                self.ore_gross = next_gross;
            }
            Good::Equipment => {
                self.agents[buyer].equipment = buyer_next_stock;
                self.agents[seller].equipment -= quantity;
                self.equipment_traded = next_volume;
                self.equipment_gross = next_gross;
            }
        }
        self.treasury = next_treasury;
        self.fills = next_fills;
        self.fees = next_fees;
        Ok(Fill {
            buyer,
            seller,
            good,
            quantity,
            price_per_unit: unit_price,
            gross,
            treasury_fee: fee,
        })
    }

    fn build_orders(&self) -> Vec<Order> {
        let mut orders = Vec::with_capacity(self.agents.len() * 2);
        for (id, agent) in self.agents.iter().enumerate() {
            let mut offer = |good, side, remaining, limit| {
                if remaining > 0 {
                    orders.push(Order {
                        account: id,
                        good,
                        side,
                        remaining,
                        limit,
                        sequence: orders.len() as u64,
                    });
                }
            };
            match agent.role {
                Role::Gatherer => offer(
                    Good::Ore,
                    Side::Ask,
                    agent.ore.min(4),
                    if agent.ore < 5 { 8 } else { 5 },
                ),
                Role::Crafter => {
                    offer(Good::Ore, Side::Bid, 4_u64.saturating_sub(agent.ore), 12);
                    offer(Good::Equipment, Side::Ask, agent.equipment.min(2), 22);
                }
                Role::Merchant => {
                    if agent.ore < 5 {
                        offer(Good::Ore, Side::Bid, 5 - agent.ore, 9);
                    } else {
                        offer(Good::Ore, Side::Ask, (agent.ore - 3).min(2), 10);
                    }
                    if agent.equipment < 2 {
                        offer(Good::Equipment, Side::Bid, 2 - agent.equipment, 25);
                    } else {
                        offer(Good::Equipment, Side::Ask, (agent.equipment - 1).min(2), 29);
                    }
                }
                Role::Fighter => {
                    offer(
                        Good::Equipment,
                        Side::Bid,
                        2_u64.saturating_sub(agent.equipment),
                        35,
                    );
                }
                Role::Newcomer => {
                    offer(
                        Good::Equipment,
                        Side::Bid,
                        1_u64.saturating_sub(agent.equipment),
                        30,
                    );
                }
            }
        }
        orders
    }

    fn match_orders(&mut self, fee_bps: u16) -> Result<(), Error> {
        let orders = self.build_orders();
        let mut asks: Vec<Order> = orders
            .iter()
            .copied()
            .filter(|o| o.side == Side::Ask)
            .collect();
        let mut bids: Vec<Order> = orders
            .iter()
            .copied()
            .filter(|o| o.side == Side::Bid)
            .collect();
        asks.sort_by(|a, b| {
            a.good
                .cmp(&b.good)
                .then(a.limit.cmp(&b.limit))
                .then(a.sequence.cmp(&b.sequence))
        });
        bids.sort_by(|a, b| {
            a.good
                .cmp(&b.good)
                .then_with(|| b.limit.cmp(&a.limit))
                .then(a.sequence.cmp(&b.sequence))
        });
        for ask in &mut asks {
            for bid in &mut bids {
                if ask.remaining == 0 {
                    break;
                }
                if bid.good != ask.good
                    || bid.remaining == 0
                    || bid.limit < ask.limit
                    || ask.account == bid.account
                {
                    continue;
                }
                let available = match ask.good {
                    Good::Ore => self.agents[ask.account].ore,
                    Good::Equipment => self.agents[ask.account].equipment,
                };
                let affordable = self.agents[bid.account].credits / ask.limit;
                let units = ask
                    .remaining
                    .min(bid.remaining)
                    .min(available)
                    .min(affordable);
                if units == 0 {
                    continue;
                }
                self.settle(
                    bid.account,
                    ask.account,
                    ask.good,
                    units,
                    ask.limit,
                    fee_bps,
                )?;
                ask.remaining -= units;
                bid.remaining -= units;
            }
        }
        Ok(())
    }

    pub fn run_day(&mut self, shock: Shock) -> Result<(), Error> {
        self.validate_policy(shock)?;
        let next_day = self.day.checked_add(1).ok_or(Error::Overflow)?;
        self.day = next_day;
        let mut remaining_grant_budget = shock.daily_grant_budget;
        for i in 0..self.agents.len() {
            match self.agents[i].role {
                Role::Gatherer => {
                    // Seeded fractional production; a zero-yield shock truly
                    // stops extraction. Accumulates only material, not money.
                    let scaled = 4_u64 * u64::from(shock.harvest_percent);
                    let units = scaled / 100 + u64::from(self.next_random() % 100 < scaled % 100);
                    self.agents[i].ore = self.agents[i]
                        .ore
                        .checked_add(units)
                        .ok_or(Error::Overflow)?;
                    self.mined += u128::from(units);
                }
                Role::Crafter => {
                    if self.agents[i].ore >= 2 {
                        self.agents[i].ore -= 2;
                        self.agents[i].equipment = self.agents[i]
                            .equipment
                            .checked_add(1)
                            .ok_or(Error::Overflow)?;
                        self.crafted_ore += 2;
                        self.crafted_equipment += 1;
                    }
                }
                Role::Fighter => {
                    if self.day % shock.equipment_decay_days == 0 && self.agents[i].equipment > 0 {
                        self.agents[i].equipment -= 1;
                        self.destroyed_equipment += 1;
                    }
                }
                Role::Newcomer => {
                    let grant = shock.newcomer_grant;
                    if grant > 0
                        && remaining_grant_budget >= grant
                        && self.treasury >= shock.treasury_floor
                        && self.treasury - shock.treasury_floor >= grant
                    {
                        if let Some(next_balance) = self.agents[i].credits.checked_add(grant) {
                            self.agents[i].credits = next_balance;
                            self.treasury -= grant;
                            remaining_grant_budget -= grant;
                            self.grants += u128::from(grant);
                        }
                    }
                }
                Role::Merchant => {}
            }
        }
        self.match_orders(shock.fee_bps)?;
        debug_assert!(self.conserved());
        Ok(())
    }

    pub fn conserved(&self) -> bool {
        let credits = self
            .agents
            .iter()
            .map(|a| u128::from(a.credits))
            .sum::<u128>();
        let ore = self.agents.iter().map(|a| u128::from(a.ore)).sum::<u128>();
        let equipment = self
            .agents
            .iter()
            .map(|a| u128::from(a.equipment))
            .sum::<u128>();
        credits + u128::from(self.treasury) == self.initial_credit_supply
            && ore + self.crafted_ore == self.initial_ore + self.mined
            && equipment + self.destroyed_equipment
                == self.initial_equipment + self.crafted_equipment
    }

    pub fn report(&self) -> Report {
        let circulating = self.agents.iter().map(|a| u128::from(a.credits)).sum();
        Report {
            days: self.day,
            total_credits: self.initial_credit_supply,
            circulating_credits: circulating,
            treasury_credits: self.treasury,
            ore_present: self.agents.iter().map(|a| u128::from(a.ore)).sum(),
            ore_harvested: self.mined,
            ore_crafted_away: self.crafted_ore,
            equipment_present: self.agents.iter().map(|a| u128::from(a.equipment)).sum(),
            equipment_crafted: self.crafted_equipment,
            equipment_destroyed: self.destroyed_equipment,
            ore_traded: self.ore_traded,
            equipment_traded: self.equipment_traded,
            ore_gross_value: self.ore_gross,
            equipment_gross_value: self.equipment_gross,
            fees_collected: self.fees,
            grants_paid: self.grants,
            trade_count: self.fills,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> MarketLab {
        MarketLab::new(MarketLab::example_population(250), 30_000, 39).unwrap()
    }

    #[test]
    fn many_agents_conserve_money_ore_and_equipment_for_half_year() {
        let mut sim = sample();
        for _ in 0..180 {
            sim.run_day(Shock::baseline()).unwrap();
            assert!(sim.conserved());
        }
        let report = sim.report();
        assert_eq!(report.days, 180);
        assert_eq!(
            report.total_credits,
            report.circulating_credits + u128::from(report.treasury_credits)
        );
        assert_eq!(
            report.ore_present + report.ore_crafted_away,
            report.ore_harvested + 100
        );
        assert_eq!(
            report.equipment_present + report.equipment_destroyed,
            report.equipment_crafted + 100
        );
        assert!(report.ore_traded > 0);
        assert!(report.equipment_traded > 0);
        assert!(report.grants_paid > 0);
        assert!(report.trade_count > 0);
    }

    #[test]
    fn replay_is_identical_for_same_seed_and_scenario() {
        let mut a = sample();
        let mut b = sample();
        for _ in 0..90 {
            a.run_day(Shock::baseline()).unwrap();
            b.run_day(Shock::baseline()).unwrap();
        }
        assert_eq!(a.report(), b.report());
        for i in 0..250 {
            assert_eq!(a.agent(i), b.agent(i));
        }
    }

    #[test]
    fn zero_harvest_shock_reduces_material_throughput() {
        let mut ordinary = sample();
        let mut disrupted = sample();
        let mut shock = Shock::baseline();
        shock.harvest_percent = 0;
        for _ in 0..60 {
            ordinary.run_day(Shock::baseline()).unwrap();
            disrupted.run_day(shock).unwrap();
        }
        assert_eq!(disrupted.report().ore_harvested, 0);
        assert!(ordinary.report().ore_harvested > disrupted.report().ore_harvested);
        assert!(ordinary.report().equipment_crafted > disrupted.report().equipment_crafted);
        assert!(disrupted.conserved());
    }

    #[test]
    fn increased_decay_shock_destroys_more_real_simulated_equipment() {
        let mut ordinary = sample();
        let mut high_decay = sample();
        let mut shock = Shock::baseline();
        shock.equipment_decay_days = 1;
        for _ in 0..75 {
            ordinary.run_day(Shock::baseline()).unwrap();
            high_decay.run_day(shock).unwrap();
        }
        assert!(high_decay.report().equipment_destroyed >= ordinary.report().equipment_destroyed);
        assert!(high_decay.conserved());
    }

    #[test]
    fn treasury_grants_never_issue_currency_or_breach_reserve() {
        let mut sim = MarketLab::new(MarketLab::example_population(250), 1_000, 33).unwrap();
        let mut policy = Shock::baseline();
        policy.treasury_floor = 900;
        policy.daily_grant_budget = 10_000;
        policy.newcomer_grant = 20;
        policy.fee_bps = 0;
        for _ in 0..25 {
            sim.run_day(policy).unwrap();
            assert!(sim.conserved());
            assert!(sim.treasury() >= 900);
        }
        assert!(sim.report().grants_paid <= 100);
    }

    #[test]
    fn fee_is_treasury_transfer_and_checked_trade_cannot_overspend() {
        let mut sim = MarketLab::new(
            vec![
                Agent {
                    role: Role::Fighter,
                    credits: 20,
                    ore: 0,
                    equipment: 0,
                },
                Agent {
                    role: Role::Crafter,
                    credits: 7,
                    ore: 0,
                    equipment: 3,
                },
            ],
            100,
            2,
        )
        .unwrap();
        let fill = sim.settle(0, 1, Good::Equipment, 1, 20, 500).unwrap();
        assert_eq!(fill.treasury_fee, 1);
        assert_eq!(sim.treasury(), 101);
        assert_eq!(sim.agent(1).unwrap().credits, 26);
        assert_eq!(sim.agent(0).unwrap().equipment, 1);
        assert_eq!(
            sim.settle(0, 1, Good::Equipment, 1, 20, 500),
            Err(Error::InadequateCredits)
        );
        assert!(sim.conserved());
    }

    #[test]
    fn overselling_failed_trade_is_atomic() {
        let mut sim = MarketLab::new(
            vec![
                Agent {
                    role: Role::Fighter,
                    credits: 1_000,
                    ore: 0,
                    equipment: 0,
                },
                Agent {
                    role: Role::Crafter,
                    credits: 2,
                    ore: 0,
                    equipment: 1,
                },
            ],
            30,
            1,
        )
        .unwrap();
        let before = sim.report();
        assert_eq!(
            sim.settle(0, 1, Good::Equipment, 2, 10, 50),
            Err(Error::InadequateStock)
        );
        assert_eq!(sim.report(), before);
        assert!(sim.conserved());
    }

    #[test]
    fn malicious_cross_account_or_overflow_scenarios_fail_closed() {
        let mut sim = MarketLab::new(
            vec![
                Agent {
                    role: Role::Fighter,
                    credits: u64::MAX,
                    ore: 0,
                    equipment: 0,
                },
                Agent {
                    role: Role::Crafter,
                    credits: u64::MAX,
                    ore: 0,
                    equipment: 1,
                },
            ],
            0,
            1,
        )
        .unwrap();
        assert_eq!(
            sim.settle(0, 0, Good::Equipment, 1, 1, 50),
            Err(Error::InvalidOrder)
        );
        assert_eq!(
            sim.settle(0, 1, Good::Equipment, 1, 1, 0),
            Err(Error::Overflow)
        );
        assert_eq!(
            sim.settle(0, 1, Good::Equipment, 2, 1, 0),
            Err(Error::InadequateStock)
        );
        assert!(sim.conserved());
    }

    #[test]
    fn sorted_market_price_stays_inside_crossed_limits() {
        let mut sim = MarketLab::new(
            vec![
                Agent {
                    role: Role::Gatherer,
                    credits: 100,
                    ore: 10,
                    equipment: 0,
                },
                Agent {
                    role: Role::Crafter,
                    credits: 100,
                    ore: 0,
                    equipment: 0,
                },
            ],
            10,
            4,
        )
        .unwrap();
        sim.match_orders(100).unwrap();
        assert_eq!(sim.agent(1).unwrap().ore, 4);
        assert_eq!(sim.agent(0).unwrap().credits, 120);
        assert_eq!(sim.report().ore_vwap(), Some(5));
        assert!(sim.conserved());
    }

    #[test]
    fn invalid_policies_have_no_effect_on_the_world() {
        let mut sim = sample();
        let before = sim.report();
        let mut policy = Shock::baseline();
        policy.harvest_percent = 201;
        assert_eq!(sim.run_day(policy), Err(Error::InvalidPolicy));
        policy.harvest_percent = 100;
        policy.equipment_decay_days = 0;
        assert_eq!(sim.run_day(policy), Err(Error::InvalidPolicy));
        assert_eq!(sim.report(), before);
    }

    #[test]
    fn perishable_resource_and_zero_volumes_are_reported_without_fake_prices() {
        let sim = sample();
        let p = sim.report();
        assert_eq!(p.ore_vwap(), None);
        assert_eq!(p.equipment_vwap(), None);
        assert_eq!(p.trade_count, 0);
    }
}
