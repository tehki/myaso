//! Offline, unpaced measurement of genuine Rust World::step_into alongside
//! the default-off Moon Coin MatchWon observation boundary.
 //!
 //! THIS IS NOT a deployed game, WebTransport latency, 60Hz SLA, consent,
 //! replay-safe proof, wallet or settlement test. Deliberately injects a fake
 //! MatchWon on every synthetic tick for the stress cases.

use myaso_server::{
    match_observer::{MatchWinObserver, ObserverCounters},
    simulation::{CombatEvent, World},
};
use std::{env, hint::black_box, process, time::Instant};

#[derive(Clone, Copy)]
enum Mode {
    Disabled,
    QuietReceiver,
    Drained,
    Full,
    Disconnected,
}

impl Mode {
    const ALL: [Self; 5] = [
        Self::Disabled,
        Self::QuietReceiver,
        Self::Drained,
        Self::Full,
        Self::Disconnected,
    ];

    const fn label(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::QuietReceiver => "enabled_no_win_events",
            Self::Drained => "synthetic_win_drained",
            Self::Full => "synthetic_win_queue_full",
            Self::Disconnected => "synthetic_win_receiver_closed",
        }
    }
}

#[derive(Clone, Copy)]
struct Percentiles {
    p50_ns: u64,
    p95_ns: u64,
    p99_ns: u64,
    worst_ns: u64,
}

impl Percentiles {
    fn from_samples(samples: &[u64]) -> Self {
        assert!(!samples.is_empty());
        let mut sorted = samples.to_vec();
        sorted.sort_unstable();
        let select = |pct: usize| sorted[((sorted.len() * pct).div_ceil(100) - 1).min(sorted.len() - 1)];
        Self {
            p50_ns: select(50),
            p95_ns: select(95),
            p99_ns: select(99),
            worst_ns: *sorted.last().expect("nonempty"),
        }
    }

    fn json(self) -> String {
        format!(
            r#"{{"p50_ns":{},"p95_ns":{},"p99_ns":{},"worst_ns":{}}}"#,
            self.p50_ns, self.p95_ns, self.p99_ns, self.worst_ns
        )
    }
}

struct Measurement {
    tick: Percentiles,
    observer: Percentiles,
    counters: ObserverCounters,
    drained: u64,
    ticks: usize,
    players: u32,
}

fn clock_ns(since: Instant) -> u64 {
    u64::try_from(since.elapsed().as_nanos()).unwrap_or(u64::MAX)
}

/// Measures a real World step with a researcher-controlled MatchWon source.
/// No real network players, account IDs, server mutex, filesystem or ingress.
fn measure(mode: Mode, ticks: usize, players: u32) -> Measurement {
    assert!((256..=20000).contains(&ticks));
    assert!((2..=256).contains(&players));

    let mut world = World::new(4096.0, 4096.0);
    for net_id in 1..=players {
        let slot = net_id - 1;
        let x = 120.0 + (slot % 16) as f32 * 190.0;
        let y = 120.0 + (slot / 16) as f32 * 190.0;
        assert!(world.add_player_at(net_id, x, y, 0.0));
    }

    let mut events = Vec::with_capacity(32);
    // Warm up the simulation before any measurements, not the results.
    for _ in 0..256 {
        world.step_into(&mut events);
    }

    let (observer, receiver) = match mode {
        Mode::Disabled => (MatchWinObserver::disabled(), None),
        _ => {
            let (observer, receiver) = MatchWinObserver::research_channel(1);
            (observer, Some(receiver))
        }
    };

    // Never confuse this deliberately invented event with a game result.
    let artificial_win = [CombatEvent::MatchWon {
        winner: 1,
        kills: 5,
    }];
    let synthetic_win = matches!(mode, Mode::Drained | Mode::Full | Mode::Disconnected);
    if matches!(mode, Mode::Full) {
        observer.observe(0, &artificial_win);
    }

    // Drop receiver to exercise a real disconnected channel, not mock status.
    let receiver = if matches!(mode, Mode::Disconnected) {
        None
    } else {
        receiver
    };

    let mut tick_times = Vec::with_capacity(ticks);
    let mut observer_times = Vec::with_capacity(ticks);
    let mut drained = 0_u64;
    for _ in 0..ticks {
        let start = Instant::now();
        world.step_into(&mut events);
        tick_times.push(clock_ns(start));

        let start = Instant::now();
        let source_events = if synthetic_win { &artificial_win[..] } else { &events[..] };
        observer.observe(world.tick, source_events);
        observer_times.push(clock_ns(start));

        // Outside the sampled step and observer timings.
        if matches!(mode, Mode::Drained) {
            if let Some(rx) = receiver.as_ref() {
                drained += u64::from(rx.try_recv().is_ok());
            }
        }
        black_box(world.tick);
    }
    Measurement {
        tick: Percentiles::from_samples(&tick_times),
        observer: Percentiles::from_samples(&observer_times),
        counters: observer.counters(),
        drained,
        ticks,
        players,
    }
}

