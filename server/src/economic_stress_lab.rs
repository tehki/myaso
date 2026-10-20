//! E3 sandbox economic stress harness. NOT live gameplay or token monetary policy.
//! All balances are nonredeemable simulation units; no wallet or chain interface.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Policy {
    pub daily_reward_budget: u64,
    pub reward_per_player: u64,
    pub treasury_reserve_floor: u64,
    pub npc_service_fee: u64,
    pub market_fee_bps: u16,
    pub plot_price: u64,
    pub plot_upkeep: u64,
    pub max_plots_per_player: u8,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Counters {
    /// Treasury-funded in-game reward distributions, NOT new currency issuance.
    pub rewards: u128,
    pub npc_fees: u128,
    pub trading_fees: u128,
    pub plot_sales: u128,
    pub upkeep: u128,
    pub peer_trading_volume: u128,
    pub resources_gathered: u128,
    pub resources_consumed: u128,
    pub missed_upkeep: u128,
    pub plots_claimed: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SimError {
    EmptyPopulation,
    InvalidPolicy,
    InvalidActor,
    InsufficientFunds,
    NoLand,
    HoldingCap,
    Overflow,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Snapshot {
    pub day: u32,
    pub circulating: u128,
    pub treasury: u64,
    pub total_issued: u128,
    pub owned_plots: u64,
    pub vacant_plots: u64,
    pub top_tenth_share_bps: u16,
    pub median_player_balance: u64,
    pub median_housing_cost_in_reward_days: Option<u64>,
    pub counters: Counters,
}

/// Deterministic toy population, not a player behavioral forecast.
/// No issuance/minting during the simulation: all credit rewards debit treasury.
#[derive(Clone, Debug)]
pub struct Economy {
    balances: Vec<u64>,
    held_plots: Vec<u8>,
    resources: Vec<u64>,
    treasury: u64,
    initial_supply: u128,
    total_plots: u64,
    remaining_plots: u64,
    policy: Policy,
    counters: Counters,
    rng: u64,
    day: u32,
}

impl Economy {
    pub fn new(
        players: usize,
        initial_player_credits: u64,
        treasury: u64,
        available_plots: u64,
        policy: Policy,
        seed: u64,
    ) -> Result<Self, SimError> {
        if players == 0 || players > 100_000 {
            return Err(SimError::EmptyPopulation);
        }
        if policy.market_fee_bps > 1_000
            || policy.max_plots_per_player == 0
            || policy.reward_per_player > policy.daily_reward_budget
            || policy.treasury_reserve_floor > treasury
            || policy.plot_price == 0
        {
            return Err(SimError::InvalidPolicy);
        }
        let initial_supply = (players as u128)
            .checked_mul(u128::from(initial_player_credits))
            .and_then(|x| x.checked_add(u128::from(treasury)))
            .ok_or(SimError::Overflow)?;
        Ok(Self {
            balances: vec![initial_player_credits; players],
            held_plots: vec![0; players],
            resources: vec![0; players],
            treasury,
            initial_supply,
            total_plots: available_plots,
            remaining_plots: available_plots,
            policy,
            counters: Counters::default(),
            rng: if seed == 0 {
                0xD00D_D00D_A555_7777
            } else {
                seed
            },
            day: 0,
        })
    }

    fn next_random(&mut self) -> u64 {
        self.rng ^= self.rng << 13;
        self.rng ^= self.rng >> 7;
        self.rng ^= self.rng << 17;
        self.rng
    }

    pub fn player_balance(&self, id: usize) -> Option<u64> {
        self.balances.get(id).copied()
    }

    pub fn owned_plots(&self, id: usize) -> Option<u8> {
        self.held_plots.get(id).copied()
    }

    pub fn treasury(&self) -> u64 {
        self.treasury
    }

    pub fn conserved(&self) -> bool {
        self.balances
            .iter()
            .try_fold(u128::from(self.treasury), |a, &b| {
                a.checked_add(u128::from(b))
            })
            == Some(self.initial_supply)
            && self.remaining_plots + self.held_plots.iter().map(|&n| u64::from(n)).sum::<u64>()
                == self.total_plots
    }

    /// Transfer a payment to the realm treasury (a circulation sink, NOT a burn).
    pub fn npc_service(&mut self, id: usize, amount: u64) -> Result<(), SimError> {
        let balance = *self.balances.get(id).ok_or(SimError::InvalidActor)?;
        if balance < amount {
            return Err(SimError::InsufficientFunds);
        }
        let treasury = self
            .treasury
            .checked_add(amount)
            .ok_or(SimError::Overflow)?;
        self.balances[id] = balance - amount;
        self.treasury = treasury;
        self.counters.npc_fees += u128::from(amount);
        Ok(())
    }

    /// A marketplace trade is primarily player-to-player redistribution.
    /// Only the separately accounted commission returns to the treasury.
    pub fn market_trade(
        &mut self,
        buyer: usize,
        seller: usize,
        price: u64,
    ) -> Result<(), SimError> {
        if buyer == seller || price == 0 || seller >= self.balances.len() {
            return Err(SimError::InvalidActor);
        }
        let buyer_balance = *self.balances.get(buyer).ok_or(SimError::InvalidActor)?;
        if buyer_balance < price {
            return Err(SimError::InsufficientFunds);
        }
        let fee =
            u64::try_from(u128::from(price) * u128::from(self.policy.market_fee_bps) / 10_000)
                .map_err(|_| SimError::Overflow)?;
        let seller_amount = price - fee;
        let seller_balance = self.balances[seller]
            .checked_add(seller_amount)
            .ok_or(SimError::Overflow)?;
        let treasury = self.treasury.checked_add(fee).ok_or(SimError::Overflow)?;
        self.balances[buyer] -= price;
        self.balances[seller] = seller_balance;
        self.treasury = treasury;
        self.counters.trading_fees += u128::from(fee);
        self.counters.peer_trading_volume += u128::from(price);
        Ok(())
    }

    pub fn claim_plot(&mut self, id: usize) -> Result<(), SimError> {
        let held = *self.held_plots.get(id).ok_or(SimError::InvalidActor)?;
        if held >= self.policy.max_plots_per_player {
            return Err(SimError::HoldingCap);
        }
        if self.remaining_plots == 0 {
            return Err(SimError::NoLand);
        }
        let balance = self.balances[id];
        if balance < self.policy.plot_price {
            return Err(SimError::InsufficientFunds);
        }
        let treasury = self
            .treasury
            .checked_add(self.policy.plot_price)
            .ok_or(SimError::Overflow)?;
        let next_held = held.checked_add(1).ok_or(SimError::Overflow)?;
        self.balances[id] -= self.policy.plot_price;
        self.treasury = treasury;
        self.held_plots[id] = next_held;
        self.remaining_plots -= 1;
        self.counters.plot_sales += u128::from(self.policy.plot_price);
        self.counters.plots_claimed += 1;
        Ok(())
    }

    /// Upkeep attempts never confiscate an unpaid parcel or remove possessions.
    /// Eviction/arrears are deliberately outside this reference.
    pub fn charge_upkeep(&mut self, id: usize) -> Result<(), SimError> {
        let held = *self.held_plots.get(id).ok_or(SimError::InvalidActor)?;
        let due = self
            .policy
            .plot_upkeep
            .checked_mul(u64::from(held))
            .ok_or(SimError::Overflow)?;
        if self.balances[id] < due {
            self.counters.missed_upkeep += 1;
            return Err(SimError::InsufficientFunds);
        }
        let treasury = self.treasury.checked_add(due).ok_or(SimError::Overflow)?;
        self.balances[id] -= due;
        self.treasury = treasury;
        self.counters.upkeep += u128::from(due);
        Ok(())
    }

    /// Pays from PREEXISTING treasury reserves. Repeated requests in one day
    /// cannot bypass per-player budgeting in the simulation run_daily loop.
    fn reward_once(&mut self, id: usize, daily_remaining: &mut u64) {
        if self.treasury <= self.policy.treasury_reserve_floor
            || *daily_remaining < self.policy.reward_per_player
        {
            return;
        }
        let amount = self.policy.reward_per_player;
        if self.treasury - self.policy.treasury_reserve_floor < amount {
            return;
        }
        if let Some(balance) = self.balances[id].checked_add(amount) {
            self.treasury -= amount;
            self.balances[id] = balance;
            *daily_remaining -= amount;
            self.counters.rewards += u128::from(amount);
        }
    }

    pub fn run_day(&mut self) -> Result<(), SimError> {
        self.day = self.day.checked_add(1).ok_or(SimError::Overflow)?;
        let players = self.balances.len();
        let mut remaining = self.policy.daily_reward_budget;
        // Each actor has at most one budgeted reward opportunity per day.
        for i in 0..players {
            let action = self.next_random();
            if action % 3 == 0 {
                self.reward_once(i, &mut remaining);
            }
            // Harvest and consumption are physically distinct from currency.
            if action % 2 == 0 {
                self.resources[i] = self.resources[i].saturating_add(2);
                self.counters.resources_gathered += 2;
            }
            if action % 4 == 0 && self.resources[i] > 0 {
                self.resources[i] -= 1;
                self.counters.resources_consumed += 1;
            }
            if action % 7 == 0 {
                let _ = self.npc_service(i, self.policy.npc_service_fee);
            }
            if action % 11 == 0 && self.remaining_plots > 0 {
                let _ = self.claim_plot(i);
            }
            if action % 5 == 0 {
                let recipient = (self.next_random() as usize) % players;
                if recipient != i {
                    let _ = self.market_trade(i, recipient, 7);
                }
            }
            if self.held_plots[i] > 0 {
                let _ = self.charge_upkeep(i);
            }
        }
        debug_assert!(self.conserved());
        Ok(())
    }

    pub fn snapshot(&self) -> Snapshot {
        let mut ordered = self.balances.clone();
        ordered.sort_unstable();
        let n = ordered.len();
        let top_n = n.div_ceil(10);
        let top_wealth: u128 = ordered[n - top_n..].iter().map(|&x| u128::from(x)).sum();
        let circulating: u128 = ordered.iter().map(|&x| u128::from(x)).sum();
        let top_tenth_share_bps = if circulating > 0 {
            ((top_wealth * 10_000 / circulating).min(10_000)) as u16
        } else {
            0
        };
        let median_player_balance = ordered[n / 2];
        let median_housing_cost_in_reward_days = if self.policy.reward_per_player == 0 {
            None
        } else {
            Some(
                self.policy
                    .plot_price
                    .div_ceil(self.policy.reward_per_player),
            )
        };
        Snapshot {
            day: self.day,
            circulating,
            treasury: self.treasury,
            total_issued: self.initial_supply,
            owned_plots: self.total_plots - self.remaining_plots,
            vacant_plots: self.remaining_plots,
            top_tenth_share_bps,
            median_player_balance,
            median_housing_cost_in_reward_days,
            counters: self.counters,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> Policy {
        Policy {
            daily_reward_budget: 2000,
            reward_per_player: 2,
            treasury_reserve_floor: 300,
            npc_service_fee: 3,
            market_fee_bps: 250,
            plot_price: 80,
            plot_upkeep: 1,
            max_plots_per_player: 2,
        }
    }

    #[test]
    fn thousand_player_year_conserves_all_test_currency_and_plot_supply() {
        let mut economy = Economy::new(1000, 100, 150_000, 700, policy(), 42).unwrap();
        for _ in 0..365 {
            economy.run_day().unwrap();
            assert!(economy.conserved());
        }
        let snap = economy.snapshot();
        assert_eq!(snap.day, 365);
        assert_eq!(snap.total_issued, 250_000);
        assert_eq!(
            snap.circulating + u128::from(snap.treasury),
            snap.total_issued
        );
        assert_eq!(snap.owned_plots + snap.vacant_plots, 700);
        assert!(snap.counters.rewards > 0);
        assert!(snap.counters.npc_fees > 0);
        assert!(snap.counters.resources_consumed > 0);
    }

    #[test]
    fn peer_trade_and_npc_service_have_distinct_accounting() {
        let mut p = policy();
        p.treasury_reserve_floor = 0;
        let mut economy = Economy::new(2, 100, 100, 0, p, 1).unwrap();
        economy.market_trade(0, 1, 80).unwrap();
        // Fee rounds to 2 units at 250 bps (2.5%).
        assert_eq!(economy.player_balance(0), Some(20));
        assert_eq!(economy.player_balance(1), Some(178));
        assert_eq!(economy.treasury(), 102);
        assert_eq!(economy.snapshot().counters.trading_fees, 2);
        economy.npc_service(1, 20).unwrap();
        assert_eq!(economy.treasury(), 122);
        assert_eq!(economy.snapshot().counters.npc_fees, 20);
        assert!(economy.conserved());
    }

    #[test]
    fn land_cap_and_empty_plot_supply_are_respected() {
        let mut p = policy();
        p.treasury_reserve_floor = 0;
        let mut economy = Economy::new(2, 500, 100, 3, p, 9).unwrap();
        economy.claim_plot(0).unwrap();
        economy.claim_plot(0).unwrap();
        assert_eq!(economy.claim_plot(0), Err(SimError::HoldingCap));
        economy.claim_plot(1).unwrap();
        assert_eq!(economy.claim_plot(1), Err(SimError::NoLand));
        assert_eq!(economy.owned_plots(0), Some(2));
        assert_eq!(economy.snapshot().owned_plots, 3);
        assert!(economy.conserved());
    }

    #[test]
    fn treasury_funded_rewards_cannot_create_unbacked_test_supply() {
        let mut p = policy();
        p.daily_reward_budget = 10_000;
        p.reward_per_player = 10;
        p.treasury_reserve_floor = 400;
        p.npc_service_fee = 0;
        p.plot_price = 500;
        let mut economy = Economy::new(500, 0, 500, 0, p, 10).unwrap();
        for _ in 0..50 {
            economy.run_day().unwrap();
            assert!(economy.conserved());
        }
        assert!(economy.treasury() >= 400);
        assert!(economy.snapshot().counters.rewards <= 100);
        assert_eq!(economy.snapshot().total_issued, 500);
    }

    #[test]
    fn stress_run_reproducible_with_same_seed() {
        let mut a = Economy::new(2000, 100, 220_000, 1000, policy(), 313).unwrap();
        let mut b = a.clone();
        for _ in 0..180 {
            a.run_day().unwrap();
            b.run_day().unwrap();
        }
        assert_eq!(a.snapshot(), b.snapshot());
        assert!(a.conserved());
    }

    #[test]
    fn unfunded_fees_and_upkeep_do_not_take_or_invalidate_deeds() {
        let mut p = policy();
        p.plot_price = 1;
        p.plot_upkeep = 5;
        p.treasury_reserve_floor = 0;
        let mut economy = Economy::new(1, 1, 3, 1, p, 5).unwrap();
        economy.claim_plot(0).unwrap();
        assert_eq!(economy.owned_plots(0), Some(1));
        assert_eq!(economy.charge_upkeep(0), Err(SimError::InsufficientFunds));
        assert_eq!(economy.owned_plots(0), Some(1));
        assert_eq!(economy.npc_service(0, 3), Err(SimError::InsufficientFunds));
        assert!(economy.conserved());
    }

    #[test]
    fn invalid_policy_and_overflow_are_rejected() {
        let mut p = policy();
        p.market_fee_bps = 1001;
        assert!(matches!(
            Economy::new(20, 10, 100, 2, p, 1),
            Err(SimError::InvalidPolicy)
        ));
        p = policy();
        p.reward_per_player = p.daily_reward_budget + 1;
        assert!(matches!(
            Economy::new(20, 10, 100, 2, p, 1),
            Err(SimError::InvalidPolicy)
        ));
        assert!(matches!(
            Economy::new(0, 10, 100, 2, policy(), 1),
            Err(SimError::EmptyPopulation)
        ));
        let mut p = policy();
        p.treasury_reserve_floor = 0;
        let mut economy = Economy::new(2, u64::MAX, 1, 0, p, 1).unwrap();
        assert_eq!(economy.market_trade(0, 1, 5), Err(SimError::Overflow));
        assert!(economy.conserved());
    }

    #[test]
    fn read_only_snapshots_capture_relative_wealth_and_affordability() {
        let mut e = Economy::new(10, 100, 500, 10, policy(), 17).unwrap();
        let s = e.snapshot();
        assert_eq!(s.top_tenth_share_bps, 1000);
        assert_eq!(s.median_player_balance, 100);
        assert_eq!(s.median_housing_cost_in_reward_days, Some(40));
        assert_eq!(s.vacant_plots, 10);
        assert!(e.conserved());
        e.claim_plot(0).unwrap();
        assert_eq!(e.snapshot().owned_plots, 1);
    }
}
