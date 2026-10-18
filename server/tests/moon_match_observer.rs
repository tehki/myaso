//! The observer is exercised using actual World combat, not a fabricated
//! event. This does NOT test a deployed server, throughput or durable delivery.
use myaso_server::{
    match_observer::MatchWinObserver,
    simulation::{Action, CombatEvent, InputIntent, World, FFA_KILL_TARGET},
};

#[test]
fn real_simulation_five_kill_match_win_can_reach_research_observer() {
    let mut world = World::new(600.0, 400.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 272.0, 200.0, std::f32::consts::PI));

    let (observer, receiver) = MatchWinObserver::research_channel(1);
    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let mut saw_authoritative_win = false;

    // This uses the same genuine Rust world and five-kill mechanic as the
    // authoritative server. Each click requires release before fresh press.
    for _ in 0..4000 {
        let is_idle = world
            .fighter(1)
            .is_some_and(|fighter| fighter.action == Action::Idle);
        world.set_input(1, InputIntent::default());
        let release = world.step_by(5.0);
        observer.observe(world.tick, &release);
        if is_idle {
            world.set_input(1, attack);
        }
        let events = world.step_by(5.0);
        observer.observe(world.tick, &events);
        if events.iter().any(|event| {
            matches!(
                event,
                CombatEvent::MatchWon { winner: 1, kills }
                    if *kills == FFA_KILL_TARGET
            )
        }) {
            saw_authoritative_win = true;
            break;
        }
    }

    assert!(
        saw_authoritative_win,
        "genuine game should produce MatchWon"
    );
    assert_eq!(world.match_winner(), Some(1));
    let recorded = receiver.try_recv().expect("one observed win");
    assert_eq!(recorded.winner_net_id, 1);
    assert_eq!(recorded.kills, FFA_KILL_TARGET);
    assert_eq!(observer.counters().accepted, 1);
    assert_eq!(observer.counters().full, 0);
    assert!(receiver.try_recv().is_err());

    // No account identity, consent, replay protection, signature or MOON
    // distribution can be inferred from this observed network fighter ID.
}
