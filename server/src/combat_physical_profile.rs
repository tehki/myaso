//! DORMANT Combat P0 balance proposal: physical fists versus actual equipped gear.
//!
//! This module does not run in the authoritative simulation. The existing arena
//! 34 HP light attack is NOT a fist or sword profile. No gameplay reach, HP,
//! stamina, animation, parry, native input, packet, or inventory mutation here.
//!
//! The only public entry point resolves a Core-issued active lease against
//! server-owned World + Loot. Core must hold a coherent World/Identity/Loot
//! single-writer tick fence before calling it. A session check alone does NOT
//! provide a transaction, ACK, or reconnect/ownership guarantee.
//!
//! These numerical values are review CANDIDATES, NOT approved live balance.
//! All five physical attack families must be wired together (plus visuals,
//! stamina, guard/parry, PvP and drop/death integration) before any activation.

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::combat_loadout::{
    resolve_verified_session_loadout, CombatLoadout, CombatLoadoutError, MainHandCombatItem,
};
use crate::loot::LootAuthority;
use crate::simulation::{Action, World};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhysicalCombatMode {
    Unarmed,
    SwordEquipped,
    ClubEquipped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhysicalAttackFamily {
    Light,
    DirectionalLight,
    RunningLight,
    Heavy,
    Jump,
}

impl PhysicalAttackFamily {
    fn from_active_action(action: Action) -> Option<Self> {
        match action {
            Action::AttackActive => Some(Self::Light),
            Action::AttackLeftActive | Action::AttackRightActive => Some(Self::DirectionalLight),
            Action::RunningAttackActive => Some(Self::RunningLight),
            Action::HeavyAttackActive => Some(Self::Heavy),
            Action::JumpAttackActive => Some(Self::Jump),
            // Kick, block/parry, dodge/roll, knockdown and transition states
            // have separate unchanged authoritative mechanics.
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CandidateStrikeStats {
    pub reach: f32,
    pub damage: f32,
    pub guard_damage: f32,
    pub stamina_cost: f32,
    pub recovery_ms: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProposedPhysicalStrike {
    pub mode: PhysicalCombatMode,
    /// Stable ID of the server-committed equipped item. None means bare fists.
    pub source_item_id: Option<u64>,
    pub family: PhysicalAttackFamily,
    pub stats: CandidateStrikeStats,
}

#[derive(Debug, Clone, Copy)]
struct CandidateWeaponTable {
    light: CandidateStrikeStats,
    running: CandidateStrikeStats,
    heavy: CandidateStrikeStats,
    jump: CandidateStrikeStats,
}

const UNARMED: CandidateWeaponTable = CandidateWeaponTable {
    light: stats(42.0, 12.0, 15.0, 7.0, 220.0),
    running: stats(54.0, 16.0, 18.0, 11.0, 280.0),
    heavy: stats(46.0, 20.0, 26.0, 17.0, 360.0),
    jump: stats(36.0, 18.0, 20.0, 14.0, 290.0),
};
const RUSTY_SWORD: CandidateWeaponTable = CandidateWeaponTable {
    light: stats(76.0, 26.0, 34.0, 9.0, 255.0),
    running: stats(88.0, 28.0, 32.0, 11.0, 310.0),
    heavy: stats(82.0, 40.0, 57.0, 18.0, 420.0),
    jump: stats(56.0, 32.0, 45.0, 13.0, 290.0),
};
const IRON_SWORD: CandidateWeaponTable = CandidateWeaponTable {
    light: stats(82.0, 34.0, 38.0, 10.0, 260.0),
    running: stats(94.0, 34.0, 38.0, 12.0, 315.0),
    heavy: stats(88.0, 46.0, 64.0, 20.0, 440.0),
    jump: stats(60.0, 40.0, 50.0, 14.0, 305.0),
};
const WOODEN_CLUB: CandidateWeaponTable = CandidateWeaponTable {
    light: stats(62.0, 22.0, 38.0, 10.0, 270.0),
    running: stats(74.0, 25.0, 40.0, 13.0, 320.0),
    heavy: stats(68.0, 36.0, 60.0, 21.0, 465.0),
    jump: stats(48.0, 30.0, 48.0, 15.0, 315.0),
};

const fn stats(
    reach: f32,
    damage: f32,
    guard_damage: f32,
    stamina_cost: f32,
    recovery_ms: f32,
) -> CandidateStrikeStats {
    CandidateStrikeStats {
        reach,
        damage,
        guard_damage,
        stamina_cost,
        recovery_ms,
    }
}

fn propose_for_loadout(loadout: CombatLoadout, action: Action) -> Option<ProposedPhysicalStrike> {
    let family = PhysicalAttackFamily::from_active_action(action)?;
    let (mode, source_item_id, table) = match loadout.main_hand {
        MainHandCombatItem::Unarmed => (PhysicalCombatMode::Unarmed, None, UNARMED),
        MainHandCombatItem::RustySword(id) => {
            (PhysicalCombatMode::SwordEquipped, Some(id), RUSTY_SWORD)
        }
        MainHandCombatItem::IronSword(id) => {
            (PhysicalCombatMode::SwordEquipped, Some(id), IRON_SWORD)
        }
        MainHandCombatItem::WoodenClub(id) => {
            (PhysicalCombatMode::ClubEquipped, Some(id), WOODEN_CLUB)
        }
    };
    let strike = match family {
        PhysicalAttackFamily::Light | PhysicalAttackFamily::DirectionalLight => table.light,
        PhysicalAttackFamily::RunningLight => table.running,
        PhysicalAttackFamily::Heavy => table.heavy,
        PhysicalAttackFamily::Jump => table.jump,
    };
    Some(ProposedPhysicalStrike {
        mode,
        source_item_id,
        family,
        stats: strike,
    })
}

/// **NOT LIVE:** resolve from the actual server-side World fighter Action AND
/// canonical physical MainHand, both under a future single-writer Core
/// World/Loot/Identity tick fence. No caller may pick HeavyAttackActive or
/// SwordEquipped through a separate argument. The current Loot domain remains
/// a *draft writer*; this function alone does not prove canonical ownership.
pub fn proposed_strike_for_actual_server_action(
    identity: &SessionIdentityRegistry,
    lease: SessionLease,
    world: &World,
    loot: &LootAuthority,
) -> Result<Option<ProposedPhysicalStrike>, CombatLoadoutError> {
    // Validate live exact session and living fighter BEFORE resolving action.
    let loadout = resolve_verified_session_loadout(identity, lease, world, loot)?;
    let server_action = world
        .fighter(lease.server_session())
        .ok_or(CombatLoadoutError::MissingWorldFighter)?
        .action;
    Ok(propose_for_loadout(loadout, server_action))
}

/// Test-only explicit Action selector for exercising all candidate families
/// on synthetic idle Worlds. Never a production API; production can derive
/// the family only from the actual live World fighter action above.
#[cfg(test)]
fn proposed_strike_for_verified_session(
    identity: &SessionIdentityRegistry,
    lease: SessionLease,
    world: &World,
    loot: &LootAuthority,
    action: Action,
) -> Result<Option<ProposedPhysicalStrike>, CombatLoadoutError> {
    let loadout = resolve_verified_session_loadout(identity, lease, world, loot)?;
    Ok(propose_for_loadout(loadout, action))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::simulation::InputIntent;
    use crate::zone::ZoneId;

    fn setup_actor() -> (SessionIdentityRegistry, SessionLease, World, LootAuthority) {
        let lease = SessionLease::new(1, 1).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease, CharacterId::new(101).unwrap())
            .unwrap();
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        (identity, lease, world, loot)
    }

    fn strike(
        identity: &SessionIdentityRegistry,
        lease: SessionLease,
        world: &World,
        loot: &LootAuthority,
        action: Action,
    ) -> ProposedPhysicalStrike {
        proposed_strike_for_verified_session(identity, lease, world, loot, action)
            .unwrap()
            .expect("physical strike action")
    }

    #[test]
    fn production_strike_family_follows_actual_server_fighter_action_not_caller_choice() {
        let (identity, lease, mut world, mut loot) = setup_actor();
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, lease, &world, &loot),
            Ok(None)
        );

        // A backpack sword never upgrades the attack of an idle fighter.
        let sword_id = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, lease, &world, &loot),
            Ok(None)
        );
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            }
        ));
        // This is real deterministic Rust World combat, not an arbitrary
        // Action::AttackActive supplied by a caller.
        let mut entered_active = false;
        for _ in 0..60 {
            world.step();
            if world.fighter(1).unwrap().action == Action::AttackActive {
                entered_active = true;
                break;
            }
        }
        assert!(
            entered_active,
            "Rust server never entered a genuine light-active state"
        );
        let fist = proposed_strike_for_actual_server_action(&identity, lease, &world, &loot)
            .unwrap()
            .expect("server light active authorizes candidate fists");
        assert_eq!(fist.mode, PhysicalCombatMode::Unarmed);
        assert_eq!(fist.family, PhysicalAttackFamily::Light);
        assert_eq!(fist.source_item_id, None);

        // Preview-only demonstration: world action stays active while actual
        // Loot-equipment ownership changes. The eventual production adapter
        // must hold World/Loot in ONE atomic writer tick to admit this read.
        loot.equip(1, sword_id, EquipmentSlot::MainHand).unwrap();
        let armed = proposed_strike_for_actual_server_action(&identity, lease, &world, &loot)
            .unwrap()
            .expect("actual server light and committed item");
        assert_eq!(armed.mode, PhysicalCombatMode::SwordEquipped);
        assert_eq!(armed.source_item_id, Some(sword_id));
        assert_eq!(armed.family, PhysicalAttackFamily::Light);
        assert_ne!(armed.stats.damage, fist.stats.damage);

        // The fighter's real later non-active state must NEVER reuse a prior
        // active weapon bonus, even if the item remains equipped.
        for _ in 0..60 {
            world.step();
            if world.fighter(1).unwrap().action != Action::AttackActive {
                break;
            }
        }
        assert_ne!(world.fighter(1).unwrap().action, Action::AttackActive);
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, lease, &world, &loot),
            Ok(None)
        );
    }

    #[test]
    fn production_strike_resolver_fail_closes_stale_lease_and_missing_fighter() {
        let (mut identity, lease, mut world, loot) = setup_actor();
        let stale = SessionLease::new(1, 2).unwrap();
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, stale, &world, &loot),
            Err(CombatLoadoutError::UnverifiedSession)
        );
        identity.release_session(lease);
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, lease, &world, &loot),
            Err(CombatLoadoutError::UnverifiedSession)
        );
        // Release fences generation 1. Rebinding that revoked lease is
        // correctly stale; only the NEW server-issued generation may bind.
        identity
            .bind_verified(stale, CharacterId::new(101).unwrap())
            .unwrap();
        assert!(world.remove_player(1));
        assert_eq!(
            proposed_strike_for_actual_server_action(&identity, stale, &world, &loot),
            Err(CombatLoadoutError::MissingWorldFighter)
        );
    }

    #[test]
    fn fresh_real_actor_punch_is_shorter_and_weaker_than_committed_sword() {
        let (identity, lease, world, mut loot) = setup_actor();
        let fist = strike(&identity, lease, &world, &loot, Action::AttackActive);
        assert_eq!(fist.mode, PhysicalCombatMode::Unarmed);
        assert_eq!(fist.source_item_id, None);
        assert_eq!(fist.stats.damage, 12.0);
        assert_eq!(fist.stats.reach, 42.0);

        // Merely holding a real sword in the backpack NEVER changes fists.
        let iron = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        assert_eq!(
            strike(&identity, lease, &world, &loot, Action::AttackActive),
            fist
        );

        // Only the already committed physical MainHand ownership changes the
        // proposal. Combat does not grant or equip an item itself.
        loot.equip(1, iron, EquipmentSlot::MainHand).unwrap();
        let sword = strike(&identity, lease, &world, &loot, Action::AttackActive);
        assert_eq!(sword.mode, PhysicalCombatMode::SwordEquipped);
        assert_eq!(sword.source_item_id, Some(iron));
        assert!(sword.stats.reach > fist.stats.reach);
        assert!(sword.stats.damage > fist.stats.damage);
        assert!(sword.stats.guard_damage > fist.stats.guard_damage);
        loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        assert_eq!(
            strike(&identity, lease, &world, &loot, Action::AttackActive),
            fist
        );
    }

    #[test]
    fn all_physical_attack_families_keep_modes_distinct_without_rebranding_kick() {
        let (identity, lease, world, mut loot) = setup_actor();
        let iron = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        for (action, expected) in [
            (Action::AttackActive, PhysicalAttackFamily::Light),
            (
                Action::AttackLeftActive,
                PhysicalAttackFamily::DirectionalLight,
            ),
            (
                Action::AttackRightActive,
                PhysicalAttackFamily::DirectionalLight,
            ),
            (
                Action::RunningAttackActive,
                PhysicalAttackFamily::RunningLight,
            ),
            (Action::HeavyAttackActive, PhysicalAttackFamily::Heavy),
            (Action::JumpAttackActive, PhysicalAttackFamily::Jump),
        ] {
            let bare = strike(&identity, lease, &world, &loot, action);
            assert_eq!(bare.family, expected);
            assert_eq!(bare.mode, PhysicalCombatMode::Unarmed);
            loot.equip(1, iron, EquipmentSlot::MainHand).unwrap();
            let armed = strike(&identity, lease, &world, &loot, action);
            assert_eq!(armed.mode, PhysicalCombatMode::SwordEquipped);
            assert_eq!(armed.source_item_id, Some(iron));
            assert!(armed.stats.damage > bare.stats.damage);
            assert!(armed.stats.reach > bare.stats.reach);
            loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        }
        for action in [
            Action::Idle,
            Action::AttackWindup,
            Action::KickActive,
            Action::Block,
            Action::Dodge,
            Action::Dead,
        ] {
            assert_eq!(
                proposed_strike_for_verified_session(&identity, lease, &world, &loot, action),
                Ok(None)
            );
        }
    }

    #[test]
    fn club_and_rusty_sword_are_real_distinct_ownership_not_implicit_weapon() {
        let (identity, lease, world, mut loot) = setup_actor();
        let club_id = loot.grant(1, ItemKind::WoodenClub, 1).unwrap();
        let rusty_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, club_id, EquipmentSlot::MainHand).unwrap();
        let club = strike(&identity, lease, &world, &loot, Action::HeavyAttackActive);
        assert_eq!(club.mode, PhysicalCombatMode::ClubEquipped);
        assert_eq!(club.source_item_id, Some(club_id));
        loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        loot.equip(1, rusty_id, EquipmentSlot::MainHand).unwrap();
        let rusty = strike(&identity, lease, &world, &loot, Action::HeavyAttackActive);
        assert_eq!(rusty.mode, PhysicalCombatMode::SwordEquipped);
        assert_eq!(rusty.source_item_id, Some(rusty_id));
        assert!(rusty.stats.reach > club.stats.reach);
        assert!(rusty.stats.damage > club.stats.damage);
    }

    #[test]
    fn forged_or_stale_lease_missing_world_or_dead_actor_never_resolves_weapon_stats() {
        let (mut identity, lease, mut world, mut loot) = setup_actor();
        let iron = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        loot.equip(1, iron, EquipmentSlot::MainHand).unwrap();
        let stale = SessionLease::new(1, 2).unwrap();
        assert_eq!(
            proposed_strike_for_verified_session(
                &identity,
                stale,
                &world,
                &loot,
                Action::AttackActive
            ),
            Err(CombatLoadoutError::UnverifiedSession)
        );
        assert!(world.remove_player(1));
        assert_eq!(
            proposed_strike_for_verified_session(
                &identity,
                lease,
                &world,
                &loot,
                Action::AttackActive
            ),
            Err(CombatLoadoutError::MissingWorldFighter)
        );
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));

        let mut dead_fighter = world.fighter(1).unwrap().clone();
        dead_fighter.action = Action::Dead;
        loot.death(1, &dead_fighter, ZoneId::Moonvale, 10).unwrap();
        assert_eq!(
            proposed_strike_for_verified_session(
                &identity,
                lease,
                &world,
                &loot,
                Action::AttackActive
            ),
            Err(CombatLoadoutError::DeadFighter)
        );
        identity.release_session(lease);
        assert_eq!(
            proposed_strike_for_verified_session(
                &identity,
                lease,
                &world,
                &loot,
                Action::AttackActive
            ),
            Err(CombatLoadoutError::UnverifiedSession)
        );
    }

    #[test]
    fn server_owned_death_and_loot_transfer_keep_one_item_id_only_on_new_wielder() {
        let (mut identity, lease, mut world, mut loot) = setup_actor();
        let sword_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, sword_id, EquipmentSlot::MainHand).unwrap();

        let second = SessionLease::new(2, 1).unwrap();
        identity
            .bind_verified(second, CharacterId::new(202).unwrap())
            .unwrap();
        assert!(world.add_player_at(2, 205.0, 200.0, 0.0));
        loot.register(2).unwrap();
        let mut dead = world.fighter(1).unwrap().clone();
        dead.action = Action::Dead;
        let corpse_id = loot.death(1, &dead, ZoneId::Moonvale, 100).unwrap();

        assert_eq!(
            proposed_strike_for_verified_session(
                &identity,
                lease,
                &world,
                &loot,
                Action::AttackActive
            ),
            Err(CombatLoadoutError::DeadFighter)
        );
        loot.take_corpse(
            2,
            world.fighter(2).unwrap(),
            ZoneId::Moonvale,
            corpse_id,
            sword_id,
            101,
        )
        .unwrap();
        let fists = strike(&identity, second, &world, &loot, Action::AttackActive);
        assert_eq!(fists.mode, PhysicalCombatMode::Unarmed);
        assert_eq!(fists.source_item_id, None);

        loot.equip(2, sword_id, EquipmentSlot::MainHand).unwrap();
        let armed = strike(&identity, second, &world, &loot, Action::AttackActive);
        assert_eq!(armed.mode, PhysicalCombatMode::SwordEquipped);
        assert_eq!(armed.source_item_id, Some(sword_id));
        loot.export_state().unwrap();
    }

    #[test]
    fn candidate_numbers_are_finite_bounded_and_never_substitute_legacy_fixed_arena() {
        for table in [UNARMED, RUSTY_SWORD, IRON_SWORD, WOODEN_CLUB] {
            for profile in [table.light, table.running, table.heavy, table.jump] {
                assert!(profile.reach.is_finite() && profile.reach > 0.0);
                assert!(profile.damage.is_finite() && profile.damage > 0.0);
                assert!(profile.guard_damage.is_finite() && profile.guard_damage > 0.0);
                assert!(
                    profile.stamina_cost.is_finite()
                        && profile.stamina_cost > 0.0
                        && profile.stamina_cost < 100.0
                );
                assert!(profile.recovery_ms.is_finite() && profile.recovery_ms > 0.0);
            }
            assert!(table.heavy.damage > table.light.damage);
        }
        // Existing fixed 34 HP attack is not silently interpreted as fists.
        assert_ne!(UNARMED.light.damage, 34.0);
        let bare = std::hint::black_box(UNARMED.light);
        let sword = std::hint::black_box(RUSTY_SWORD.light);
        assert!(bare.reach < sword.reach);
    }
}
