//! Earned magic progression for Magic Alpha. NOT a live casting system.
//! Runes, spells and mana are keyed by durable CharacterId, not loot items.
//! Lesson grants require independent server-side reward eligibility checks.
//! No networking, NPC proximity, account authentication or combat integration yet.
//! The offline progression codec is used only by the experimental joint checkpoint.
use std::collections::{BTreeMap, BTreeSet};
use std::num::NonZeroU64;

use crate::character_identity::{CharacterId, SessionIdentityRegistry, SessionLease};
use crate::loot::{EquipmentSlot, ItemKind, LootAuthority};
use crate::zone::ZoneId;

pub const AWAKENED_MANA: u16 = 100;
pub const MAX_MAGIC_CHARACTERS: usize = 4096;
pub const MAX_LESSON_RECEIPTS: usize = 65_536;
pub const MAX_PENDING_EMBER_INTENTS: usize = 4096;

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
    InvalidEffectIntent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpellPlan {
    pub spell: Spell,
    pub mana_cost: u16,
    pub reagent: ItemKind,
    pub reagent_amount: u16,
}

/// Durable intent for a future Combat resolver. Coordinates/facing are raw
/// finite f32 bits so serialization is deterministic and the struct is Eq.
/// An intent is NOT an applied projectile, damage event or acknowledgement.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmberEffectIntent {
    pub character: CharacterId,
    pub sequence: u64,
    pub zone: ZoneId,
    pub origin_x_bits: u32,
    pub origin_y_bits: u32,
    pub facing_bits: u32,
}

impl EmberEffectIntent {
    pub fn origin_x(self) -> f32 {
        f32::from_bits(self.origin_x_bits)
    }

    pub fn origin_y(self) -> f32 {
        f32::from_bits(self.origin_y_bits)
    }

    pub fn facing(self) -> f32 {
        f32::from_bits(self.facing_bits)
    }