fn positive_bounded(value: &str, prefix: &str, min: usize, max: usize) -> Result<usize, String> {
    let text = value.strip_prefix(prefix).ok_or_else(|| format!("invalid argument: {value}"))?;
    let n = text.parse::<usize>().map_err(|_| format!("invalid integer for {prefix}"))?;
    if !(min..=max).contains(&n) {
        return Err(format!("{prefix} must be between {min} and {max}"));
    }
    Ok(n)
}

fn parse_args(args: impl IntoIterator<Item = String>) -> Result<(usize, u32), String> {
    let mut ticks = 1024;
    let mut players = 64_u32;
    for arg in args {
        if arg.starts_with("--ticks=") {
            ticks = positive_bounded(&arg, "--ticks=", 256, 20000)?;
        } else if arg.starts_with("--players=") {
            players = u32::try_from(positive_bounded(&arg, "--players=", 2, 256)?)
                .expect("player count bounded");
        } else {
            return Err(format!("unrecognized argument: {arg}"));
        }
    }
    Ok((ticks, players))
}

fn main() {
    let (ticks, players) = parse_args(env::args().skip(1)).unwrap_or_else(|message| {
        eprintln!("moon_observer_tick_probe: {message}");
        process::exit(2)
    });
    for mode in Mode::ALL {
        let result = measure(mode, ticks, players);
        println!(
            "MOON_OBSERVER_UNPACED_WORLD_STEP={} ",
            format_args!(
                r#"{{"mode":"{}","ticks":{},"players":{},"step":{},"observer":{},"accepted":{},"full":{},"disconnected":{},"drained":{},"research_only":true,"live_60hz_proven":false}}"#,
                mode.label(),
                result.ticks,
                result.players,
                result.tick.json(),
                result.observer.json(),
                result.counters.accepted,
                result.counters.full,
                result.counters.disconnected,
                result.drained,
            )
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_quantiles_are_monotonic_without_lucky_cpu_assumptions() {
        let p = Percentiles::from_samples(&[9, 2, 4, 1, 7, 3, 8, 6, 5, 10]);
        assert!(p.p50_ns <= p.p95_ns);
        assert!(p.p95_ns <= p.p99_ns);
        assert!(p.p99_ns <= p.worst_ns);
        assert_eq!(p.worst_ns, 10);
    }

    #[test]
    fn stress_channels_account_for_full_disconnected_and_drained() {
        let ticks = 256;
        let normal = measure(Mode::Disabled, ticks, 2);
        assert_eq!(normal.counters, ObserverCounters::default());
        let quiet = measure(Mode::QuietReceiver, ticks, 2);
        assert_eq!(quiet.counters, ObserverCounters::default());
        let drained = measure(Mode::Drained, ticks, 2);
        assert_eq!(drained.counters.accepted, ticks as u64);
        assert_eq!(drained.drained, ticks as u64);
        assert_eq!(drained.counters.full, 0);
        let full = measure(Mode::Full, ticks, 2);
        assert_eq!(full.counters.accepted, 1);
        assert_eq!(full.counters.full, ticks as u64);
        let closed = measure(Mode::Disconnected, ticks, 2);
        assert_eq!(closed.counters.disconnected, ticks as u64);
        assert_eq!(closed.counters.accepted, 0);
    }

    #[test]
    fn rejects_invalid_unbounded_player_or_tick_requests() {
        assert!(parse_args(vec!["--ticks=255".to_string()]).is_err());
        assert!(parse_args(vec!["--ticks=20001".to_string()]).is_err());
        assert!(parse_args(vec!["--players=257".to_string()]).is_err());
        assert!(parse_args(vec!["--players=0".to_string()]).is_err());
        assert!(parse_args(vec!["--issue-moon".to_string()]).is_err());
    }
}
