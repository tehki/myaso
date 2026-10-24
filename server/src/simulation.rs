use std::collections::BTreeSet;

pub const DEFAULT_WORLD_WIDTH: f32 = 8192.0;
pub const DEFAULT_WORLD_HEIGHT: f32 = 8192.0;
pub const SERVER_TICK_HZ: f32 = 60.0;
pub const SERVER_DT_MS: f32 = 1000.0 / SERVER_TICK_HZ;
pub const FFA_KILL_TARGET: u16 = 5;
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
const DIRECTIONAL_ATTACK_WINDUP_MS: f32 = 135.0;
const DIRECTIONAL_ATTACK_ACTIVE_MS: f32 = 80.0;
const DIRECTIONAL_ATTACK_RECOVERY_MS: f32 = 255.0;
const DIRECTIONAL_ATTACK_REACH: f32 = 76.0;
const DIRECTIONAL_ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.62;
const DIRECTIONAL_ATTACK_ARC_OFFSET_RADIANS: f32 = std::f32::consts::PI * 0.16;
const DIRECTIONAL_ATTACK_LATERAL_THRESHOLD: f32 = 0.45;
const LIGHT_ATTACK_BUFFER_WINDOW_MS: f32 = 90.0;
const BLOCK_BUFFER_WINDOW_MS: f32 = 90.0;
const DODGE_BUFFER_WINDOW_MS: f32 = 90.0;
const JUMP_BUFFER_WINDOW_MS: f32 = 90.0;
const JUMP_ATTACK_BUFFER_WINDOW_MS: f32 = 90.0;
const KICK_BUFFER_WINDOW_MS: f32 = 90.0;
const RUNNING_ATTACK_WINDUP_MS: f32 = 160.0;
const RUNNING_ATTACK_ACTIVE_MS: f32 = 90.0;
const RUNNING_ATTACK_RECOVERY_MS: f32 = 310.0;
const RUNNING_ATTACK_REACH: f32 = 92.0;
const RUNNING_ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.58;
const RUNNING_ATTACK_DAMAGE: f32 = 30.0;
const RUNNING_ATTACK_KNOCKBACK: f32 = 22.0;
const RUNNING_ATTACK_GUARD_DAMAGE: f32 = 34.0;
const RUNNING_ATTACK_STAMINA_COST: f32 = 10.0;
const RUNNING_ATTACK_WINDUP_MOVE_MULTIPLIER: f32 = 0.9;
const RUNNING_ATTACK_ACTIVE_MOVE_MULTIPLIER: f32 = 0.6;
const RUNNING_ATTACK_RECOVERY_MOVE_MULTIPLIER: f32 = 0.42;
const HEAVY_ATTACK_WINDUP_MS: f32 = 320.0;
const HEAVY_ATTACK_ACTIVE_MS: f32 = 100.0;
const HEAVY_ATTACK_RECOVERY_MS: f32 = 420.0;
const HEAVY_ATTACK_REACH: f32 = 82.0;
const HEAVY_ATTACK_LUNGE_SPEED: f32 = 240.0;
const HEAVY_ATTACK_ARC_RADIANS: f32 = std::f32::consts::PI * 0.68;
const HEAVY_ATTACK_DAMAGE: f32 = 46.0;
const HEAVY_ATTACK_KNOCKBACK: f32 = 28.0;
const HEAVY_ATTACK_GUARD_DAMAGE: f32 = 64.0;
const DASH_DURATION_MS: f32 = 140.0;
const DASH_SPEED: f32 = 750.0;
const DASH_STAMINA_COST: f32 = 20.0;
const DASH_COOLDOWN_MS: f32 = 3000.0;
const DODGE_DURATION_MS: f32 = 170.0;
const DODGE_RECOVERY_MS: f32 = 180.0;
const DODGE_SPEED: f32 = 690.0;
const DODGE_IFRAME_MS: f32 = 125.0;
const DODGE_STAMINA_COST: f32 = 28.0;
const ROLL_COLLISION_KNOCKDOWN_MS: f32 = 520.0;
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
const FEINT_LIGHT_WINDOW_MS: f32 = 70.0;
const FEINT_HEAVY_WINDOW_MS: f32 = 160.0;
const FEINT_RECOVERY_MS: f32 = 270.0;
const FEINT_STAMINA_COST: f32 = 12.0;
const FEINT_MOVE_MULTIPLIER: f32 = 0.5;
const BLOCK_PARRY_WINDOW_MS: f32 = 125.0;
const BLOCK_HALF_ANGLE_RADIANS: f32 = std::f32::consts::PI * 0.46;
const BLOCK_GUARD_DAMAGE: f32 = 38.0;
const BLOCK_GUARD_BREAK_STUN_MS: f32 = 650.0;
const GUARD_BREAK_POST_RECOVERY_PUNISH_MS: f32 =
    BLOCK_GUARD_BREAK_STUN_MS - ATTACK_ACTIVE_MS - ATTACK_RECOVERY_MS;
const HEAVY_GUARD_BREAK_STUN_MS: f32 =
    HEAVY_ATTACK_ACTIVE_MS + HEAVY_ATTACK_RECOVERY_MS + GUARD_BREAK_POST_RECOVERY_PUNISH_MS;