    fn valid(self) -> bool {
        let (width, height) = self.zone.bounds();
        self.sequence != 0
            && self.origin_x().is_finite()
            && self.origin_y().is_finite()
            && self.facing().is_finite()
            && (18.0..=width - 18.0).contains(&self.origin_x())
            && (18.0..=height - 18.0).contains(&self.origin_y())
            && self.facing().abs() <= std::f32::consts::TAU
    }
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
    pending_ember: BTreeMap<(CharacterId, u64), EmberEffectIntent>,
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
                if entry.runes.is_empty() {
                    entry.mana = AWAKENED_MANA;
                }
                entry.runes.insert(rune);
            }
            Lesson::Spell(spell) => {
                entry.spells.insert(spell);
            }
        }
        self.claimed_receipts.insert(award.receipt);
        Ok(())
    }

    /// Generate a unique server-owned receipt across ALL reward types.
    /// Call only on a staged MagicAuthority under the single world writer.
    /// The caller must validate NPC eligibility and persist before publishing.
    pub(crate) fn grant_npc_lesson(
        &mut self,
        character: CharacterId,
        lesson: Lesson,
    ) -> Result<NonZeroU64, MagicError> {
        let receipt = self
            .claimed_receipts
            .iter()
            .next_back()
            .map_or(Some(1), |last| last.get().checked_add(1))
            .and_then(NonZeroU64::new)
            .ok_or(MagicError::LimitReached)?;
        self.grant_lesson(LessonAward {
            receipt,
            character,
            source: LessonSource::NpcTeacher,
            lesson,
        })?;
        Ok(receipt)
    }

    /// Debit only a staged, verified character's mana. The surrounding
    /// transaction must checkpoint this with reagent spend and replay ID.
    pub(crate) fn spend_mana(
        &mut self,
        character: CharacterId,
        amount: u16,
    ) -> Result<(), MagicError> {
        if amount == 0 {
            return Err(MagicError::InsufficientMana);
        }
        let knowledge = self
            .characters
            .get_mut(&character)
            .ok_or(MagicError::UnknownCharacter)?;
        if knowledge.mana < amount {
            return Err(MagicError::InsufficientMana);
        }
        knowledge.mana -= amount;
        Ok(())
    }

    /// Pending, not-yet-resolved effect outbox. No combat or damage is done
    /// by reading these intents. A future resolver must persist completion
    /// transactionally before replaying/retrying any side effect.
    pub fn pending_ember_intents(&self) -> impl Iterator<Item = &EmberEffectIntent> {
        self.pending_ember.values()
    }

    /// Called ONLY on a staged, authoritative MagicAuthority, after the
    /// exact command sequence and resource cost were checked. No client
    /// may construct or submit an EmberEffectIntent directly.
    pub(crate) fn stage_ember_intent(
        &mut self,
        character: CharacterId,
        sequence: u64,
        zone: ZoneId,
        x: f32,
        y: f32,
        facing: f32,
    ) -> Result<(), MagicError> {
        if !self.knows_rune(character, Rune::Fire) || !self.knows_spell(character, Spell::Ember) {
            return Err(MagicError::PrerequisiteMissing);
        }
        let intent = EmberEffectIntent {
            character,
            sequence,
            zone,
            origin_x_bits: x.to_bits(),
            origin_y_bits: y.to_bits(),
            facing_bits: facing.to_bits(),
        };
        if !intent.valid() || self.pending_ember.contains_key(&(character, sequence)) {
            return Err(MagicError::InvalidEffectIntent);
        }
        if self.pending_ember.len() >= MAX_PENDING_EMBER_INTENTS {
            return Err(MagicError::LimitReached);
        }
        self.pending_ember.insert((character, sequence), intent);
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

const PROGRESSION_MAGIC: &[u8; 8] = b"MYMAG002";
const ALL_RUNES: [Rune; 6] = [
    Rune::Fire,
    Rune::Water,
    Rune::Air,
    Rune::Earth,
    Rune::Life,
    Rune::Arcane,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MagicSnapshotError {
    Corrupt,
    TooLarge,
    InvalidState,
}

struct MagicReader<'a> {
    bytes: &'a [u8],
    cursor: usize,
}

impl<'a> MagicReader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, cursor: 0 }
    }

    fn take(&mut self, count: usize) -> Result<&'a [u8], MagicSnapshotError> {
        let end = self
            .cursor
            .checked_add(count)
            .ok_or(MagicSnapshotError::Corrupt)?;
        let result = self
            .bytes
            .get(self.cursor..end)
            .ok_or(MagicSnapshotError::Corrupt)?;
        self.cursor = end;
        Ok(result)
    }

    fn u8(&mut self) -> Result<u8, MagicSnapshotError> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16, MagicSnapshotError> {
        Ok(u16::from_le_bytes(
            self.take(2)?.try_into().expect("fixed length"),
        ))
    }

    fn u32(&mut self) -> Result<u32, MagicSnapshotError> {
        Ok(u32::from_le_bytes(
            self.take(4)?.try_into().expect("fixed length"),
        ))
    }

    fn u64(&mut self) -> Result<u64, MagicSnapshotError> {
        Ok(u64::from_le_bytes(
            self.take(8)?.try_into().expect("fixed length"),
        ))
    }

    fn finish(&self) -> Result<(), MagicSnapshotError> {
        if self.cursor == self.bytes.len() {
            Ok(())
        } else {
            Err(MagicSnapshotError::Corrupt)
        }
    }
}

impl MagicAuthority {
    /// Canonical bounded, versioned bytes for a joint world checkpoint.
    /// Never treat this unauthenticated byte format as proof of a lesson.
    pub(crate) fn encode_progression(&self) -> Result<Vec<u8>, MagicSnapshotError> {
        if self.characters.len() > MAX_MAGIC_CHARACTERS
            || self.claimed_receipts.len() > MAX_LESSON_RECEIPTS
        {
            return Err(MagicSnapshotError::TooLarge);
        }
        let mut bytes = Vec::new();
        bytes.extend_from_slice(PROGRESSION_MAGIC);
        bytes.extend_from_slice(&(self.characters.len() as u32).to_le_bytes());
        for (character, knowledge) in &self.characters {
            if knowledge.mana > AWAKENED_MANA
                || (knowledge.runes.is_empty()
                    && (!knowledge.spells.is_empty() || knowledge.mana != 0))
                || (knowledge.spells.contains(&Spell::Ember)
                    && !knowledge.runes.contains(&Rune::Fire))
            {
                return Err(MagicSnapshotError::InvalidState);
            }
            bytes.extend_from_slice(&character.get().to_le_bytes());
            bytes.extend_from_slice(&knowledge.mana.to_le_bytes());
            let rune_bits = ALL_RUNES
                .iter()
                .enumerate()
                .fold(0_u8, |bits, (index, rune)| {
                    if knowledge.runes.contains(rune) {
                        bits | (1 << index)
                    } else {
                        bits
                    }
                });
            bytes.push(rune_bits);
            bytes.push(u8::from(knowledge.spells.contains(&Spell::Ember)));
        }
        bytes.extend_from_slice(&(self.claimed_receipts.len() as u32).to_le_bytes());
        for receipt in &self.claimed_receipts {
            bytes.extend_from_slice(&receipt.get().to_le_bytes());
        }
        if self.pending_ember.len() > MAX_PENDING_EMBER_INTENTS {
            return Err(MagicSnapshotError::TooLarge);
        }
        bytes.extend_from_slice(&(self.pending_ember.len() as u32).to_le_bytes());
        for (key, intent) in &self.pending_ember {
            if *key != (intent.character, intent.sequence)
                || !intent.valid()
                || !self.knows_rune(intent.character, Rune::Fire)
                || !self.knows_spell(intent.character, Spell::Ember)
            {
                return Err(MagicSnapshotError::InvalidState);
            }
            bytes.extend_from_slice(&intent.character.get().to_le_bytes());
            bytes.extend_from_slice(&intent.sequence.to_le_bytes());
            bytes.push(match intent.zone {
                ZoneId::Moonvale => 0,
                ZoneId::RedLionInn => 1,
            });
            bytes.extend_from_slice(&intent.origin_x_bits.to_le_bytes());
            bytes.extend_from_slice(&intent.origin_y_bits.to_le_bytes());
            bytes.extend_from_slice(&intent.facing_bits.to_le_bytes());
        }
        Ok(bytes)
    }

