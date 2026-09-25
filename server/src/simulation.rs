use std::collections::BTreeSet;

pub const DEFAULT_WORLD_WIDTH: f32 = 8192.0;
pub const DEFAULT_WORLD_HEIGHT: f32 = 8192.0;
pub const SERVER_TICK_HZ: f32 = 60.0;
pub const SERVER_DT_MS: f32 = 1000.0 / SERVER_TICK_HZ;
pub const FFA_KILL_TARGET: u16 = 2;
pub const FFA_MATCH_RESET_MS: f32 = 2500.0;

const FIGHTER_RADIUS: f32 = 18.0;
const MOVE_SPEED: f32 = 215.0;
const ATTACK_WINDUP_MS: f32 = 135.0;
const ATTACK_ACTIVE_MS: f32 = 80.0;
const ATTACK_RECOVERY_MS: f32 = 255.0;
const ATTACK_REACH: f32 = 76.0;
const ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.78;
const ATTACK_DAMAGE: f32 = 34.0;
const ATTACK_KNOCKBACK: f32 = 18.0;
const THRUST_WINDUP_MS: f32 = 120.0;
const THRUST_ACTIVE_MS: f32 = 70.0;
const THRUST_RECOVERY_MS: f32 = 235.0;
const THRUST_REACH: f32 = 94.0;
const THRUST_ARC_RADIANS: f32 = std::f32::consts::PI * 0.20;
const THRUST_DAMAGE: f32 = 30.0;
const THRUST_KNOCKBACK: f32 = 16.0;
const THRUST_GUARD_DAMAGE: f32 = 32.0;
const HEAVY_ATTACK_WINDUP_MS: f32 = 320.0;
const HEAVY_ATTACK_ACTIVE_MS: f32 = 100.0;
const HEAVY_ATTACK_RECOVERY_MS: f32 = 420.0;
const HEAVY_ATTACK_REACH: f32 = 82.0;
const HEAVY_ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.68;
const HEAVY_ATTACK_DAMAGE: f32 = 46.0;
const HEAVY_ATTACK_KNOCKBACK: f32 = 28.0;
const HEAVY_ATTACK_GUARD_DAMAGE: f32 = 64.0;
const DODGE_DURATION_MS: f32 = 170.0;
const DODGE_RECOVERY_MS: f32 = 180.0;
const DODGE_SPEED: f32 = 690.0;
const DODGE_IFRAME_MS: f32 = 125.0;
const DODGE_STAMINA_COST: f32 = 28.0;
const ROLL_COLLISION_KNOCKDOWN_MS: f32 = 260.0;
const ROLL_COLLISION_KNOCKBACK: f32 = 34.0;
const KICK_WINDUP_MS: f32 = 90.0;
const KICK_ACTIVE_MS: f32 = 70.0;
const KICK_RECOVERY_MS: f32 = 220.0;
const KICK_REACH: f32 = 48.0;
const KICK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.62;
const KICK_KNOCKDOWN_MS: f32 = 360.0;
const KICK_KNOCKBACK: f32 = 52.0;
const KICK_BLOCK_GUARD_DAMAGE: f32 = 30.0;
const KICK_STAMINA_COST: f32 = 18.0;
const JUMP_DURATION_MS: f32 = 430.0;
const JUMP_STAMINA_COST: f32 = 14.0;
const JUMP_MOVE_MULTIPLIER: f32 = 1.08;
const JUMP_ATTACK_WINDUP_MS: f32 = 105.0;
const JUMP_ATTACK_ACTIVE_MS: f32 = 105.0;
const JUMP_ATTACK_RECOVERY_MS: f32 = 290.0;
const JUMP_ATTACK_REACH: f32 = 48.0;
const JUMP_ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.24;
const JUMP_ATTACK_DAMAGE: f32 = 42.0;
const JUMP_ATTACK_KNOCKBACK: f32 = 34.0;
const JUMP_ATTACK_GUARD_DAMAGE: f32 = 52.0;
const JUMP_ATTACK_STAMINA_COST: f32 = 12.0;
const STAMINA_MAX: f32 = 100.0;
const STAMINA_REGEN_PER_SECOND: f32 = 30.0;
const STAMINA_REGEN_DELAY_MS: f32 = 360.0;
const RUN_STAMINA_DRAIN_PER_SECOND: f32 = 24.0;
const RUN_MOVE_MULTIPLIER: f32 = 1.55;
const BLOCK_PARRY_WINDOW_MS: f32 = 125.0;
const BLOCK_HALF_ANGLE_RADIANS: f32 = std::f32::consts::PI * 0.46;
const BLOCK_GUARD_DAMAGE: f32 = 38.0;
const BLOCK_GUARD_BREAK_STUN_MS: f32 = 520.0;
const GUARD_BREAK_POST_RECOVERY_PUNISH_MS: f32 =
    BLOCK_GUARD_BREAK_STUN_MS - ATTACK_ACTIVE_MS - ATTACK_RECOVERY_MS;