const BLOCK_PARRY_STUN_MS: f32 = 650.0;
const BLOCK_MOVE_MULTIPLIER: f32 = 0.5;
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
    AttackLeftWindup,
    AttackLeftActive,
    AttackLeftRecovery,
    AttackRightWindup,
    AttackRightActive,
    AttackRightRecovery,
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
    FeintRecovery,
    RunningAttackWindup,
    RunningAttackActive,
    RunningAttackRecovery,
    Block,
    Stunned,
    Knockdown,
    Dead,
    Dash,
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
            Self::FeintRecovery => 20,
            Self::RunningAttackWindup => 21,
            Self::RunningAttackActive => 22,
            Self::RunningAttackRecovery => 23,
            Self::AttackLeftWindup => 24,
            Self::AttackLeftActive => 25,
            Self::AttackLeftRecovery => 26,
            Self::AttackRightWindup => 27,
            Self::AttackRightActive => 28,
            Self::AttackRightRecovery => 29,
            Self::Dash => 30,
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
    pub dash: bool,
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
            dash: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct ActionEdges {
    attack: bool,
    heavy_attack: bool,
    block: bool,
    dodge: bool,
    kick: bool,
    jump: bool,
    dash: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fighter {
    pub net_id: u32,
    world_incarnation: u64,
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
    pending_attack: bool,
    pending_heavy_attack: bool,
    pending_dodge: bool,
    pending_kick: bool,
    pending_jump: bool,
    pending_dash: bool,
    action_duration_ms: f32,
    attack_input_was_down: bool,
    heavy_attack_input_was_down: bool,
    charging_heavy: bool,
    // Only genuine review-v2 owned action may accept preview commands;
    // normal v1 KeyE and LMB attacks must never be hijacked by this bridge.
    gesture_review_owns_light: bool,
    // Dormant reviewed v2 gesture ownership; no network/runtime callers.
    // Original v1 input release handling is unchanged when this is false.
    gesture_review_owns_held_charge: bool,
    block_input_was_down: bool,
    dodge_input_was_down: bool,
    kick_input_was_down: bool,
    jump_input_was_down: bool,
    dash_input_was_down: bool,
    dash_ready_at_ms: f32,
    dash_dir_x: f32,
    dash_dir_y: f32,
    buffered_light_attack: bool,
    buffered_attack_lateral: f32,
    buffered_block: bool,
    buffered_dodge: bool,
    buffered_dodge_dir_x: f32,
    buffered_dodge_dir_y: f32,
    buffered_kick: bool,
    buffered_jump: bool,
    buffered_jump_attack: bool,
    dodge_dir_x: f32,
    dodge_dir_y: f32,
    attack_hit_targets: BTreeSet<u32>,
    roll_hit_targets: BTreeSet<u32>,
    guard_regen_blocked_until_ms: f32,
    stamina_regen_blocked_until_ms: f32,
    respawn_at_ms: f32,
}

impl Fighter {
    pub fn world_incarnation(&self) -> u64 {
        self.world_incarnation
    }

    fn new(net_id: u32, x: f32, y: f32, facing: f32, world_incarnation: u64) -> Self {
        Self {
            net_id,
            world_incarnation,
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
            pending_attack: false,
            pending_heavy_attack: false,
            pending_dodge: false,
            pending_kick: false,
            pending_jump: false,
            pending_dash: false,
            action_duration_ms: 0.0,
            attack_input_was_down: false,
            heavy_attack_input_was_down: false,
            charging_heavy: false,
            gesture_review_owns_light: false,
            gesture_review_owns_held_charge: false,
            block_input_was_down: false,
            dodge_input_was_down: false,
            kick_input_was_down: false,
            jump_input_was_down: false,
            dash_input_was_down: false,
            dash_ready_at_ms: 0.0,
            dash_dir_x: 0.0,
            dash_dir_y: 0.0,
            buffered_light_attack: false,
            buffered_attack_lateral: 0.0,
            buffered_block: false,
            buffered_dodge: false,
            buffered_dodge_dir_x: 0.0,
            buffered_dodge_dir_y: 0.0,
            buffered_kick: false,
            buffered_jump: false,
            buffered_jump_attack: false,
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

    fn latch_action_edges(&mut self, input: InputIntent) {
        // A completed LMB charge sends ONE of the release modes below. When
        // press and release arrive between two server ticks, pending edges
        // must not OR the prior dual-bit HOLD back into this newer input.
        // Otherwise a 10ms authentic light release can be interpreted as an
        // endless heavy charge and cause no guard/damage contact at all.
        if self.latest_input.attack
            && self.latest_input.heavy_attack
            && !(input.attack && input.heavy_attack)
        {
            // Preserve the chosen release as a one-tick pulse. A following
            // neutral input can arrive before world.step() and must not erase
            // an authentic short LMB click or completed heavy release.
            // An all-zero transition is still cancellation, never a strike.
            self.pending_attack = input.attack;
            self.pending_heavy_attack = input.heavy_attack;
        }
        self.pending_attack |= input.attack && !self.latest_input.attack;
        self.pending_heavy_attack |= input.heavy_attack && !self.latest_input.heavy_attack;
        self.pending_dodge |= input.dodge && !self.latest_input.dodge;
        self.pending_kick |= input.kick && !self.latest_input.kick;
        self.pending_jump |= input.jump && !self.latest_input.jump;
        self.pending_dash |= input.dash && !self.latest_input.dash;
    }

    fn input_with_pending_actions(&self) -> InputIntent {
        let mut input = self.latest_input;
        input.attack |= self.pending_attack;
        input.heavy_attack |= self.pending_heavy_attack;
        input.dodge |= self.pending_dodge;
        input.kick |= self.pending_kick;
        input.jump |= self.pending_jump;
        input.dash |= self.pending_dash;
        input
    }

    fn clear_pending_actions(&mut self) {
        self.pending_attack = false;
        self.pending_heavy_attack = false;
        self.pending_dodge = false;
        self.pending_kick = false;
        self.pending_jump = false;
        self.pending_dash = false;
    }

    fn clear_light_attack_buffer(&mut self) {
        self.buffered_light_attack = false;
        self.buffered_attack_lateral = 0.0;
    }

    fn clear_buffered_dodge(&mut self) {
        self.buffered_dodge = false;
        self.buffered_dodge_dir_x = 0.0;
        self.buffered_dodge_dir_y = 0.0;
    }

    fn clear_recovery_input_buffer(&mut self) {
        self.clear_light_attack_buffer();
        self.buffered_block = false;
        self.clear_buffered_dodge();
        self.buffered_kick = false;
        self.buffered_jump = false;
        self.buffered_jump_attack = false;
    }

    fn begin_dodge(&mut self, dir_x: f32, dir_y: f32) {
        self.clear_recovery_input_buffer();
        self.dodge_dir_x = dir_x;
        self.dodge_dir_y = dir_y;
        self.roll_hit_targets.clear();
        self.set_action(Action::Dodge, DODGE_DURATION_MS);
    }

    fn begin_kick(&mut self) {
        self.clear_recovery_input_buffer();
        self.attack_hit_targets.clear();
        self.set_action(Action::KickWindup, KICK_WINDUP_MS);
    }

    fn begin_jump_attack(&mut self) {
        self.clear_recovery_input_buffer();
        self.attack_hit_targets.clear();
        self.set_action(Action::JumpAttackWindup, JUMP_ATTACK_WINDUP_MS);
    }

    fn begin_light_attack(&mut self, lateral: f32) {
        self.clear_recovery_input_buffer();
        self.attack_hit_targets.clear();
        if lateral >= DIRECTIONAL_ATTACK_LATERAL_THRESHOLD {
            self.set_action(Action::AttackLeftWindup, DIRECTIONAL_ATTACK_WINDUP_MS);
        } else if lateral <= -DIRECTIONAL_ATTACK_LATERAL_THRESHOLD {
            self.set_action(Action::AttackRightWindup, DIRECTIONAL_ATTACK_WINDUP_MS);
        } else {
            self.set_action(Action::AttackWindup, ATTACK_WINDUP_MS);
        }
    }

    fn finish_light_recovery(&mut self, now_ms: f32) {
        if self.buffered_kick {
            if spend_stamina(now_ms, self, KICK_STAMINA_COST) {
                self.begin_kick();
            } else {
                self.set_action(Action::Idle, 0.0);
            }
            return;
        }
        if self.buffered_jump_attack {
            if spend_stamina(now_ms, self, JUMP_STAMINA_COST + JUMP_ATTACK_STAMINA_COST) {
                self.begin_jump_attack();
            } else {
                self.set_action(Action::Idle, 0.0);
            }
            return;
        }
        if self.buffered_jump {
            if spend_stamina(now_ms, self, JUMP_STAMINA_COST) {
                self.set_action(Action::Jump, JUMP_DURATION_MS);
            } else {
                self.set_action(Action::Idle, 0.0);
            }
            return;
        }
        if self.buffered_dodge {
            let dir_x = self.buffered_dodge_dir_x;
            let dir_y = self.buffered_dodge_dir_y;
            if spend_stamina(now_ms, self, DODGE_STAMINA_COST) {
                self.begin_dodge(dir_x, dir_y);
            } else {
                self.set_action(Action::Idle, 0.0);
            }
            return;
        }
        if self.buffered_block {
            self.clear_recovery_input_buffer();
            self.set_action(Action::Block, f32::INFINITY);
            return;
        }
        if !self.buffered_light_attack {
            self.set_action(Action::Idle, 0.0);
            return;
        }
        let lateral = self.buffered_attack_lateral;
        self.begin_light_attack(lateral);
    }

    fn set_action(&mut self, action: Action, duration_ms: f32) {
        if !matches!(
            action,
            Action::AttackWindup
                | Action::AttackLeftWindup
                | Action::AttackRightWindup
                | Action::HeavyAttackWindup
        ) {
            self.gesture_review_owns_light = false;
        }
        if action != Action::HeavyAttackWindup {
            self.charging_heavy = false;
            self.gesture_review_owns_held_charge = false;
        }
        if !matches!(
            action,
            Action::AttackRecovery | Action::AttackLeftRecovery | Action::AttackRightRecovery
        ) {
            self.clear_recovery_input_buffer();
        }
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

#[derive(Debug)]
pub struct World {
    pub width: f32,
    pub height: f32,
    pub now_ms: f32,
    pub tick: u32,
    winner: Option<u32>,
    reset_at_ms: f32,
    fighters: Vec<Fighter>,
    next_world_incarnation: u64,
    world_instance: u64,
}

// Cloning an entire World creates a NEW owner; never alias the source
// instance epoch across independent authoritative World objects.
impl Clone for World {
    fn clone(&self) -> Self {
        Self {
            width: self.width,
            height: self.height,
            now_ms: self.now_ms,
            tick: self.tick,
            winner: self.winner,
            reset_at_ms: self.reset_at_ms,
            fighters: self.fighters.clone(),
            next_world_incarnation: self.next_world_incarnation,
            world_instance: reserve_world_instance(),
        }
    }
}

impl Default for World {
    fn default() -> Self {
        Self::new(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT)
    }
}

impl World {
    pub fn world_instance(&self) -> u64 {
        self.world_instance
    }

    fn new_incarnation(&mut self) -> u64 {
        let n = self.next_world_incarnation;
        self.next_world_incarnation = n.checked_add(1).expect("World actor life epoch exhausted");
        n
    }

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
            next_world_incarnation: 1,
            world_instance: reserve_world_instance(),
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
        let world_incarnation = self.new_incarnation();
        let fighter = Fighter::new(
            net_id,
            clamp(x, FIGHTER_RADIUS, self.width - FIGHTER_RADIUS),
            clamp(y, FIGHTER_RADIUS, self.height - FIGHTER_RADIUS),
            facing,
            world_incarnation,
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
        let input = normalize_input(input);
        self.fighters[index].latch_action_edges(input);
        self.fighters[index].latest_input = input;
        true
    }

    /// REVIEW-ONLY bridge for the separately authenticated LMBGesture v2
    /// reducer. There are NO runtime callers and v1 input wire is unchanged.
    /// Core8A/8C must later bind commands to the real player lease and world
    /// tick, atomically arbitrate KeyE/Space/RMB/roll/parry, and never let a
    /// remote caller directly select a command or an actor.
    pub fn apply_review_only_lmb_gesture_command(
        &mut self,
        net_id: u32,
        command: crate::prealpha_lmb_gesture_authority::Command,
    ) -> bool {
        use crate::prealpha_lmb_gesture_authority::Command;
        if self.winner.is_some() {
            return false;
        }
        let Ok(index) = self.fighter_index(net_id) else {
            return false;
        };
        let fighter = &mut self.fighters[index];
        if fighter.action == Action::Dead {
            return false;
        }
        match command {
            Command::BeginLightWindup
                if fighter.action == Action::Idle
                    && !fighter.latest_input.block
                    && !fighter.latest_input.dodge
                    && !fighter.latest_input.kick
                    && !fighter.latest_input.jump
                    && !fighter.latest_input.dash =>
            {
                let lateral = fighter.facing.sin() * fighter.latest_input.move_x
                    - fighter.facing.cos() * fighter.latest_input.move_y;
                fighter.begin_light_attack(lateral);
                fighter.gesture_review_owns_light = true;
                true
            }
            Command::BeginKeyEHeavy
                if fighter.action == Action::Idle
                    && !fighter.latest_input.block
                    && !fighter.latest_input.dodge
                    && !fighter.latest_input.kick
                    && !fighter.latest_input.jump
                    && !fighter.latest_input.dash =>
            {
                // Separate KeyE cannot upgrade or inherit an LMB gesture.
                // READY never auto-hits; matching KeyE RELEASE owns 46HP.
                fighter.attack_hit_targets.clear();
                fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
                fighter.charging_heavy = true;
                fighter.gesture_review_owns_held_charge = true;
                true
            }
            Command::UpgradeHeldHeavy { server_elapsed_ms }
                if matches!(
                    fighter.action,
                    Action::AttackWindup | Action::AttackLeftWindup | Action::AttackRightWindup
                ) && fighter.gesture_review_owns_light
                    && fighter.action_elapsed_ms + EPSILON < ATTACK_WINDUP_MS
                    && (fighter.action_elapsed_ms - server_elapsed_ms as f32).abs()
                        <= SERVER_DT_MS + 2.0 =>
            {
                // Already-active or already-landed light NEVER upgrades.
                // Keep the actual original World windup time, not a client
                // timestamp, and hold until server-approved heavy RELEASE.
                let elapsed = fighter.action_elapsed_ms;
                fighter.attack_hit_targets.clear();
                fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
                fighter.action_elapsed_ms = elapsed;
                fighter.charging_heavy = true;
                fighter.gesture_review_owns_held_charge = true;
                true
            }
            Command::ResumeLight { server_elapsed_ms }
                if fighter.action == Action::HeavyAttackWindup
                    && fighter.gesture_review_owns_light
                    && fighter.charging_heavy
                    && fighter.action_elapsed_ms + EPSILON < HEAVY_ATTACK_WINDUP_MS
                    && (fighter.action_elapsed_ms - server_elapsed_ms as f32).abs()
                        <= SERVER_DT_MS + 2.0 =>
            {
                let elapsed = fighter.action_elapsed_ms;
                let lateral = fighter.facing.sin() * fighter.latest_input.move_x
                    - fighter.facing.cos() * fighter.latest_input.move_y;
                fighter.begin_light_attack(lateral);
                // An undercharged RELEASE can never reset original light
                // time, add a second damage window, or secretly become heavy.
                fighter.action_elapsed_ms = elapsed;
                true
            }
            Command::ReleaseHeavy
                if fighter.action == Action::HeavyAttackWindup
                    && fighter.gesture_review_owns_held_charge
                    && fighter.charging_heavy
                    && fighter.action_elapsed_ms + EPSILON >= HEAVY_ATTACK_WINDUP_MS =>
            {
                fighter.attack_hit_targets.clear();
                fighter.set_action(Action::HeavyAttackActive, HEAVY_ATTACK_ACTIVE_MS);
                true
            }
            Command::CancelKeyEHeavy
                if fighter.action == Action::HeavyAttackWindup
                    && !fighter.gesture_review_owns_light
                    && fighter.gesture_review_owns_held_charge
                    && fighter.charging_heavy
                    && fighter.attack_hit_targets.is_empty() =>
            {
                fighter.set_action(Action::Idle, 0.0);
                fighter.clear_pending_actions();
                true
            }
            Command::CancelUnlandedLight
                if fighter.gesture_review_owns_light
                    && (matches!(
                        fighter.action,
                        Action::AttackWindup | Action::AttackLeftWindup | Action::AttackRightWindup
                    ) || (fighter.action == Action::HeavyAttackWindup
                        && fighter.charging_heavy))
                    && fighter.attack_hit_targets.is_empty() =>
            {
                fighter.set_action(Action::Idle, 0.0);
                fighter.clear_pending_actions();
                true
            }
            Command::ActivateLight => matches!(
                fighter.action,
                Action::AttackActive
                    | Action::AttackLeftActive
                    | Action::AttackRightActive
                    | Action::AttackRecovery
                    | Action::AttackLeftRecovery
                    | Action::AttackRightRecovery
            ),
            Command::HeavyReady => {
                fighter.action == Action::HeavyAttackWindup
                    && fighter.gesture_review_owns_held_charge
                    && fighter.charging_heavy
                    && fighter.action_elapsed_ms + EPSILON >= HEAVY_ATTACK_WINDUP_MS
            }
            _ => false,
        }
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
                    fighter.world_incarnation =
                        reserve_actor_life(&mut self.next_world_incarnation);
                    respawn_fighter(fighter);
                    events.push(CombatEvent::Respawn {
                        fighter: fighter.net_id,
                    });
                }
                continue;
            }

            let input = normalize_input(fighter.input_with_pending_actions());
            let edges = ActionEdges {
                attack: input.attack && !fighter.attack_input_was_down,
                heavy_attack: input.heavy_attack && !fighter.heavy_attack_input_was_down,
                block: input.block && !fighter.block_input_was_down,
                dodge: input.dodge && !fighter.dodge_input_was_down,
                kick: input.kick && !fighter.kick_input_was_down,
                jump: input.jump && !fighter.jump_input_was_down,
                dash: input.dash && !fighter.dash_input_was_down,
            };
            if fighter.action != Action::Knockdown {
                fighter.facing = normalize_angle(input.facing_radians);
            }
            begin_requested_action(self.now_ms, fighter, input, edges);
            move_fighter(self.width, self.height, fighter, input, dt_ms);
            advance_action(self.now_ms, fighter, input, dt_ms);
            update_stamina(self.now_ms, fighter, input, dt_ms);
            fighter.attack_input_was_down = input.attack;
            fighter.heavy_attack_input_was_down = input.heavy_attack;
            fighter.block_input_was_down = input.block;
            fighter.dodge_input_was_down = input.dodge;
            fighter.kick_input_was_down = input.kick;
            fighter.jump_input_was_down = input.jump;
            fighter.dash_input_was_down = input.dash;
            fighter.clear_pending_actions();

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
            fighter.clear_pending_actions();
            fighter.guard_regen_blocked_until_ms = 0.0;
            fighter.stamina_regen_blocked_until_ms = 0.0;
            fighter.world_incarnation = reserve_actor_life(&mut self.next_world_incarnation);
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

fn begin_requested_action(
    now_ms: f32,
    fighter: &mut Fighter,
    input: InputIntent,
    edges: ActionEdges,
) {
    let light_recovery = matches!(
        fighter.action,
        Action::AttackRecovery | Action::AttackLeftRecovery | Action::AttackRightRecovery
    );
    if light_recovery && (edges.attack || edges.block || edges.dodge || edges.kick || edges.jump) {
        let remaining_ms = fighter.action_duration_ms - fighter.action_elapsed_ms;
        if edges.block && remaining_ms <= BLOCK_BUFFER_WINDOW_MS + EPSILON {
            fighter.clear_light_attack_buffer();
            fighter.clear_buffered_dodge();
            fighter.buffered_kick = false;
            fighter.buffered_jump = false;
            fighter.buffered_jump_attack = false;
            fighter.buffered_block = true;
        } else if edges.dodge
            && remaining_ms <= DODGE_BUFFER_WINDOW_MS + EPSILON
            && (fighter.stamina + EPSILON >= DODGE_STAMINA_COST || edges.attack)
        {
            if fighter.stamina + EPSILON >= DODGE_STAMINA_COST {
                fighter.clear_light_attack_buffer();
                fighter.buffered_block = false;
                fighter.buffered_dodge = true;
                fighter.buffered_dodge_dir_x = fighter.facing.cos();
                fighter.buffered_dodge_dir_y = fighter.facing.sin();
                fighter.buffered_kick = false;
                fighter.buffered_jump = false;
                fighter.buffered_jump_attack = false;
            }
            // Exhausted wheel-forward still owns a simultaneous light edge,
            // while preserving any attack buffered on an earlier input tick.
        } else if edges.jump
            && edges.attack
            && remaining_ms <= JUMP_ATTACK_BUFFER_WINDOW_MS + EPSILON
            && fighter.stamina + EPSILON >= JUMP_STAMINA_COST + JUMP_ATTACK_STAMINA_COST
        {
            fighter.clear_light_attack_buffer();
            fighter.buffered_block = false;
            fighter.clear_buffered_dodge();
            fighter.buffered_kick = false;
            fighter.buffered_jump = false;
            fighter.buffered_jump_attack = true;
        } else if edges.jump
            && edges.attack
            && remaining_ms <= JUMP_BUFFER_WINDOW_MS + EPSILON
            && fighter.stamina + EPSILON < JUMP_STAMINA_COST
        {
            // An exhausted Space+LMB chord must not create a free light buffer.
            // Preserve any earlier buffered attack when this jump is denied.
        } else if edges.jump
            && remaining_ms <= JUMP_BUFFER_WINDOW_MS + EPSILON
            && fighter.stamina + EPSILON >= JUMP_STAMINA_COST
        {
            fighter.clear_light_attack_buffer();
            fighter.buffered_block = false;
            fighter.clear_buffered_dodge();
            fighter.buffered_kick = false;
            fighter.buffered_jump_attack = false;
            fighter.buffered_jump = true;
        } else if edges.kick
            && remaining_ms <= KICK_BUFFER_WINDOW_MS + EPSILON
            && (fighter.stamina + EPSILON >= KICK_STAMINA_COST || edges.attack)
        {
            if fighter.stamina + EPSILON >= KICK_STAMINA_COST {
                fighter.clear_light_attack_buffer();
                fighter.buffered_block = false;
                fighter.clear_buffered_dodge();
                fighter.buffered_jump = false;
                fighter.buffered_jump_attack = false;
                fighter.buffered_kick = true;
            }
            // Exhausted short-RMB still owns a simultaneous LMB edge, while
            // preserving any light attack buffered on an earlier input tick.
        } else if edges.attack && remaining_ms <= LIGHT_ATTACK_BUFFER_WINDOW_MS + EPSILON {
            fighter.buffered_block = false;
            fighter.clear_buffered_dodge();
            fighter.buffered_kick = false;
            fighter.buffered_jump = false;
            fighter.buffered_jump_attack = false;
            fighter.buffered_light_attack = true;
            fighter.buffered_attack_lateral =
                fighter.facing.sin() * input.move_x - fighter.facing.cos() * input.move_y;
        }
        return;
    }

    let feint_window_ms = match fighter.action {
        Action::AttackWindup | Action::AttackLeftWindup | Action::AttackRightWindup => {
            FEINT_LIGHT_WINDOW_MS
        }
        Action::HeavyAttackWindup => FEINT_HEAVY_WINDOW_MS,
        _ => 0.0,
    };
    if feint_window_ms > 0.0
        && input.block
        && fighter.action_elapsed_ms <= feint_window_ms
        && spend_stamina(now_ms, fighter, FEINT_STAMINA_COST)
    {
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::FeintRecovery, FEINT_RECOVERY_MS);
        return;
    }

    // The proposed lease-authorized v2 gesture reducer owns held READY
    // independently of old v1 button snapshots. Without this explicit fence,
    // a missing v1 attack+heavy pair would cancel the authenticated charge.
    // The normal legacy path below remains unchanged for all active clients.
    if fighter.charging_heavy && fighter.gesture_review_owns_held_charge {
        return;
    }
    // Combo attack+heavy flags are a sustained LMB charge. The server owns
    // the 320ms windup; reaching READY never emits an attack while held.
    if fighter.charging_heavy {
        if input.attack && input.heavy_attack {
            return;
        }
        fighter.charging_heavy = false;
        // An untrusted client may claim READY before this server has counted
        // 320ms of continuous hold. Never extend that early release into a
        // delayed heavy hit: it resolves as the same light/running-light that
        // an honest client sends on release before READY.
        if input.heavy_attack
            && !input.attack
            && fighter.action_elapsed_ms + EPSILON >= HEAVY_ATTACK_WINDUP_MS
        {
            return; // READY: advance_action commits the charged hit this tick.
        }
        if (input.attack && !input.heavy_attack) || (input.heavy_attack && !input.attack) {
            if input.jump
                && spend_stamina(
                    now_ms,
                    fighter,
                    JUMP_STAMINA_COST + JUMP_ATTACK_STAMINA_COST,
                )
            {
                fighter.begin_jump_attack();
            } else if input.run && input.move_x.hypot(input.move_y) >= 0.5 {
                if spend_stamina(now_ms, fighter, RUNNING_ATTACK_STAMINA_COST) {
                    fighter.attack_hit_targets.clear();
                    fighter.set_action(Action::RunningAttackWindup, RUNNING_ATTACK_WINDUP_MS);
                } else {
                    fighter.set_action(Action::Idle, 0.0);
                }
            } else {
                let lateral =
                    fighter.facing.sin() * input.move_x - fighter.facing.cos() * input.move_y;
                fighter.begin_light_attack(lateral);
            }
            return;
        }
        fighter.set_action(Action::Idle, 0.0); // Lost focus cancels the charge.
        return;
    }
    if fighter.action == Action::Jump
        && edges.attack
        && spend_stamina(now_ms, fighter, JUMP_ATTACK_STAMINA_COST)
    {
        fighter.begin_jump_attack();
        return;
    }

    // R2: an immediate authentic LMB light may upgrade to charged heavy
    // only during its unlanded windup. Running light may upgrade as well.
    // Once active, already-hit or recovering, the second action is rejected.
    if edges.heavy_attack
        && matches!(
            fighter.action,
            Action::AttackWindup
                | Action::AttackLeftWindup
                | Action::AttackRightWindup
                | Action::RunningAttackWindup
        )
        && fighter.action_elapsed_ms
            < (if fighter.action == Action::RunningAttackWindup {
                RUNNING_ATTACK_WINDUP_MS
            } else {
                ATTACK_WINDUP_MS
            })
    {
        // Preserve the actual server-observed light windup time. Only a
        // still-held LMB combo enters READY mode; a standalone KeyE upgrade
        // retains its existing non-held action semantics.
        let light_elapsed_ms = fighter.action_elapsed_ms;
        let held_lmb = input.attack && input.heavy_attack;
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
        if held_lmb {
            fighter.action_elapsed_ms = light_elapsed_ms;
            fighter.charging_heavy = true;
        }
        return;
    }

    let can_interrupt = matches!(fighter.action, Action::Idle | Action::Block);
    if !can_interrupt {
        return;
    }

    // Fresh same-tick defense is intentional: wheel-back owns a simultaneous
    // light-attack edge from idle. Feint handling above remains unchanged.
    if edges.block && edges.attack && fighter.action == Action::Idle {
        fighter.set_action(Action::Block, f32::INFINITY);
        return;
    }

    // Fresh same-tick arbitration is intentional: roll owns a
    // simultaneous light-attack edge. If the roll is exhausted, consume only
    // that same-tick LMB instead of leaking a free light attack behind denial.
    if edges.dodge {
        if spend_stamina(now_ms, fighter, DODGE_STAMINA_COST) {
            fighter.begin_dodge(fighter.facing.cos(), fighter.facing.sin());
            return;
        }
        if edges.attack {
            return;
        }
    }

    if edges.dash
        && fighter.action == Action::Idle
        && now_ms >= fighter.dash_ready_at_ms
        && input.move_x.hypot(input.move_y) > 0.5
        && spend_stamina(now_ms, fighter, DASH_STAMINA_COST)
    {
        let magnitude = input.move_x.hypot(input.move_y);
        fighter.dash_dir_x = input.move_x / magnitude;
        fighter.dash_dir_y = input.move_y / magnitude;
        fighter.dash_ready_at_ms = now_ms + DASH_COOLDOWN_MS;
        fighter.set_action(Action::Dash, DASH_DURATION_MS);
        return;
    }

    if edges.kick && fighter.action == Action::Idle {
        if spend_stamina(now_ms, fighter, KICK_STAMINA_COST) {
            fighter.begin_kick();
            return;
        }
        if edges.attack {
            return;
        }
    }

    if edges.jump
        && edges.attack
        && fighter.action == Action::Idle
        && spend_stamina(
            now_ms,
            fighter,
            JUMP_STAMINA_COST + JUMP_ATTACK_STAMINA_COST,
        )
    {
        fighter.begin_jump_attack();
        return;
    }

    if edges.jump
        && fighter.action == Action::Idle
        && spend_stamina(now_ms, fighter, JUMP_STAMINA_COST)
    {
        fighter.set_action(Action::Jump, JUMP_DURATION_MS);
        return;
    }
    // Space+LMB is one jump-attack intent. Denied base-jump stamina must
    // consume the simultaneous light edge rather than starting a free attack.
    if edges.jump && edges.attack && fighter.action == Action::Idle {
        return;
    }

    let moving = input.move_x.hypot(input.move_y) >= 0.5;
    if fighter.action == Action::Idle && input.attack && input.heavy_attack && edges.attack {
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
        fighter.charging_heavy = true;
        return;
    }
    if edges.attack && input.run && moving && fighter.action == Action::Idle {
        if spend_stamina(now_ms, fighter, RUNNING_ATTACK_STAMINA_COST) {
            fighter.attack_hit_targets.clear();
            fighter.set_action(Action::RunningAttackWindup, RUNNING_ATTACK_WINDUP_MS);
        }
        // A committed run+attack edge is exclusively a running-strike attempt.
        // Insufficient stamina consumes that edge instead of falling through to
        // an ordinary light attack.
        return;
    }

    if edges.heavy_attack && fighter.action == Action::Idle {
        // A delayed heavy edge while the SAME LMB remains held must never
        // start a second attack after its original light already recovered.
        // Preserve an independent standalone KeyE with attack=false.
        if input.attack && fighter.attack_input_was_down {
            return;
        }
        fighter.attack_hit_targets.clear();
        fighter.set_action(Action::HeavyAttackWindup, HEAVY_ATTACK_WINDUP_MS);
        return;
    }

    if edges.attack && fighter.action == Action::Idle {
        let lateral = fighter.facing.sin() * input.move_x - fighter.facing.cos() * input.move_y;
        fighter.begin_light_attack(lateral);
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

fn move_fighter(width: f32, height: f32, fighter: &mut Fighter, input: InputIntent, dt_ms: f32) {
    let mut velocity_x = input.move_x * MOVE_SPEED;
    let mut velocity_y = input.move_y * MOVE_SPEED;
    if input.run && fighter.action == Action::Idle && fighter.stamina > EPSILON {
        velocity_x *= RUN_MOVE_MULTIPLIER;
        velocity_y *= RUN_MOVE_MULTIPLIER;
    }

    match fighter.action {
        Action::Dash => {
            velocity_x = fighter.dash_dir_x * DASH_SPEED;
            velocity_y = fighter.dash_dir_y * DASH_SPEED;
        }
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
        Action::AttackWindup | Action::AttackLeftWindup | Action::AttackRightWindup => {
            velocity_x *= 0.35;
            velocity_y *= 0.35;
        }
        Action::RunningAttackWindup => {
            velocity_x *= RUNNING_ATTACK_WINDUP_MOVE_MULTIPLIER;
            velocity_y *= RUNNING_ATTACK_WINDUP_MOVE_MULTIPLIER;
        }
        Action::RunningAttackActive => {
            velocity_x *= RUNNING_ATTACK_ACTIVE_MOVE_MULTIPLIER;
            velocity_y *= RUNNING_ATTACK_ACTIVE_MOVE_MULTIPLIER;
        }
        Action::HeavyAttackWindup => {
            velocity_x *= 0.20;
            velocity_y *= 0.20;
        }
        Action::HeavyAttackActive => {
            velocity_x = fighter.facing.cos() * HEAVY_ATTACK_LUNGE_SPEED;
            velocity_y = fighter.facing.sin() * HEAVY_ATTACK_LUNGE_SPEED;
        }
        Action::AttackActive
        | Action::AttackLeftActive
        | Action::AttackRightActive
        | Action::Stunned
        | Action::Knockdown => {
            velocity_x = 0.0;
            velocity_y = 0.0;
        }
        Action::AttackRecovery
        | Action::AttackLeftRecovery
        | Action::AttackRightRecovery
        | Action::DodgeRecovery => {
            velocity_x *= 0.48;
            velocity_y *= 0.48;
        }
        Action::HeavyAttackRecovery => {
            velocity_x *= 0.35;
            velocity_y *= 0.35;
        }
        Action::RunningAttackRecovery => {
            velocity_x *= RUNNING_ATTACK_RECOVERY_MOVE_MULTIPLIER;
            velocity_y *= RUNNING_ATTACK_RECOVERY_MOVE_MULTIPLIER;
        }
        Action::KickRecovery | Action::JumpAttackRecovery => {
            velocity_x *= 0.42;
            velocity_y *= 0.42;
        }
        Action::FeintRecovery => {
            velocity_x *= FEINT_MOVE_MULTIPLIER;
            velocity_y *= FEINT_MOVE_MULTIPLIER;
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

fn advance_action(now_ms: f32, fighter: &mut Fighter, input: InputIntent, dt_ms: f32) {
    if matches!(fighter.action, Action::Idle | Action::Dead) {
        return;
    }
    fighter.action_elapsed_ms += dt_ms;

    if fighter.action == Action::HeavyAttackWindup && fighter.charging_heavy {
        fighter.action_elapsed_ms = fighter.action_elapsed_ms.min(HEAVY_ATTACK_WINDUP_MS);
        return; // READY heavy is held until a real release packet.
    }

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
        Action::AttackRecovery => fighter.finish_light_recovery(now_ms),
        Action::AttackLeftWindup => {
            fighter.set_action(Action::AttackLeftActive, DIRECTIONAL_ATTACK_ACTIVE_MS)
        }
        Action::AttackLeftActive => {
            fighter.set_action(Action::AttackLeftRecovery, DIRECTIONAL_ATTACK_RECOVERY_MS)
        }
        Action::AttackLeftRecovery => fighter.finish_light_recovery(now_ms),
        Action::AttackRightWindup => {
            fighter.set_action(Action::AttackRightActive, DIRECTIONAL_ATTACK_ACTIVE_MS)
        }
        Action::AttackRightActive => {
            fighter.set_action(Action::AttackRightRecovery, DIRECTIONAL_ATTACK_RECOVERY_MS)
        }
        Action::AttackRightRecovery => fighter.finish_light_recovery(now_ms),
        Action::RunningAttackWindup => {
            fighter.set_action(Action::RunningAttackActive, RUNNING_ATTACK_ACTIVE_MS)
        }
        Action::RunningAttackActive => {
            fighter.set_action(Action::RunningAttackRecovery, RUNNING_ATTACK_RECOVERY_MS)
        }
        Action::RunningAttackRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::HeavyAttackWindup => {
            fighter.set_action(Action::HeavyAttackActive, HEAVY_ATTACK_ACTIVE_MS)
        }
        Action::HeavyAttackActive => {
            fighter.set_action(Action::HeavyAttackRecovery, HEAVY_ATTACK_RECOVERY_MS)
        }
        Action::HeavyAttackRecovery => fighter.set_action(Action::Idle, 0.0),
        Action::Dash => fighter.set_action(Action::Idle, 0.0),
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
        Action::JumpAttackRecovery
        | Action::FeintRecovery
        | Action::Stunned
        | Action::Knockdown => fighter.set_action(Action::Idle, 0.0),
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
            // Consume the contact, but never refresh a bounded knockdown.
            // This also prevents the same roll from re-catching the fighter
            // on the exact frame they regain control.
            if target.action == Action::Knockdown {
                continue;
            }
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
    arc_offset_radians: f32,
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
            arc_offset_radians: 0.0,
            damage: ATTACK_DAMAGE,
            knockback: ATTACK_KNOCKBACK,
            guard_damage: BLOCK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::AttackLeftActive => Some(AttackProfile {
            reach: DIRECTIONAL_ATTACK_REACH,
            arc_radians: DIRECTIONAL_ATTACK_ARC_RADIANS,
            arc_offset_radians: -DIRECTIONAL_ATTACK_ARC_OFFSET_RADIANS,
            damage: ATTACK_DAMAGE,
            knockback: ATTACK_KNOCKBACK,
            guard_damage: BLOCK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::AttackRightActive => Some(AttackProfile {
            reach: DIRECTIONAL_ATTACK_REACH,
            arc_radians: DIRECTIONAL_ATTACK_ARC_RADIANS,
            arc_offset_radians: DIRECTIONAL_ATTACK_ARC_OFFSET_RADIANS,
            damage: ATTACK_DAMAGE,
            knockback: ATTACK_KNOCKBACK,
            guard_damage: BLOCK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::RunningAttackActive => Some(AttackProfile {
            reach: RUNNING_ATTACK_REACH,
            arc_radians: RUNNING_ATTACK_ARC_RADIANS,
            arc_offset_radians: 0.0,
            damage: RUNNING_ATTACK_DAMAGE,
            knockback: RUNNING_ATTACK_KNOCKBACK,
            guard_damage: RUNNING_ATTACK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::HeavyAttackActive => Some(AttackProfile {
            reach: HEAVY_ATTACK_REACH,
            arc_radians: HEAVY_ATTACK_ARC_RADIANS,
            arc_offset_radians: 0.0,
            damage: HEAVY_ATTACK_DAMAGE,
            knockback: HEAVY_ATTACK_KNOCKBACK,
            guard_damage: HEAVY_ATTACK_GUARD_DAMAGE,
            guard_break_stun_ms: HEAVY_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::JumpAttackActive => Some(AttackProfile {
            reach: JUMP_ATTACK_REACH,
            arc_radians: JUMP_ATTACK_ARC_RADIANS,
            arc_offset_radians: 0.0,
            damage: JUMP_ATTACK_DAMAGE,
            knockback: JUMP_ATTACK_KNOCKBACK,
            guard_damage: JUMP_ATTACK_GUARD_DAMAGE,
            guard_break_stun_ms: BLOCK_GUARD_BREAK_STUN_MS,
            kick: false,
        }),
        Action::KickActive => Some(AttackProfile {
            reach: KICK_REACH,
            arc_radians: KICK_ARC_RADIANS,
            arc_offset_radians: 0.0,
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

            if profile.kick && fighters[target_index].action == Action::Knockdown {
                // Consume this target for the active kick without extending
                // its existing bounded knockdown.
                fighters[attacker_index]
                    .attack_hit_targets
                    .insert(target_id);
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
                    target.guard_regen_blocked_until_ms = target
                        .guard_regen_blocked_until_ms
                        .max(now_ms + profile.guard_break_stun_ms);
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
                target.clear_light_attack_buffer();
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
    let attack_facing = attacker.facing + profile.arc_offset_radians;
    angle_delta(angle_to_target, attack_facing).abs() <= profile.arc_radians / 2.0
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
    fighter.attack_input_was_down = false;
    fighter.heavy_attack_input_was_down = false;
    fighter.block_input_was_down = false;
    fighter.dodge_input_was_down = false;
    fighter.kick_input_was_down = false;
    fighter.jump_input_was_down = false;
    fighter.dash_input_was_down = false;
    fighter.clear_pending_actions();
    fighter.clear_recovery_input_buffer();
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

// Ephemeral nonreusable World and fighter-life identifiers; process scoped.
static NEXT_GESTURE_WORLD_INSTANCE: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(1);
fn reserve_world_instance() -> u64 {
    NEXT_GESTURE_WORLD_INSTANCE
        .fetch_update(
            std::sync::atomic::Ordering::Relaxed,
            std::sync::atomic::Ordering::Relaxed,
            |n| n.checked_add(1),
        )
        .expect("World owner instance epoch exhausted")
}
fn reserve_actor_life(next: &mut u64) -> u64 {
    let n = *next;
    *next = n.checked_add(1).expect("World actor life epoch exhausted");
    n
}

#[cfg(test)]
mod r2_combat_control_tests {
    use super::*;

    #[test]
    fn dash_is_directional_and_server_cooldown_is_three_seconds() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 300.0, 300.0, 0.0));
        assert!(world.set_input(
            1,
            InputIntent {
                move_y: -1.0,
                dash: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        world.step();
        let start = world.fighter(1).unwrap();
        assert_eq!(start.action, Action::Dash);
        assert!(start.y < 300.0);
        assert!(start.dash_dir_y < -0.99);
        let ready = start.dash_ready_at_ms;
        assert!(ready >= 3000.0);

        assert!(world.set_input(1, InputIntent::default()));
        for _ in 0..20 {
            world.step();
        }
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        assert!(world.set_input(
            1,
            InputIntent {
                move_x: 1.0,
                dash: true,
                ..InputIntent::default()
            }
        ));
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(world.fighter(1).unwrap().dash_ready_at_ms, ready);
        assert!(world.set_input(1, InputIntent::default()));
        while world.now_ms < ready {
            world.step();
        }
        assert!(world.set_input(
            1,
            InputIntent {
                move_x: 1.0,
                dash: true,
                ..InputIntent::default()
            }
        ));
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::Dash);
        assert!(world.fighter(1).unwrap().dash_dir_x > 0.99);
    }

    #[test]
    fn held_lmb_converts_only_an_unlanded_light_windup() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
        world.set_input(
            1,
            InputIntent {
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        assert!(world.fighter(1).unwrap().attack_hit_targets.is_empty());
    }

    #[test]
    fn running_light_windup_can_upgrade_to_heavy_before_contact() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 250.0, 300.0, 0.0);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                run: true,
                move_x: 1.0,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(
            world.fighter(1).unwrap().action,
            Action::RunningAttackWindup
        );
        world.set_input(
            1,
            InputIntent {
                heavy_attack: true,
                run: true,
                move_x: 1.0,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    }

    #[test]
    fn same_tick_charge_release_keeps_newest_light_heavy_or_cancel_mode() {
        for (release, expected) in [
            (
                InputIntent {
                    attack: true,
                    ..InputIntent::default()
                },
                Action::AttackWindup,
            ),
            (
                InputIntent {
                    heavy_attack: true,
                    ..InputIntent::default()
                },
                Action::HeavyAttackWindup,
            ),
            (InputIntent::default(), Action::Idle),
        ] {
            let mut world = World::new(800.0, 600.0);
            assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
            assert!(world.set_input(
                1,
                InputIntent {
                    attack: true,
                    heavy_attack: true,
                    ..InputIntent::default()
                }
            ));
            // Both WebTransport datagrams arrived before one 60Hz world.step.
            assert!(world.set_input(1, release));
            world.step();
            assert_eq!(
                world.fighter(1).unwrap().action,
                expected,
                "latest release intent must beat pending held bits"
            );
        }
    }

    #[test]
    fn release_edge_survives_following_neutral_sample_before_server_tick() {
        // WebTransport carries redundant samples and multiple distinct 60 Hz
        // client inputs may be consumed before one authoritative world tick.
        // Hold -> release -> neutral must resolve exactly once, not cancel.
        for (release, expected) in [
            (
                InputIntent {
                    attack: true,
                    ..InputIntent::default()
                },
                Action::AttackWindup,
            ),
            (
                InputIntent {
                    heavy_attack: true,
                    ..InputIntent::default()
                },
                Action::HeavyAttackWindup,
            ),
        ] {
            let mut world = World::new(800.0, 600.0);
            world.add_player_at(1, 250.0, 300.0, 0.0);
            world.set_input(
                1,
                InputIntent {
                    attack: true,
                    heavy_attack: true,
                    ..InputIntent::default()
                },
            );
            world.set_input(1, release);
            world.set_input(1, InputIntent::default());
            world.step();
            assert_eq!(world.fighter(1).unwrap().action, expected);
            world.step();
            assert_eq!(
                world.fighter(1).unwrap().action,
                expected,
                "the release must not repeat or turn into a cancelled charge"
            );
        }
    }

    #[test]
    fn genuine_directional_short_release_keeps_lateral_through_same_tick_neutral() {
        // M121 original native Chrome/Firefox: the authenticated 30Hz sender
        // released LMB as attack-only + held KeyW, then delivered a neutral
        // frame in the SAME 60Hz World tick. The strike still dealt 34 HP,
        // but World selected generic 1/2/3 instead of LEFT 24/25/26.
        // This characterizes the missing *directional origin*, without
        // changing the original 135ms light, guard, damage, or protocol.
        for (move_y, expected) in [
            (-1.0, Action::AttackLeftWindup),
            (1.0, Action::AttackRightWindup),
        ] {
            let mut direct = World::new(800.0, 600.0);
            assert!(direct.add_player_at(1, 250.0, 300.0, 0.0));
            assert!(direct.set_input(
                1,
                InputIntent {
                    attack: true,
                    heavy_attack: true,
                    move_y,
                    ..InputIntent::default()
                }
            ));
            direct.step();
            assert_eq!(direct.fighter(1).unwrap().action, Action::HeavyAttackWindup);
            assert!(direct.set_input(
                1,
                InputIntent {
                    attack: true,
                    move_y,
                    ..InputIntent::default()
                }
            ));
            direct.step();
            assert_eq!(
                direct.fighter(1).unwrap().action,
                expected,
                "control: directional release before a neutral frame"
            );

            let mut coalesced = World::new(800.0, 600.0);
            assert!(coalesced.add_player_at(1, 250.0, 300.0, 0.0));
            assert!(coalesced.set_input(
                1,
                InputIntent {
                    attack: true,
                    heavy_attack: true,
                    move_y,
                    ..InputIntent::default()
                }
            ));
            coalesced.step();
            assert_eq!(
                coalesced.fighter(1).unwrap().action,
                Action::HeavyAttackWindup
            );
            assert!(coalesced.set_input(
                1,
                InputIntent {
                    attack: true,
                    move_y,
                    ..InputIntent::default()
                }
            ));
            // The later neutral sample is genuine, but it must not overwrite
            // the direction of the already-admitted attack-only release.
            assert!(coalesced.set_input(1, InputIntent::default()));
            coalesced.step();
            assert_eq!(
                coalesced.fighter(1).unwrap().action,
                expected,
                "the admitted directional release must retain its origin"
            );
            coalesced.step();
            assert_eq!(
                coalesced.fighter(1).unwrap().action,
                expected,
                "the neutral frame cannot trigger a second hit or variant"
            );
        }
    }

    #[test]
    fn server_ready_release_then_neutral_activates_once_but_cancel_stays_idle() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 250.0, 300.0, 0.0);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        for _ in 0..50 {
            world.step();
        }
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        world.set_input(
            1,
            InputIntent {
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.set_input(1, InputIntent::default());
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackActive);
        assert!(!world.fighter(1).unwrap().charging_heavy);

        let mut cancelled = World::new(800.0, 600.0);
        cancelled.add_player_at(2, 250.0, 300.0, 0.0);
        cancelled.set_input(
            2,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        cancelled.set_input(2, InputIntent::default());
        cancelled.step();
        assert_eq!(
            cancelled.fighter(2).unwrap().action,
            Action::Idle,
            "direct hold -> neutral is cancellation, not an attack"
        );
    }

    #[test]
    fn releasing_after_one_server_charge_tick_commits_exactly_one_light() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 250.0, 300.0, 0.0);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
        world.set_input(1, InputIntent::default());
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    }

    #[test]
    fn manual_heavy_charge_stays_ready_until_release_and_never_auto_hits() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        for _ in 0..50 {
            world.step();
            assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        }
        assert!(
            (world.fighter(1).unwrap().action_elapsed_ms - HEAVY_ATTACK_WINDUP_MS).abs() < 0.001,
            "server clamps full charge at READY while LMB remains down"
        );
        world.set_input(
            1,
            InputIntent {
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackActive);
        assert!(!world.fighter(1).unwrap().charging_heavy);
    }

    #[test]
    fn undercharged_lmb_release_becomes_light_and_running_charge_release_runs() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        for _ in 0..5 {
            world.step();
        }
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

        let mut running = World::new(800.0, 600.0);
        running.add_player_at(2, 250.0, 300.0, 0.0);
        running.set_input(
            2,
            InputIntent {
                attack: true,
                heavy_attack: true,
                run: true,
                move_x: 1.0,
                ..InputIntent::default()
            },
        );
        for _ in 0..5 {
            running.step();
        }
        running.set_input(
            2,
            InputIntent {
                attack: true,
                run: true,
                move_x: 1.0,
                ..InputIntent::default()
            },
        );
        running.step();
        assert_eq!(
            running.fighter(2).unwrap().action,
            Action::RunningAttackWindup
        );
    }

    #[test]
    fn fabricated_early_heavy_release_is_only_light_or_running_light() {
        for (running, expected) in [
            (false, Action::AttackWindup),
            (true, Action::RunningAttackWindup),
        ] {
            let mut world = World::new(800.0, 600.0);
            world.add_player_at(1, 250.0, 300.0, 0.0);
            let move_x = if running { 1.0 } else { 0.0 };
            world.set_input(
                1,
                InputIntent {
                    attack: true,
                    heavy_attack: true,
                    run: running,
                    move_x,
                    ..InputIntent::default()
                },
            );
            for _ in 0..5 {
                world.step();
            }
            assert!(world.fighter(1).unwrap().charging_heavy);
            assert!(world.fighter(1).unwrap().action_elapsed_ms < HEAVY_ATTACK_WINDUP_MS);

            // Malicious or reordered release claims a heavy even though this
            // authoritative hold was only five 60Hz ticks long.
            world.set_input(
                1,
                InputIntent {
                    heavy_attack: true,
                    run: running,
                    move_x,
                    ..InputIntent::default()
                },
            );
            world.step();
            assert_eq!(
                world.fighter(1).unwrap().action,
                expected,
                "a forged READY flag cannot grant a delayed heavy strike"
            );
            assert!(!world.fighter(1).unwrap().charging_heavy);
            world.set_input(1, InputIntent::default());
            world.step();
            assert_eq!(world.fighter(1).unwrap().action, expected);
        }
    }

    #[test]
    fn cancelled_charge_never_strikes_and_existing_e_heavy_remains_authoritative() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        world.set_input(1, InputIntent::default());
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        world.set_input(
            1,
            InputIntent {
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        assert!(!world.fighter(1).unwrap().charging_heavy);
    }

    #[test]
    fn heavy_reach_matches_client_painted_arc_and_roll_doubles_ground_time() {
        assert_eq!(HEAVY_ATTACK_REACH, 82.0);
        assert_eq!(HEAVY_ATTACK_LUNGE_SPEED, 240.0);
        assert_eq!(ROLL_COLLISION_KNOCKDOWN_MS, 520.0);
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 293.0, 200.0, std::f32::consts::PI);
        world.fighters[0].set_action(Action::HeavyAttackActive, 1000.0);
        let events = world.step();
        assert!(events.iter().any(|event| matches!(
            event,
            CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 46,
                hp: 54
            }
        )));
    }

    #[test]
    fn heavy_leap_physically_advances_without_restoring_the_old_130px_hit_range() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 330.0, 200.0, std::f32::consts::PI);
        world.fighters[0].set_action(Action::HeavyAttackActive, 1000.0);
        let original_x = world.fighter(1).unwrap().x;
        let events = world.step();
        let next_x = world.fighter(1).unwrap().x;
        assert!(next_x > original_x + 3.0 && next_x < original_x + 5.0);
        assert_eq!(world.fighter(2).unwrap().hp, 100.0);
        assert!(!events
            .iter()
            .any(|event| matches!(event, CombatEvent::Hit { .. })));
    }

    #[test]
    fn block_hold_movement_is_exactly_half_speed() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.set_input(
            1,
            InputIntent {
                block: true,
                move_x: 1.0,
                ..InputIntent::default()
            },
        );
        world.step_by(100.0);
        let own = world.fighter(1).unwrap();
        assert_eq!(own.action, Action::Block);
        assert!((own.x - 210.75).abs() < 0.001);
    }
}