    /// Fail-closed recovery: no partial rune knowledge is ever returned.
    pub(crate) fn decode_progression(bytes: &[u8]) -> Result<Self, MagicSnapshotError> {
        let mut reader = MagicReader::new(bytes);
        if reader.take(PROGRESSION_MAGIC.len())? != PROGRESSION_MAGIC {
            return Err(MagicSnapshotError::Corrupt);
        }
        let character_count = reader.u32()? as usize;
        if character_count > MAX_MAGIC_CHARACTERS {
            return Err(MagicSnapshotError::TooLarge);
        }
        let mut characters = BTreeMap::new();
        for _ in 0..character_count {
            let character = CharacterId::new(reader.u64()?).ok_or(MagicSnapshotError::Corrupt)?;
            let mana = reader.u16()?;
            let rune_bits = reader.u8()?;
            let spell_bits = reader.u8()?;
            if rune_bits & !0b0011_1111 != 0 || spell_bits & !0b0000_0001 != 0 {
                return Err(MagicSnapshotError::Corrupt);
            }
            let runes = ALL_RUNES
                .iter()
                .enumerate()
                .filter_map(|(index, rune)| {
                    if rune_bits & (1 << index) != 0 {
                        Some(*rune)
                    } else {
                        None
                    }
                })
                .collect();
            let mut spells = BTreeSet::new();
            if spell_bits & 1 != 0 {
                spells.insert(Spell::Ember);
            }
            let knowledge = CharacterMagic {
                runes,
                spells,
                mana,
            };
            if characters.insert(character, knowledge).is_some() {
                return Err(MagicSnapshotError::Corrupt);
            }
        }
        let receipt_count = reader.u32()? as usize;
        if receipt_count > MAX_LESSON_RECEIPTS {
            return Err(MagicSnapshotError::TooLarge);
        }
        let mut claimed_receipts = BTreeSet::new();
        for _ in 0..receipt_count {
            let receipt = NonZeroU64::new(reader.u64()?).ok_or(MagicSnapshotError::Corrupt)?;
            if !claimed_receipts.insert(receipt) {
                return Err(MagicSnapshotError::Corrupt);
            }
        }
        let intent_count = reader.u32()? as usize;
        if intent_count > MAX_PENDING_EMBER_INTENTS {
            return Err(MagicSnapshotError::TooLarge);
        }
        let mut pending_ember = BTreeMap::new();
        for _ in 0..intent_count {
            let character = CharacterId::new(reader.u64()?).ok_or(MagicSnapshotError::Corrupt)?;
            let sequence = reader.u64()?;
            let zone = match reader.u8()? {
                0 => ZoneId::Moonvale,
                1 => ZoneId::RedLionInn,
                _ => return Err(MagicSnapshotError::Corrupt),
            };
            let intent = EmberEffectIntent {
                character,
                sequence,
                zone,
                origin_x_bits: reader.u32()?,
                origin_y_bits: reader.u32()?,
                facing_bits: reader.u32()?,
            };
            if !intent.valid()
                || pending_ember
                    .insert((character, sequence), intent)
                    .is_some()
            {
                return Err(MagicSnapshotError::Corrupt);
            }
        }
        reader.finish()?;
        let result = Self {
            characters,
            claimed_receipts,
            pending_ember,
        };
        result
            .encode_progression()
            .map_err(|_| MagicSnapshotError::Corrupt)?;
        Ok(result)
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
    fn progression_codec_preserves_runes_mana_and_claimed_receipts() {
        let mut magic = MagicAuthority::new();
        let hero = character(333);
        magic
            .grant_lesson(award(40, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(41, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic.characters.get_mut(&hero).unwrap().mana = 25;
        let bytes = magic.encode_progression().unwrap();
        let mut restored = MagicAuthority::decode_progression(&bytes).unwrap();
        assert_eq!(restored, magic);
        assert_eq!(restored.mana(hero), 25);
        assert_eq!(
            restored.grant_lesson(award(40, character(334), Lesson::Rune(Rune::Water))),
            Err(MagicError::DuplicateReward)
        );
        assert!(matches!(
            MagicAuthority::decode_progression(&bytes[..bytes.len() - 1]),
            Err(MagicSnapshotError::Corrupt)
        ));
    }

    #[test]
    fn progression_codec_rejects_unknown_runes_and_impossible_mana() {
        let mut magic = MagicAuthority::new();
        magic
            .grant_lesson(award(10, character(20), Lesson::Rune(Rune::Fire)))
            .unwrap();
        let bytes = magic.encode_progression().unwrap();
        let mut unknown_rune = bytes.clone();
        unknown_rune[PROGRESSION_MAGIC.len() + 4 + 8 + 2] = 0b1000_0000;
        assert!(matches!(
            MagicAuthority::decode_progression(&unknown_rune),
            Err(MagicSnapshotError::Corrupt)
        ));
        let mut impossible_mana = bytes;
        impossible_mana[PROGRESSION_MAGIC.len() + 4 + 8] = 200;
        assert!(matches!(
            MagicAuthority::decode_progression(&impossible_mana),
            Err(MagicSnapshotError::Corrupt)
        ));
    }

    #[test]
    fn ember_intent_roundtrip_rejects_forged_geometry_and_invalid_zone() {
        let mut magic = MagicAuthority::new();
        let hero = character(411);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 25, ZoneId::Moonvale, 200.0, 200.0, 0.5)
            .unwrap();
        assert_eq!(magic.pending_ember_intents().count(), 1);
        let record = *magic.pending_ember_intents().next().unwrap();
        assert_eq!(record.sequence, 25);
        assert_eq!(record.origin_x(), 200.0);
        assert_eq!(record.facing(), 0.5);
        let bytes = magic.encode_progression().unwrap();
        assert_eq!(MagicAuthority::decode_progression(&bytes).unwrap(), magic);

        let mut wrong_zone = bytes.clone();
        let zone_offset = bytes.len() - 13;
        wrong_zone[zone_offset] = 255;
        assert!(matches!(
            MagicAuthority::decode_progression(&wrong_zone),
            Err(MagicSnapshotError::Corrupt)
        ));
        let mut nan_facing = bytes;
        nan_facing[zone_offset + 9..].copy_from_slice(&f32::NAN.to_bits().to_le_bytes());
        assert!(matches!(
            MagicAuthority::decode_progression(&nan_facing),
            Err(MagicSnapshotError::Corrupt)
        ));
    }

    #[test]
    fn invalid_or_duplicate_intent_never_changes_magic_state() {
        let mut magic = MagicAuthority::new();
        let hero = character(412);
        assert_eq!(
            magic.stage_ember_intent(hero, 10, ZoneId::Moonvale, 200.0, 200.0, 0.0),
            Err(MagicError::PrerequisiteMissing)
        );
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        for (sequence, x, heading) in [
            (0, 200.0, 0.0),
            (1, f32::NAN, 0.0),
            (1, 200.0, f32::INFINITY),
        ] {
            assert_eq!(
                magic.stage_ember_intent(hero, sequence, ZoneId::Moonvale, x, 200.0, heading),
                Err(MagicError::InvalidEffectIntent)
            );
        }
        magic
            .stage_ember_intent(hero, 1, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        assert_eq!(
            magic.stage_ember_intent(hero, 1, ZoneId::Moonvale, 200.0, 200.0, 0.0),
            Err(MagicError::InvalidEffectIntent)
        );
        assert_eq!(magic.pending_ember_intents().count(), 1);
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
    fn learning_another_rune_never_refills_depleted_mana() {
        let mut magic = MagicAuthority::new();
        let hero = character(99);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic.characters.get_mut(&hero).unwrap().mana = 0;
        magic
            .grant_lesson(award(2, hero, Lesson::Rune(Rune::Water)))
            .unwrap();
        assert_eq!(magic.mana(hero), 0);
        assert!(magic.knows_rune(hero, Rune::Water));
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