const HEAVY_GUARD_BREAK_STUN_MS: f32 =
    HEAVY_ATTACK_ACTIVE_MS + HEAVY_ATTACK_RECOVERY_MS + GUARD_BREAK_POST_RECOVERY_PUNISH_MS;
const BLOCK_PARRY_STUN_MS: f32 = 650.0;
const BLOCK_MOVE_MULTIPLIER: f32 = 0.42;
const GUARD_MAX: f32 = 100.0;
const GUARD_REGEN_PER_SECOND: f32 = 24.0;
const GUARD_REGEN_DELAY_MS: f32 = 520.0;
const RESPAWN_MS: f32 = 1250.0;
const EPSILON: f32 = 1e-6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    Idle,
    AttackWindup,
    AttackActive,
    AttackRecovery,
    ThrustWindup,
    ThrustActive,
    ThrustRecovery,
    HeavyAttackWindup,
    HeavyAttackActive,
    HeavyAttackRecovery,
    Dodge,
    DodgeRecovery,
    KickWindup,
    KickActive,
    KickRecovery,
    Jump,
    JumpAttackWindup,
    JumpAttackActive,
    JumpAttackRecovery,
    Block,
    Stunned,
    Knockdown,
    Dead,
}

impl Action {
    pub fn wire_code(self) -> u8 {
        match self {
            Self::Idle => 0,
            Self::AttackWindup => 1,
            Self::AttackActive => 2,
            Self::AttackRecovery => 3,
            Self::Dodge => 4,
            Self::DodgeRecovery => 5,
            Self::Block => 6,
            Self::Stunned => 7,
            Self::Dead => 8,
            Self::HeavyAttackWindup => 9,
            Self::HeavyAttackActive => 10,
            Self::HeavyAttackRecovery => 11,
            Self::KickWindup => 12,
            Self::KickActive => 13,
            Self::KickRecovery => 14,
            Self::Jump => 15,
            Self::JumpAttackWindup => 16,
            Self::JumpAttackActive => 17,
            Self::JumpAttackRecovery => 18,
            Self::Knockdown => 19,
            Self::ThrustWindup => 20,
            Self::ThrustActive => 21,
            Self::ThrustRecovery => 22,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct InputIntent {
    pub move_x: f32,
    pub move_y: f32,
    pub facing_radians: f32,
    pub attack: bool,
    pub heavy_attack: bool,
    pub dodge: bool,
    pub block: bool,
    pub kick: bool,
    pub run: bool,
    pub jump: bool,
}

impl Default for InputIntent {
    fn default() -> Self {
        Self {
            move_x: 0.0,
            move_y: 0.0,
            facing_radians: 0.0,
            attack: false,
            heavy_attack: false,
            dodge: false,
            block: false,
            kick: false,
            run: false,
            jump: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fighter {
    pub net_id: u32,
    pub x: f32,
    pub y: f32,
    pub spawn_x: f32,
    pub spawn_y: f32,
    pub facing: f32,
    pub hp: f32,
    pub guard: f32,
    pub stamina: f32,
    pub kills: u16,
    pub action: Action,
    pub action_elapsed_ms: f32,
    pub recently_interacted_with: Option<u32>,
    latest_input: InputIntent,
    action_duration_ms: f32,
    dodge_dir_x: f32,
    dodge_dir_y: f32,
    attack_hit_targets: BTreeSet<u32>,
    roll_hit_targets: BTreeSet<u32>,
    guard_regen_blocked_until_ms: f32,
    stamina_regen_blocked_until_ms: f32,
    respawn_at_ms: f32,
}

impl Fighter {
    fn new(net_id: u32, x: f32, y: f32, facing: f32) -> Self {
        Self {
            net_id,
            x,
            y,
            spawn_x: x,
            spawn_y: y,
            facing: normalize_angle(facing),
            hp: 100.0,
            guard: GUARD_MAX,
            stamina: STAMINA_MAX,
            kills: 0,
            action: Action::Idle,
            action_elapsed_ms: 0.0,
            recently_interacted_with: None,
            latest_input: InputIntent::default(),
            action_duration_ms: 0.0,
            dodge_dir_x: 0.0,
            dodge_dir_y: 0.0,
            attack_hit_targets: BTreeSet::new(),
            roll_hit_targets: BTreeSet::new(),
            guard_regen_blocked_until_ms: 0.0,
            stamina_regen_blocked_until_ms: 0.0,
            respawn_at_ms: 0.0,
        }
    }

    pub fn input(&self) -> InputIntent {
        self.latest_input
    }

    fn set_action(&mut self, action: Action, duration_ms: f32) {
        self.action = action;
        self.action_elapsed_ms = 0.0;
        self.action_duration_ms = duration_ms;
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum CombatEvent {
    Evade {
        attacker: u32,
        target: u32,
    },
    Parry {
        attacker: u32,
        target: u32,
    },
    Block {
        attacker: u32,
        target: u32,
    },
    GuardBreak {
        attacker: u32,
        target: u32,
    },
    Hit {
        attacker: u32,
        target: u32,
        damage: u8,
        hp: u8,
    },
    Death {
        fighter: u32,
        killer: u32,
    },
    Respawn {
        fighter: u32,
    },
    MatchWon {
        winner: u32,
        kills: u16,
    },
    MatchReset,
}

#[derive(Debug, Clone)]
pub struct World {
    pub width: f32,
    pub height: f32,
    pub now_ms: f32,
    pub tick: u32,
    winner: Option<u32>,
    reset_at_ms: f32,
    fighters: Vec<Fighter>,
}

impl Default for World {
    fn default() -> Self {
        Self::new(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT)
    }
}

impl World {
    pub fn new(width: f32, height: f32) -> Self {
        assert!(width > FIGHTER_RADIUS * 2.0);
        assert!(height > FIGHTER_RADIUS * 2.0);
        Self {
            width,
            height,
            now_ms: 0.0,
            tick: 0,
            winner: None,
            reset_at_ms: 0.0,
            fighters: Vec::new(),
        }
    }

    pub fn fighters(&self) -> &[Fighter] {
        &self.fighters
    }

    fn fighter_index(&self, net_id: u32) -> Result<usize, usize> {
        self.fighters
            .binary_search_by_key(&net_id, |fighter| fighter.net_id)
    }

    pub fn fighter(&self, net_id: u32) -> Option<&Fighter> {
        self.fighter_index(net_id)
            .ok()
            .map(|index| &self.fighters[index])
    }

    pub fn match_winner(&self) -> Option<u32> {
        self.winner
    }

    pub fn match_over(&self) -> bool {
        self.winner.is_some()
    }

    pub fn add_player(&mut self, net_id: u32) -> bool {
        let spacing = 96.0;
        let usable_width = (self.width - 2.0 * FIGHTER_RADIUS).max(spacing);
        let columns = (usable_width / spacing).floor().max(1.0) as u32;
        let index = net_id.saturating_sub(1);
        let x = FIGHTER_RADIUS + 24.0 + (index % columns) as f32 * spacing;
        let row = (index / columns) % columns.max(1);
        let y = FIGHTER_RADIUS + 24.0 + row as f32 * spacing;
        self.add_player_at(
            net_id,
            x.min(self.width - FIGHTER_RADIUS),
            y.min(self.height - FIGHTER_RADIUS),
            0.0,
        )
    }

    pub fn add_player_at(&mut self, net_id: u32, x: f32, y: f32, facing: f32) -> bool {
        if self.winner.is_some() || net_id == 0 {
            return false;
        }
        let insertion_index = match self.fighter_index(net_id) {
            Ok(_) => return false,
            Err(index) => index,
        };
        let fighter = Fighter::new(
            net_id,
            clamp(x, FIGHTER_RADIUS, self.width - FIGHTER_RADIUS),
            clamp(y, FIGHTER_RADIUS, self.height - FIGHTER_RADIUS),
            facing,
        );
        self.fighters.insert(insertion_index, fighter);
        true
    }

    pub fn remove_player(&mut self, net_id: u32) -> bool {
        let Ok(index) = self.fighter_index(net_id) else {
            return false;
        };
        self.fighters.remove(index);
        true
    }

    pub fn set_input(&mut self, net_id: u32, input: InputIntent) -> bool {
        if self.winner.is_some() {
            return false;
        }
        let Ok(index) = self.fighter_index(net_id) else {
            return false;
        };
        self.fighters[index].latest_input = normalize_input(input);
        true
    }

    pub fn step(&mut self) -> Vec<CombatEvent> {
        self.step_by(SERVER_DT_MS)
    }

    pub fn step_into(&mut self, events: &mut Vec<CombatEvent>) {
        self.step_by_into(SERVER_DT_MS, events);
    }

    pub fn step_by(&mut self, dt_ms: f32) -> Vec<CombatEvent> {
        let mut events = Vec::new();
        self.step_by_into(dt_ms, &mut events);
        events
    }

    pub fn step_by_into(&mut self, dt_ms: f32, events: &mut Vec<CombatEvent>) {
        assert!(dt_ms.is_finite() && dt_ms > 0.0 && dt_ms <= 100.0);
        events.clear();
        self.now_ms += dt_ms;
        self.tick = self.tick.wrapping_add(1);
        if self.winner.is_some() {
            if self.now_ms + EPSILON >= self.reset_at_ms {
                self.reset_match();
                events.push(CombatEvent::MatchReset);
            }
            return;
        }

        for fighter in &mut self.fighters {
            if fighter.action == Action::Dead {
                if self.now_ms >= fighter.respawn_at_ms {
                    respawn_fighter(fighter);
                    events.push(CombatEvent::Respawn {
                        fighter: fighter.net_id,
                    });
                }
                continue;
            }

            let input = normalize_input(fighter.latest_input);
            if fighter.action != Action::Knockdown {
                fighter.facing = normalize_angle(input.facing_radians);
            }
            begin_requested_action(self.now_ms, fighter, input);
            move_fighter(self.width, self.height, fighter, input, dt_ms);
            advance_action(fighter, input, dt_ms);
            update_stamina(self.now_ms, fighter, input, dt_ms);

            if fighter.action != Action::Block
                && self.now_ms >= fighter.guard_regen_blocked_until_ms
            {
                fighter.guard =
                    (fighter.guard + GUARD_REGEN_PER_SECOND * dt_ms / 1000.0).min(GUARD_MAX);
            }
        }

        resolve_roll_collisions(self.width, self.height, &mut self.fighters);
        separate_fighters(self.width, self.height, &mut self.fighters);
        if let Some(winner) = resolve_attacks(
            self.width,
            self.height,
            self.now_ms,
            &mut self.fighters,
            events,
        ) {
            self.winner = Some(winner);
            self.reset_at_ms = self.now_ms + FFA_MATCH_RESET_MS;
        }
    }

    fn reset_match(&mut self) {
        self.winner = None;
        self.reset_at_ms = 0.0;
        for fighter in &mut self.fighters {
            fighter.kills = 0;
            fighter.latest_input = InputIntent::default();
            fighter.guard_regen_blocked_until_ms = 0.0;
            fighter.stamina_regen_blocked_until_ms = 0.0;
            respawn_fighter(fighter);
        }
    }
}

fn normalize_input(mut input: InputIntent) -> InputIntent {
    if !input.move_x.is_finite() {
        input.move_x = 0.0;
    }
    if !input.move_y.is_finite() {
        input.move_y = 0.0;
    }
    if !input.facing_radians.is_finite() {
        input.facing_radians = 0.0;
    }
    let length = input.move_x.hypot(input.move_y);
    if length > 1.0 {
        input.move_x /= length;
        input.move_y /= length;
    }
    input
}

fn begin_requested_action(now_ms: f32, fighter: &mut Fighter, input: InputIntent) {
    if fighter.action == Action::Jump
        && input.attack
        && spend_stamina(now_ms, fighter, JUMP_ATTACK_STAMINA_COST)
    {
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::JumpAttackWindup, JUMP_ATTACK_WINDUP_MS);
        return;
    }

    let can_interrupt = matches!(fighter.action, Action::Idle | Action::Block);
    if !can_interrupt {
        return;
    }

    if input.dodge && spend_stamina(now_ms, fighter, DODGE_STAMINA_COST) {
        fighter.dodge_dir_x = fighter.facing.cos();
        fighter.dodge_dir_y = fighter.facing.sin();
        fighter.roll_hit_targets.clear();
        fighter.set_action(Action::Dodge, DODGE_DURATION_MS);
        return;
    }

    if input.kick
        && fighter.action == Action::Idle
        && spend_stamina(now_ms, fighter, KICK_STAMINA_COST)
    {
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::KickWindup, KICK_WINDUP_MS);
        return;
    }

    if input.jump
        && fighter.action == Action::Idle
        && spend_stamina(now_ms, fighter, JUMP_STAMINA_COST)
    {
        fighter.set_action(Action::Jump, JUMP_DURATION_MS);
        return;
    }

    if input.heavy_attack && fighter.action == Action::Idle {
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
        return;
    }

    if input.attack && fighter.action == Action::Idle {
        fighter.attack_hit_targets.clear();
        if is_forward_attack_input(fighter, input) {
            fighter.set_action(Action::ThrustWindup, THRUST_WINDUP_MS);
        } else {
            fighter.set_action(Action::AttackWindup, ATTACK_WINDUP_MS);
        }
        return;
    }

    if input.block {
        if fighter.action != Action::Block {
            fighter.set_action(Action::Block, f32::INFINITY);
        }
    } else if fighter.action == Action::Block {
        fighter.set_action(Action::Idle, 0.0);
    }
}

fn is_forward_attack_input(fighter: &Fighter, input: InputIntent) -> bool {
    let move_length = input.move_x.hypot(input.move_y);
    if move_length <= EPSILON {
        return false;
    }
    let forward_x = fighter.facing.cos();
    let forward_y = fighter.facing.sin();
    let dot = input.move_x / move_length * forward_x + input.move_y / move_length * forward_y;
    dot >= 0.65
}

fn move_fighter(width: f32, height: f32, fighter: &mut Fighter, input: InputIntent, dt_ms: f32) {
    let mut velocity_x = input.move_x * MOVE_SPEED;
    let mut velocity_y = input.move_y * MOVE_SPEED;
    if input.run && fighter.action == Action::Idle && fighter.stamina > EPSILON {
        velocity_x *= RUN_MOVE_MULTIPLIER;
        velocity_y *= RUN_MOVE_MULTIPLIER;
    }

    match fighter.action {
        Action::Dodge => {
            velocity_x = fighter.dodge_dir_x * DODGE_SPEED;
            velocity_y = fighter.dodge_dir_y * DODGE_SPEED;
        }
        Action::Block => {
            velocity_x *= BLOCK_MOVE_MULTIPLIER;
            velocity_y *= BLOCK_MOVE_MULTIPLIER;
        }
        Action::Jump => {
            velocity_x *= JUMP_MOVE_MULTIPLIER;
            velocity_y *= JUMP_MOVE_MULTIPLIER;
        }
        Action::JumpAttackWindup => {
            velocity_x *= 0.9;
            velocity_y *= 0.9;
        }
        Action::JumpAttackActive => {
            velocity_x *= 0.55;
            velocity_y *= 0.55;
        }
        Action::KickWindup => {
            velocity_x *= 0.45;
            velocity_y *= 0.45;
        }
        Action::KickActive => {
            velocity_x *= 0.2;
            velocity_y *= 0.2;
        }
        Action::ThrustWindup => {
            velocity_x *= 0.62;
            velocity_y *= 0.62;
        }
        Action::ThrustActive => {
            velocity_x *= 0.28;
            velocity_y *= 0.28;
        }
        Action::AttackWindup => {
            velocity_x *= 0.35;
            velocity_y *= 0.35;
        }
        Action::HeavyAttackWindup => {
            velocity_x *= 0.20;
            velocity_y *= 0.20;
        }
        Action::AttackActive | Action::HeavyAttackActive | Action::Stunned | Action::Knockdown => {
            velocity_x = 0.0;
            velocity_y = 0.0;
        }
        Action::ThrustRecovery => {
            velocity_x *= 0.52;
            velocity_y *= 0.52;
        }
        Action::AttackRecovery | Action::DodgeRecovery => {
            velocity_x *= 0.48;
            velocity_y *= 0.48;
        }
        Action::HeavyAttackRecovery => {
            velocity_x *= 0.35;
            velocity_y *= 0.35;
        }
        Action::KickRecovery | Action::JumpAttackRecovery => {
            velocity_x *= 0.42;
            velocity_y *= 0.42;
        }
        Action::Idle | Action::Dead => {}
    }

    let seconds = dt_ms / 1000.0;
    fighter.x = clamp(
        fighter.x + velocity_x * seconds,
        FIGHTER_RADIUS,
        width - FIGHTER_RADIUS,
    );
    fighter.y = clamp(
        fighter.y + velocity_y * seconds,
        FIGHTER_RADIUS,
        height - FIGHTER_RADIUS,
    );
}

fn advance_action(fighter: &mut Fighter, input: InputIntent, dt_ms: f32) {
    if matches!(fighter.action, Action::Idle | Action::Dead) {
        return;
    }
    fighter.action_elapsed_ms += dt_ms;

    if fighter.action == Action::Block {
        if !input.block {
            fighter.set_action(Action::Idle, 0.0);
        }
        return;
    }

    if fighter.action_elapsed_ms + EPSILON < fighter.action_duration_ms {
        return;
    }

    match fighter.action {
        Action::AttackWindup => fighter.set_action(Action::AttackActive, ATTACK_ACTIVE_MS),
        Action::AttackActive => fighter.set_action(Action::AttackRecovery, ATTACK_RECOVERY_MS),
        Action::AttackRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::ThrustWindup => fighter.set_action(Action::ThrustActive, THRUST_ACTIVE_MS),
        Action::ThrustActive => fighter.set_action(Action::ThrustRecovery, THRUST_RECOVERY_MS),
        Action::ThrustRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::HeavyAttackWindup => {
            fighter.set_action(Action::HeavyAttackActive, HEAVY_ATTACK_ACTIVE_MS)
        }
        Action::HeavyAttackActive => {
            fighter.set_action(Action::HeavyAttackRecovery, HEAVY_ATTACK_RECOVERY_MS)
        }
        Action::HeavyAttackRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::Dodge => fighter.set_action(Action::DodgeRecovery, DODGE_RECOVERY_MS),
        Action::DodgeRecovery | Action::Jump => fighter.set_action(Action::Idle, 0.0),
        Action::KickWindup => fighter.set_action(Action::KickActive, KICK_ACTIVE_MS),
        Action::KickActive => fighter.set_action(Action::KickRecovery, KICK_RECOVERY_MS),
        Action::KickRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::JumpAttackWindup => {
            fighter.set_action(Action::JumpAttackActive, JUMP_ATTACK_ACTIVE_MS)
        }
        Action::JumpAttackActive => {
            fighter.set_action(Action::JumpAttackRecovery, JUMP_ATTACK_RECOVERY_MS)
        }
        Action::JumpAttackRecovery | Action::Stunned | Action::Knockdown => {
            fighter.set_action(Action::Idle, 0.0)
        }
        Action::Idle | Action::Block | Action::Dead => {}
    }
}

fn spend_stamina(now_ms: f32, fighter: &mut Fighter, amount: f32) -> bool {
    if fighter.stamina + EPSILON < amount {
        return false;
    }
    fighter.stamina = (fighter.stamina - amount).max(0.0);
    fighter.stamina_regen_blocked_until_ms = now_ms + STAMINA_REGEN_DELAY_MS;
    true
}

fn update_stamina(now_ms: f32, fighter: &mut Fighter, input: InputIntent, dt_ms: f32) {
    if input.run
        && fighter.action == Action::Idle
        && input.move_x.hypot(input.move_y) > EPSILON
        && fighter.stamina > EPSILON
    {
        fighter.stamina =
            (fighter.stamina - RUN_STAMINA_DRAIN_PER_SECOND * dt_ms / 1000.0).max(0.0);
        fighter.stamina_regen_blocked_until_ms = now_ms + STAMINA_REGEN_DELAY_MS;
    } else if now_ms >= fighter.stamina_regen_blocked_until_ms {
        fighter.stamina =
            (fighter.stamina + STAMINA_REGEN_PER_SECOND * dt_ms / 1000.0).min(STAMINA_MAX);
    }
}

fn resolve_roll_collisions(width: f32, height: f32, fighters: &mut [Fighter]) {
    let contact = FIGHTER_RADIUS * 2.0 + 8.0;
    for roller_index in 0..fighters.len() {
        if fighters[roller_index].action != Action::Dodge {
            continue;
        }
        for target_index in 0..fighters.len() {
            if roller_index == target_index {
                continue;
            }
            let target_id = fighters[target_index].net_id;
            if fighters[target_index].action == Action::Dead
                || fighters[roller_index].roll_hit_targets.contains(&target_id)
            {
                continue;
            }
            let dx = fighters[target_index].x - fighters[roller_index].x;
            let dy = fighters[target_index].y - fighters[roller_index].y;
            if dx.hypot(dy) > contact {
                continue;
            }
            let (roller, target) = two_mut(fighters, roller_index, target_index);
            roller.roll_hit_targets.insert(target.net_id);
            knock_back(width, height, roller, target, ROLL_COLLISION_KNOCKBACK);
            target.set_action(Action::Knockdown, ROLL_COLLISION_KNOCKDOWN_MS);
        }
    }
}

fn separate_fighters(width: f32, height: f32, fighters: &mut [Fighter]) {
    let minimum_distance = FIGHTER_RADIUS * 2.0;
    let minimum_distance_sq = minimum_distance * minimum_distance;
    for first_index in 0..fighters.len() {
        for second_index in (first_index + 1)..fighters.len() {
            let (first, second) = two_mut(fighters, first_index, second_index);
            if first.action == Action::Dead || second.action == Action::Dead {
                continue;
            }
            let mut dx = second.x - first.x;
            let mut dy = second.y - first.y;
            if dx.abs() >= minimum_distance || dy.abs() >= minimum_distance {
                continue;
            }
            let distance_sq = dx * dx + dy * dy;
            if distance_sq >= minimum_distance_sq {
                continue;
            }
            let mut distance = distance_sq.sqrt();
            if distance_sq <= EPSILON * EPSILON {
                dx = first.facing.cos();
                dy = first.facing.sin();
                distance = 1.0;
            }
            let overlap = minimum_distance - distance;
            let nx = dx / distance;
            let ny = dy / distance;
            let shift = overlap / 2.0;
            first.x = clamp(first.x - nx * shift, FIGHTER_RADIUS, width - FIGHTER_RADIUS);
            first.y = clamp(
                first.y - ny * shift,
                FIGHTER_RADIUS,
                height - FIGHTER_RADIUS,
            );
            second.x = clamp(
                second.x + nx * shift,
                FIGHTER_RADIUS,
                width - FIGHTER_RADIUS,
            );
            second.y = clamp(
                second.y + ny * shift,
                FIGHTER_RADIUS,
                height - FIGHTER_RADIUS,
            );
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct AttackProfile {
    reach: f32,
    arc_radians: f32,
    damage: f32,
    knockback: f32,
    guard_damage: f32,
    guard_break_stun_ms: f32,
    kick: bool,
}

fn attack_profile(action: Action) -> Option<AttackProfile> {
    match action {
        Action::AttackActive => Some(AttackProfile {
            reach: ATTACK_REACH,
            arc_radians: ATTACK_ARC_RADIANS,
            damage: ATTACK_DAMAGE,
            knockback: ATTACK_KNOCKBACK,
            guard_damage: BLOCK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::ThrustActive => Some(AttackProfile {
            reach: THRUST_REACH,
            arc_radians: THRUST_ARC_RADIANS,
            damage: THRUST_DAMAGE,
            knockback: THRUST_KNOCKBACK,
            guard_damage: THRUST_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::HeavyAttackActive => Some(AttackProfile {
            reach: HEAVY_ATTACK_REACH,
            arc_radians: HEAVY_ATTACK_ARC_RADIANS,
            damage: HEAVY_ATTACK_DAMAGE,
            knockback: HEAVY_ATTACK_KNOCKBACK,
            guard_damage: HEAVY_ATTACK_GUARD_DAMAGE,
            guard_break_stun_ms: HEAVY_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::JumpAttackActive => Some(AttackProfile {
            reach: JUMP_ATTACK_REACH,
            arc_radians: JUMP_ATTACK_ARC_RADIANS,
            damage: JUMP_ATTACK_DAMAGE,
            knockback: JUMP_ATTACK_KNOCKBACK,
            guard_damage: JUMP_ATTACK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::KickActive => Some(AttackProfile {
            reach: KICK_REACH,
            arc_radians: KICK_ARC_RADIANS,
            damage: 0.0,
            knockback: KICK_KNOCKBACK,
            guard_damage: KICK_BLOCK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: true,
        }),
        _ => None,
    }
}

fn resolve_attacks(
    width: f32,
    height: f32,
    now_ms: f32,
    fighters: &mut [Fighter],
    events: &mut Vec<CombatEvent>,
) -> Option<u32> {
    for attacker_index in 0..fighters.len() {
        let Some(profile) = attack_profile(fighters[attacker_index].action) else {
            continue;
        };

        for target_index in 0..fighters.len() {
            if attacker_index == target_index {
                continue;
            }
            let target_id = fighters[target_index].net_id;
            if fighters[target_index].action == Action::Dead
                || fighters[attacker_index]
                    .attack_hit_targets
                    .contains(&target_id)
                || !is_target_in_attack_arc(
                    &fighters[attacker_index],
                    &fighters[target_index],
                    profile,
                )
            {
                continue;
            }

            let (attacker, target) = two_mut(fighters, attacker_index, target_index);
            attacker.attack_hit_targets.insert(target.net_id);
            attacker.recently_interacted_with = Some(target.net_id);
            target.recently_interacted_with = Some(attacker.net_id);

            if is_invulnerable(target) {
                events.push(CombatEvent::Evade {
                    attacker: attacker.net_id,
                    target: target.net_id,
                });
                continue;
            }

            if is_blocking_attack(target, attacker) {
                target.guard_regen_blocked_until_ms = now_ms + GUARD_REGEN_DELAY_MS;
                if target.action_elapsed_ms <= BLOCK_PARRY_WINDOW_MS {
                    attacker.set_action(Action::Stunned, BLOCK_PARRY_STUN_MS);
                    events.push(CombatEvent::Parry {
                        attacker: attacker.net_id,
                        target: target.net_id,
                    });
                    continue;
                }

                target.guard = (target.guard - profile.guard_damage).max(0.0);
                if target.guard <= EPSILON {
                    target.set_action(Action::Stunned, profile.guard_break_stun_ms);
                    events.push(CombatEvent::GuardBreak {
                        attacker: attacker.net_id,
                        target: target.net_id,
                    });
                } else {
                    events.push(CombatEvent::Block {
                        attacker: attacker.net_id,
                        target: target.net_id,
                    });
                }
                continue;
            }

            if profile.kick {
                knock_back(width, height, attacker, target, profile.knockback);
                target.set_action(Action::Knockdown, KICK_KNOCKDOWN_MS);
                continue;
            }

            target.hp = (target.hp - profile.damage).max(0.0);
            knock_back(width, height, attacker, target, profile.knockback);
            events.push(CombatEvent::Hit {
                attacker: attacker.net_id,
                target: target.net_id,
                damage: profile.damage.round() as u8,
                hp: target.hp.round() as u8,
            });

            if target.hp <= EPSILON {
                attacker.kills = attacker.kills.saturating_add(1);
                target.action = Action::Dead;
                target.action_elapsed_ms = 0.0;
                target.action_duration_ms = 0.0;
                target.respawn_at_ms = now_ms + RESPAWN_MS;
                events.push(CombatEvent::Death {
                    fighter: target.net_id,
                    killer: attacker.net_id,
                });
                if attacker.kills >= FFA_KILL_TARGET {
                    events.push(CombatEvent::MatchWon {
                        winner: attacker.net_id,
                        kills: attacker.kills,
                    });
                    return Some(attacker.net_id);
                }
            }
        }
    }
    None
}

fn is_target_in_attack_arc(attacker: &Fighter, target: &Fighter, profile: AttackProfile) -> bool {
    let dx = target.x - attacker.x;
    let dy = target.y - attacker.y;
    let maximum_distance = profile.reach + FIGHTER_RADIUS;
    if dx.abs() > maximum_distance || dy.abs() > maximum_distance {
        return false;
    }
    let center_distance_sq = dx * dx + dy * dy;
    if center_distance_sq > maximum_distance * maximum_distance {
        return false;
    }
    let angle_to_target = dy.atan2(dx);
    angle_delta(angle_to_target, attacker.facing).abs() <= profile.arc_radians / 2.0
}

fn is_invulnerable(target: &Fighter) -> bool {
    target.action == Action::Dodge && target.action_elapsed_ms <= DODGE_IFRAME_MS
}

fn is_blocking_attack(target: &Fighter, attacker: &Fighter) -> bool {
    if target.action != Action::Block {
        return false;
    }
    let angle_to_attacker = (attacker.y - target.y).atan2(attacker.x - target.x);
    angle_delta(angle_to_attacker, target.facing).abs() <= BLOCK_HALF_ANGLE_RADIANS
}

fn knock_back(width: f32, height: f32, attacker: &Fighter, target: &mut Fighter, distance: f32) {
    let dx = target.x - attacker.x;
    let dy = target.y - attacker.y;
    let length = dx.hypot(dy).max(1.0);
    target.x = clamp(
        target.x + dx / length * distance,
        FIGHTER_RADIUS,
        width - FIGHTER_RADIUS,
    );
    target.y = clamp(
        target.y + dy / length * distance,
        FIGHTER_RADIUS,
        height - FIGHTER_RADIUS,
    );
}

fn respawn_fighter(fighter: &mut Fighter) {
    fighter.x = fighter.spawn_x;
    fighter.y = fighter.spawn_y;
    fighter.hp = 100.0;
    fighter.guard = GUARD_MAX;
    fighter.stamina = STAMINA_MAX;
    fighter.respawn_at_ms = 0.0;
    fighter.attack_hit_targets.clear();
    fighter.roll_hit_targets.clear();
    fighter.stamina_regen_blocked_until_ms = 0.0;
    fighter.recently_interacted_with = None;
    fighter.set_action(Action::Idle, 0.0);
}

fn two_mut<T>(slice: &mut [T], first: usize, second: usize) -> (&mut T, &mut T) {
    assert_ne!(first, second);
    if first < second {
        let (left, right) = slice.split_at_mut(second);
        (&mut left[first], &mut right[0])
    } else {
        let (left, right) = slice.split_at_mut(first);
        (&mut right[0], &mut left[second])
    }
}

fn normalize_angle(value: f32) -> f32 {
    value.rem_euclid(std::f32::consts::TAU)
}

pub fn angle_delta(a: f32, b: f32) -> f32 {
    let mut delta = a - b;
    while delta > std::f32::consts::PI {
        delta -= std::f32::consts::TAU;
    }
    while delta < -std::f32::consts::PI {
        delta += std::f32::consts::TAU;
    }
    delta
}

fn clamp(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}
