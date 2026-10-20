//! Earned magic progression for Magic Alpha. NOT a live casting system.
//! Runes, spells and mana are keyed by durable CharacterId, not loot items.
//! Lesson grants require independent server-side reward eligibility checks.
//! No networking, NPC proximity, magic persistence or combat integration yet.
use std::collections::{BTreeMap, BTreeSet};
use std::num::NonZeroU64;

use crate::character_identity::{CharacterId, SessionIdentityRegistry, SessionLease};
use crate::loot::{EquipmentSlot, ItemKind, LootAuthority};

pub const AWAKENED_MANA: u16 = 100;
pub const MAX_MAGIC_CHARACTERS: usize = 4096;
pub const MAX_LESSON_RECEIPTS: usize = 65_536;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rune {
    Fire,
    Water,
    Air,
    Earth,
    Life,
    Arcane,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Spell {
    Ember,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LessonSource {
    NpcTeacher,
    QuestReward,
    RareDiscovery,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lesson {
    Rune(Rune),
    Spell(Spell),
}

/// Reward ID must be minted by a trusted server service, never by a player.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LessonAward {
    pub receipt: NonZeroU64,
    pub character: CharacterId,
    pub source: LessonSource,
    pub lesson: Lesson,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MagicError {
    UnverifiedSession,
    UnknownCharacter,
    DuplicateReward,
    AlreadyKnown,
    PrerequisiteMissing,
    LimitReached,
    MissingSpellbook,
    MissingReagent,
    MissingInventory,
    InsufficientMana,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpellPlan {
    pub spell: Spell,
    pub mana_cost: u16,
    pub reagent: ItemKind,
    pub reagent_amount: u16,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct CharacterMagic {
    runes: BTreeSet<Rune>,
    spells: BTreeSet<Spell>,
    mana: u16,
}

/// In-memory domain only. Persisting the ledger atomically with inventory
/// and replay protection is mandatory before any live magic is enabled.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct MagicAuthority {
    characters: BTreeMap<CharacterId, CharacterMagic>,
    claimed_receipts: BTreeSet<NonZeroU64>,
}

impl MagicAuthority {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn knows_rune(&self, character: CharacterId, rune: Rune) -> bool {
        self.characters
            .get(&character)
            .is_some_and(|value| value.runes.contains(&rune))
    }

    pub fn knows_spell(&self, character: CharacterId, spell: Spell) -> bool {
        self.characters
            .get(&character)
            .is_some_and(|value| value.spells.contains(&spell))
    }

    pub fn mana(&self, character: CharacterId) -> u16 {
        self.characters
            .get(&character)
            .map_or(0, |value| value.mana)
    }

    /// Server-only NPC, quest or rare-reward confirmation. This does NOT
    /// verify proximity, quest completion or actual scroll ownership.
    pub fn grant_lesson(&mut self, award: LessonAward) -> Result<(), MagicError> {
        if self.claimed_receipts.contains(&award.receipt) {
            return Err(MagicError::DuplicateReward);
        }
        if self.claimed_receipts.len() >= MAX_LESSON_RECEIPTS {
            return Err(MagicError::LimitReached);
        }
        let known = self.characters.get(&award.character);
        if known.is_none() && self.characters.len() >= MAX_MAGIC_CHARACTERS {
            return Err(MagicError::LimitReached);
        }
        match award.lesson {
            Lesson::Rune(rune) => {
                if known.is_some_and(|entry| entry.runes.contains(&rune)) {
                    return Err(MagicError::AlreadyKnown);
                }
            }
            Lesson::Spell(spell) => {
                if known.is_some_and(|entry| entry.spells.contains(&spell)) {
                    return Err(MagicError::AlreadyKnown);
                }
                if !known.is_some_and(|entry| entry.runes.contains(&required_rune(spell))) {
                    return Err(MagicError::PrerequisiteMissing);
                }
            }
        }
        let entry = self.characters.entry(award.character).or_default();
        match award.lesson {
            Lesson::Rune(rune) => {
                entry.runes.insert(rune);
                if entry.mana == 0 {
                    entry.mana = AWAKENED_MANA;
                }
            }
            Lesson::Spell(spell) => {
                entry.spells.insert(spell);
            }
        }
        self.claimed_receipts.insert(award.receipt);
        Ok(())
    }

    /// A read-only server-resolved spell preview. This never spends mana,
    /// consumes reagents or produces damage. No cast packet is enabled.
    pub fn preview_cast(
        &self,
        lease: SessionLease,
        identity: &SessionIdentityRegistry,
        loot: &LootAuthority,
        spell: Spell,
    ) -> Result<SpellPlan, MagicError> {
        let character = identity
            .resolve_session(lease)
            .ok_or(MagicError::UnverifiedSession)?;
        let entry = self
            .characters
            .get(&character)
            .ok_or(MagicError::UnknownCharacter)?;
        if !entry.runes.contains(&required_rune(spell)) || !entry.spells.contains(&spell) {
            return Err(MagicError::PrerequisiteMissing);
        }
        let plan = spell_plan(spell);
        if entry.mana < plan.mana_cost {
            return Err(MagicError::InsufficientMana);
        }
        let inventory = loot
            .inventory(lease.server_session())
            .ok_or(MagicError::MissingInventory)?;
        if inventory
            .equipped(EquipmentSlot::OffHand)
            .is_none_or(|item| item.kind != ItemKind::Spellbook)
        {
            return Err(MagicError::MissingSpellbook);
        }
        let reagent_count: u32 = inventory
            .backpack()
            .iter()
            .filter(|item| item.kind == plan.reagent)
            .map(|item| u32::from(item.amount))
            .sum();
        if reagent_count < u32::from(plan.reagent_amount) {
            return Err(MagicError::MissingReagent);
        }
        Ok(plan)
    }
}

const fn required_rune(spell: Spell) -> Rune {
    match spell {
        Spell::Ember => Rune::Fire,
    }
}

const fn spell_plan(spell: Spell) -> SpellPlan {
    match spell {
        Spell::Ember => SpellPlan {
            spell,
            mana_cost: 15,
            reagent: ItemKind::SulfurAsh,
            reagent_amount: 1,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::{Action, World};
    use crate::zone::ZoneId;

    fn character(id: u64) -> CharacterId {
        CharacterId::new(id).unwrap()
    }

    fn lease(id: u32, epoch: u64) -> SessionLease {
        SessionLease::new(id, epoch).unwrap()
    }

    fn award(receipt: u64, character: CharacterId, lesson: Lesson) -> LessonAward {
        LessonAward {
            receipt: NonZeroU64::new(receipt).unwrap(),
            character,
            source: LessonSource::NpcTeacher,
            lesson,
        }
    }

    fn fighter(id: u32, dead: bool) -> crate::simulation::Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(id, 200.0, 200.0, 0.0);
        let mut value = world.fighter(id).unwrap().clone();
        if dead {
            value.action = Action::Dead;
        }
        value
    }

    #[test]
    fn new_character_has_no_magic_and_spells_must_be_earned() {
        let mut magic = MagicAuthority::new();
        let hero = character(11);
        assert!(!magic.knows_rune(hero, Rune::Fire));
        assert!(!magic.knows_spell(hero, Spell::Ember));
        assert_eq!(magic.mana(hero), 0);
        assert_eq!(
            magic.grant_lesson(award(1, hero, Lesson::Spell(Spell::Ember))),
            Err(MagicError::PrerequisiteMissing)
        );
        magic
            .grant_lesson(award(2, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        assert_eq!(magic.mana(hero), AWAKENED_MANA);
        assert!(!magic.knows_spell(hero, Spell::Ember));
        magic
            .grant_lesson(award(1, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        assert!(magic.knows_spell(hero, Spell::Ember));
    }

    #[test]
    fn duplicate_lesson_receipts_and_known_runes_fail_closed() {
        let mut magic = MagicAuthority::new();
        let hero = character(12);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        assert_eq!(
            magic.grant_lesson(award(1, character(13), Lesson::Rune(Rune::Water))),
            Err(MagicError::DuplicateReward)
        );
        assert_eq!(
            magic.grant_lesson(award(2, hero, Lesson::Rune(Rune::Fire))),
            Err(MagicError::AlreadyKnown)
        );
        assert!(!magic.knows_rune(character(13), Rune::Water));
    }

    #[test]
    fn ember_preview_checks_verified_lease_spellbook_and_real_reagent() {
        let mut magic = MagicAuthority::new();
        let hero = character(20);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        let mut ids = SessionIdentityRegistry::new();
        ids.bind_verified(lease(1, 1), hero).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        assert_eq!(
            magic.preview_cast(lease(1, 2), &ids, &loot, Spell::Ember),
            Err(MagicError::UnverifiedSession)
        );
        assert_eq!(
            magic.preview_cast(lease(1, 1), &ids, &loot, Spell::Ember),
            Err(MagicError::MissingSpellbook)
        );
        let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
        assert_eq!(
            magic.preview_cast(lease(1, 1), &ids, &loot, Spell::Ember),
            Err(MagicError::MissingReagent)
        );
        loot.grant(1, ItemKind::SulfurAsh, 3).unwrap();
        let plan = magic
            .preview_cast(lease(1, 1), &ids, &loot, Spell::Ember)
            .unwrap();
        assert_eq!(plan.mana_cost, 15);
        assert_eq!(plan.reagent_amount, 1);
        assert_eq!(magic.mana(hero), AWAKENED_MANA);
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 3);
    }

    #[test]
    fn death_loots_physical_spellbook_but_not_permanent_rune_knowledge() {
        let mut magic = MagicAuthority::new();
        let hero = character(25);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        let mut ids = SessionIdentityRegistry::new();
        ids.bind_verified(lease(1, 1), hero).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
        loot.grant(1, ItemKind::SulfurAsh, 3).unwrap();
        let corpse = loot
            .death(1, &fighter(1, true), ZoneId::Moonvale, 5)
            .unwrap();
        assert!(loot.corpses()[&corpse]
            .items
            .iter()
            .any(|item| item.id == book));
        assert!(magic.knows_rune(hero, Rune::Fire));
        assert!(magic.knows_spell(hero, Spell::Ember));
        loot.respawn(1, &fighter(1, false)).unwrap();
        assert_eq!(
            magic.preview_cast(lease(1, 1), &ids, &loot, Spell::Ember),
            Err(MagicError::MissingSpellbook)
        );
    }
}
