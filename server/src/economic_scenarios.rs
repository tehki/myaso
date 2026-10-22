//! E3c: bounded deterministic read-only housing policy scenario sweeps.
//! This laboratory does not create a live deed, charge a live player, or
//! promise housing or cryptocurrency returns.
use crate::economic_stress_lab::{Economy, HousingAccess, Policy, SimError, Snapshot};
use std::collections::BTreeSet;

pub const MAX_SCENARIOS: usize = 24;
pub const MAX_SCENARIO_PLAYERS: usize = 20_000;
pub const MAX_SCENARIO_DAYS: u16 = 730;
pub const MAX_TOTAL_AGENT_DAYS: u128 = 2_000_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HousingScenario {
    pub id: u16,
    pub players: usize,
    pub initial_credits_per_player: u64,
    pub treasury: u64,
    pub available_plots: u64,
    pub policy: Policy,
    pub seed: u64,
    pub days: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HousingScenarioResult {
    pub id: u16,
    pub population: usize,
    pub initial: HousingAccess,
    pub final_access: HousingAccess,
    pub final_snapshot: Snapshot,
    /// Exact number of occupied plots after the scenario, not a reservation.
    pub occupied_plots: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SweepError {
    Empty,
    TooManyScenarios,
    DuplicateId,
    InvalidScenario,
    AgentDayBudgetExceeded,
    Simulation(SimError),
    ConservationFailure,
}

/// Bounded to ensure an accidentally huge scenario request cannot monopolize
/// the game process. This function must only run in offline research tools.
pub fn compare_housing_scenarios(
    scenarios: &[HousingScenario],
) -> Result<Vec<HousingScenarioResult>, SweepError> {
    if scenarios.is_empty() {
        return Err(SweepError::Empty);
    }
    if scenarios.len() > MAX_SCENARIOS {
        return Err(SweepError::TooManyScenarios);
    }
    let mut ids = BTreeSet::new();
    let mut agent_days: u128 = 0;
    // Validate all input before evaluating any scenario; all output is local
    // and no production property or monetary state is ever accessed.
    for scenario in scenarios {
        if !ids.insert(scenario.id) {
            return Err(SweepError::DuplicateId);
        }
        if scenario.players == 0
            || scenario.players > MAX_SCENARIO_PLAYERS
            || scenario.days == 0
            || scenario.days > MAX_SCENARIO_DAYS
        {
            return Err(SweepError::InvalidScenario);
        }
        agent_days = agent_days
            .checked_add((scenario.players as u128) * u128::from(scenario.days))
            .ok_or(SweepError::AgentDayBudgetExceeded)?;
        if agent_days > MAX_TOTAL_AGENT_DAYS {
            return Err(SweepError::AgentDayBudgetExceeded);
        }
    }

    let mut results = Vec::with_capacity(scenarios.len());
    for scenario in scenarios {
        let mut simulation = Economy::new(
            scenario.players,
            scenario.initial_credits_per_player,
            scenario.treasury,
            scenario.available_plots,
            scenario.policy,
            scenario.seed,
        )
        .map_err(SweepError::Simulation)?;
        let initial = simulation.housing_access();
        for _ in 0..scenario.days {
            simulation.run_day().map_err(SweepError::Simulation)?;
        }
        if !simulation.conserved() {
            return Err(SweepError::ConservationFailure);
        }
        let final_access = simulation.housing_access();
        let final_snapshot = simulation.snapshot();
        // Keeping the accounting checks in the sweep itself protects research
        // reports even if downstream test callers do not assert invariants.
        if final_snapshot.circulating + u128::from(final_snapshot.treasury)
            != final_snapshot.total_issued
            || final_snapshot.owned_plots + final_snapshot.vacant_plots != scenario.available_plots
            || final_access.owners + final_access.landless != scenario.players as u64
            || final_access.landless_cash_eligible + final_access.landless_cash_shortfall
                != final_access.landless
            || final_access.capacity_limited_first_homes
                + final_access.supply_constrained_candidates
                != final_access.landless_cash_eligible
        {
            return Err(SweepError::ConservationFailure);
        }
        results.push(HousingScenarioResult {
            id: scenario.id,
            population: scenario.players,
            initial,
            final_access,
            occupied_plots: final_snapshot.owned_plots,
            final_snapshot,
        });
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base(id: u16) -> HousingScenario {
        HousingScenario {
            id,
            players: 120,
            initial_credits_per_player: 120,
            treasury: 30_000,
            available_plots: 100,
            policy: Policy {
                daily_reward_budget: 240,
                reward_per_player: 2,
                treasury_reserve_floor: 50,
                npc_service_fee: 1,
                market_fee_bps: 250,
                plot_price: 80,
                plot_upkeep: 1,
                max_plots_per_player: 2,
            },
            seed: 197,
            days: 120,
        }
    }

    #[test]
    fn baseline_sweep_preserves_money_and_land_while_measuring_access() {
        let scenarios = compare_housing_scenarios(&[base(1)]).unwrap();
        let report = scenarios[0];
        assert_eq!(report.id, 1);
        assert_eq!(report.population, 120);
        assert!(report.occupied_plots > 0);
        assert_eq!(report.final_snapshot.day, 120);
        assert_eq!(
            report.final_snapshot.circulating + u128::from(report.final_snapshot.treasury),
            report.final_snapshot.total_issued
        );
        assert_eq!(report.final_snapshot.total_issued, 44_400);
        assert_eq!(
            report.final_snapshot.owned_plots + report.final_snapshot.vacant_plots,
            100
        );
        assert_eq!(
            report.final_access.owners + report.final_access.landless,
            120
        );
    }

    #[test]
    fn fixed_population_scarcity_reduces_the_possible_first_home_capacity() {
        let mut zero_plots = base(2);
        zero_plots.available_plots = 0;
        let mut plentiful = base(3);
        plentiful.available_plots = 100;
        let result = compare_housing_scenarios(&[zero_plots, plentiful]).unwrap();
        assert_eq!(result[0].initial.landless_cash_eligible, 120);
        assert_eq!(result[0].initial.capacity_limited_first_homes, 0);
        assert_eq!(result[0].initial.supply_constrained_candidates, 120);
        assert_eq!(result[0].occupied_plots, 0);
        assert_eq!(result[0].final_access.top_decile_plot_share_bps, None);
        assert_eq!(result[1].initial.capacity_limited_first_homes, 100);
        assert_eq!(result[1].initial.supply_constrained_candidates, 20);
        assert!(result[1].occupied_plots > result[0].occupied_plots);
        assert_eq!(
            result[0].final_snapshot.total_issued,
            result[1].final_snapshot.total_issued
        );
    }

    #[test]
    fn unaffordable_price_shock_can_leave_many_plots_unused() {
        let affordable = base(4);
        let mut high = base(5);
        high.policy.plot_price = 10_000;
        let result = compare_housing_scenarios(&[affordable, high]).unwrap();
        assert!(result[0].occupied_plots > 0);
        assert_eq!(result[1].initial.landless_cash_eligible, 0);
        assert_eq!(result[1].initial.landless_cash_shortfall, 120);
        assert_eq!(result[1].occupied_plots, 0);
        assert_eq!(result[1].final_snapshot.vacant_plots, 100);
        assert_eq!(
            result[0].final_snapshot.total_issued,
            result[1].final_snapshot.total_issued
        );
    }

    #[test]
    fn single_title_cap_disallows_multiple_estates_in_scenario() {
        let mut single = base(6);
        single.available_plots = 120;
        single.policy.max_plots_per_player = 1;
        let mut double = base(7);
        double.available_plots = 120;
        let results = compare_housing_scenarios(&[single, double]).unwrap();
        assert_eq!(results[0].final_access.multiple_plot_owners, 0);
        assert!(results[0].occupied_plots <= 120);
        assert!(results[1].occupied_plots <= 120);
        assert_eq!(
            results[0].final_snapshot.total_issued,
            results[1].final_snapshot.total_issued
        );
        // A two-title allowance is only a permitted maximum, not proof of
        // fair access or a claim about how many players will want two homes.
    }

    #[test]
    fn exact_replay_returns_identical_scenarios_in_original_order() {
        let mut price = base(19);
        price.policy.plot_price = 500;
        let inputs = [base(17), price, base(21)];
        let a = compare_housing_scenarios(&inputs).unwrap();
        let b = compare_housing_scenarios(&inputs).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.iter().map(|x| x.id).collect::<Vec<_>>(), vec![17, 19, 21]);
    }

    #[test]
    fn invalid_or_duplicate_scenarios_fail_before_launch() {
        assert_eq!(compare_housing_scenarios(&[]), Err(SweepError::Empty));
        let mut zero_days = base(1);
        zero_days.days = 0;
        assert_eq!(
            compare_housing_scenarios(&[zero_days]),
            Err(SweepError::InvalidScenario)
        );
        assert_eq!(
            compare_housing_scenarios(&[base(1), base(1)]),
            Err(SweepError::DuplicateId)
        );
        let mut too_many = base(2);
        too_many.players = 20_001;
        assert_eq!(
            compare_housing_scenarios(&[too_many]),
            Err(SweepError::InvalidScenario)
        );
    }

    #[test]
    fn bounded_total_agent_days_and_scenario_count() {
        let specs: Vec<_> = (1..=25).map(base).collect();
        assert_eq!(
            compare_housing_scenarios(&specs),
            Err(SweepError::TooManyScenarios)
        );
        let mut over_budget = base(1);
        over_budget.players = 20_000;
        over_budget.days = 110;
        assert_eq!(
            compare_housing_scenarios(&[over_budget]),
            Err(SweepError::AgentDayBudgetExceeded)
        );
        let mut too_long = base(2);
        too_long.days = 731;
        assert_eq!(
            compare_housing_scenarios(&[too_long]),
            Err(SweepError::InvalidScenario)
        );
    }

    #[test]
    fn invalid_underlying_policy_fails_without_partial_results() {
        let mut invalid = base(1);
        invalid.policy.max_plots_per_player = 0;
        assert_eq!(
            compare_housing_scenarios(&[base(2), invalid]),
            Err(SweepError::Simulation(SimError::InvalidPolicy))
        );
    }
}
