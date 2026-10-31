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
    InvalidCastReceipt,
    DuplicateCastReceipt,
    UnknownEffectIntent,
    EffectAlreadyResolved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpellPlan {
    pub spell: Spell,
    pub mana_cost: u16,
    pub reagent: ItemKind,
    pub reagent_amount: u16,
}

/// Durable no-effect outcome. "Applied" does not exist until Combat can
/// atomically persist damage/death/world events with the intent transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmberEffectStatus {
    Pending,
    Interrupted,
    Cancelled,
}

/// Durable intent for a future Combat resolver. Coordinates/facing are raw
/// finite f32 bits so serialization is deterministic and the struct is Eq.
/// An intent is NOT an applied projectile, damage event or acknowledgement.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmberEffectIntent {
    pub status: EmberEffectStatus,
    pub character: CharacterId,
    pub sequence: u64,
    pub zone: ZoneId,
    pub origin_x_bits: u32,
    pub origin_y_bits: u32,
    pub facing_bits: u32,
}

/// Magic-local typed evidence that the Ember resource debit and exact
/// pending intent were staged together. This is NOT a Core 8B canonical
/// transaction receipt, authenticated signature, World effect receipt or
/// proof of applied damage. The dormant MYWLD003 caller must still serialize
/// the complete Loot+Magic transaction under one writer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct EmberCastCostReceipt {
    pub(crate) character: CharacterId,
    pub(crate) sequence: u64,
    pub(crate) lease: SessionLease,
    pub(crate) zone: ZoneId,
    pub(crate) mana_spent: u16,
    pub(crate) sulfur_ash_spent: u16,
    origin_x_bits: u32,
    origin_y_bits: u32,
    facing_bits: u32,
}

impl EmberCastCostReceipt {
    pub(crate) fn valid_for(self, intent: &EmberEffectIntent) -> bool {
        let expected = spell_plan(Spell::Ember);
        self.sequence != 0
            && self.character == intent.character
            && self.sequence == intent.sequence
            && self.zone == intent.zone
            && self.origin_x_bits == intent.origin_x_bits
            && self.origin_y_bits == intent.origin_y_bits
            && self.facing_bits == intent.facing_bits
            && self.mana_spent == expected.mana_cost
            && self.sulfur_ash_spent == expected.reagent_amount
    }
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
    cast_cost_receipts: BTreeMap<(CharacterId, u64), EmberCastCostReceipt>,
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
        self.pending_ember
            .values()
            .filter(|intent| intent.status == EmberEffectStatus::Pending)
    }

    pub fn resolved_ember_intents(&self) -> impl Iterator<Item = &EmberEffectIntent> {
        self.pending_ember
            .values()
            .filter(|intent| intent.status != EmberEffectStatus::Pending)
    }

    /// All historical intent identities, including terminal tombstones.
    /// Retention is intentionally bounded until a durable GC/receipt protocol
    /// exists; terminal records must not become pending again after a restart.
    pub(crate) fn all_ember_intents(&self) -> impl Iterator<Item = &EmberEffectIntent> {
        self.pending_ember.values()
    }

    pub fn ember_intent(
        &self,
        character: CharacterId,
        sequence: u64,
    ) -> Option<&EmberEffectIntent> {
        self.pending_ember.get(&(character, sequence))
    }

    /// Server-only no-effect completion on a staged ledger. The caller must
    /// independently verify the interrupt/cancel event and checkpoint it
    /// with the loot state before publishing. No client may invoke it.
    pub(crate) fn resolve_ember_without_effect(
        &mut self,
        character: CharacterId,
        sequence: u64,
        resolution: EmberEffectStatus,
    ) -> Result<(), MagicError> {
        if resolution == EmberEffectStatus::Pending {
            return Err(MagicError::InvalidEffectIntent);
        }
        let intent = self
            .pending_ember
            .get_mut(&(character, sequence))
            .ok_or(MagicError::UnknownEffectIntent)?;
        if intent.status != EmberEffectStatus::Pending {
            return Err(MagicError::EffectAlreadyResolved);
        }
        intent.status = resolution;
        Ok(())
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
            status: EmberEffectStatus::Pending,
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

    /// Record Magic-local cast-cost provenance only after the staged Loot
    /// debit, mana debit and exact intent have all succeeded. This marker is
    /// persisted beside the intent; it does not replace Core's canonical
    /// transaction receipt or establish distributed writer/epoch authority.
    pub(crate) fn record_ember_cost_receipt(
        &mut self,
        identity: &SessionIdentityRegistry,
        lease: SessionLease,
        character: CharacterId,
        sequence: u64,
        zone: ZoneId,
        plan: SpellPlan,
    ) -> Result<(), MagicError> {
        if identity.resolve_session(lease) != Some(character) {
            return Err(MagicError::UnverifiedSession);
        }
        if plan != spell_plan(Spell::Ember) {
            return Err(MagicError::InvalidCastReceipt);
        }
        let key = (character, sequence);
        let intent = self
            .pending_ember
            .get(&key)
            .copied()
            .ok_or(MagicError::UnknownEffectIntent)?;
        if intent.status != EmberEffectStatus::Pending || intent.zone != zone {
            return Err(MagicError::InvalidCastReceipt);
        }
        if self.cast_cost_receipts.contains_key(&key) {
            return Err(MagicError::DuplicateCastReceipt);
        }
        if self.cast_cost_receipts.len() >= MAX_PENDING_EMBER_INTENTS {
            return Err(MagicError::LimitReached);
        }
        let receipt = EmberCastCostReceipt {
            character,
            sequence,
            lease,
            zone,
            mana_spent: plan.mana_cost,
            sulfur_ash_spent: plan.reagent_amount,
            origin_x_bits: intent.origin_x_bits,
            origin_y_bits: intent.origin_y_bits,
            facing_bits: intent.facing_bits,
        };
        if !receipt.valid_for(&intent) {
            return Err(MagicError::InvalidCastReceipt);
        }
        self.cast_cost_receipts.insert(key, receipt);
        Ok(())
    }

    pub(crate) fn ember_cost_receipt(
        &self,
        character: CharacterId,
        sequence: u64,
    ) -> Option<&EmberCastCostReceipt> {
        self.cast_cost_receipts.get(&(character, sequence))
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

const PROGRESSION_MAGIC_V3: &[u8; 8] = b"MYMAG003";
const PROGRESSION_MAGIC: &[u8; 8] = b"MYMAG004";
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
            || self.cast_cost_receipts.len() > MAX_PENDING_EMBER_INTENTS
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
        bytes.extend_from_slice(&(self.cast_cost_receipts.len() as u32).to_le_bytes());
        for (key, receipt) in &self.cast_cost_receipts {
            let intent = self
                .pending_ember
                .get(key)
                .ok_or(MagicSnapshotError::InvalidState)?;
            if *key != (receipt.character, receipt.sequence) || !receipt.valid_for(intent) {
                return Err(MagicSnapshotError::InvalidState);
            }
            bytes.extend_from_slice(&receipt.character.get().to_le_bytes());
            bytes.extend_from_slice(&receipt.sequence.to_le_bytes());
            bytes.extend_from_slice(&receipt.lease.server_session().to_le_bytes());
            bytes.extend_from_slice(&receipt.lease.epoch().to_le_bytes());
            bytes.push(match receipt.zone {
                ZoneId::Moonvale => 0,
                ZoneId::RedLionInn => 1,
            });
            bytes.extend_from_slice(&receipt.mana_spent.to_le_bytes());
            bytes.extend_from_slice(&receipt.sulfur_ash_spent.to_le_bytes());
            bytes.extend_from_slice(&receipt.origin_x_bits.to_le_bytes());
            bytes.extend_from_slice(&receipt.origin_y_bits.to_le_bytes());
            bytes.extend_from_slice(&receipt.facing_bits.to_le_bytes());
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
            bytes.push(match intent.status {
                EmberEffectStatus::Pending => 0,
                EmberEffectStatus::Interrupted => 1,
                EmberEffectStatus::Cancelled => 2,
            });
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
        let header = reader.take(PROGRESSION_MAGIC.len())?;
        let has_cast_receipts = if header == PROGRESSION_MAGIC {
            true
        } else if header == PROGRESSION_MAGIC_V3 {
            false
        } else {
            return Err(MagicSnapshotError::Corrupt);
        };
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
        let mut cast_cost_receipts = BTreeMap::new();
        if has_cast_receipts {
            let cast_receipt_count = reader.u32()? as usize;
            if cast_receipt_count > MAX_PENDING_EMBER_INTENTS {
                return Err(MagicSnapshotError::TooLarge);
            }
            for _ in 0..cast_receipt_count {
                let character =
                    CharacterId::new(reader.u64()?).ok_or(MagicSnapshotError::Corrupt)?;
                let sequence = reader.u64()?;
                let server_session = reader.u32()?;
                let lease_epoch = reader.u64()?;
                let lease = SessionLease::new(server_session, lease_epoch)
                    .ok_or(MagicSnapshotError::Corrupt)?;
                let zone = match reader.u8()? {
                    0 => ZoneId::Moonvale,
                    1 => ZoneId::RedLionInn,
                    _ => return Err(MagicSnapshotError::Corrupt),
                };
                let receipt = EmberCastCostReceipt {
                    character,
                    sequence,
                    lease,
                    zone,
                    mana_spent: reader.u16()?,
                    sulfur_ash_spent: reader.u16()?,
                    origin_x_bits: reader.u32()?,
                    origin_y_bits: reader.u32()?,
                    facing_bits: reader.u32()?,
                };
                if receipt.sequence == 0
                    || receipt.mana_spent != spell_plan(Spell::Ember).mana_cost
                    || receipt.sulfur_ash_spent != spell_plan(Spell::Ember).reagent_amount
                    || cast_cost_receipts
                        .insert((character, sequence), receipt)
                        .is_some()
                {
                    return Err(MagicSnapshotError::Corrupt);
                }
            }
        }
        let intent_count = reader.u32()? as usize;
        if intent_count > MAX_PENDING_EMBER_INTENTS {
            return Err(MagicSnapshotError::TooLarge);
        }
        let mut pending_ember = BTreeMap::new();
        for _ in 0..intent_count {
            let status = match reader.u8()? {
                0 => EmberEffectStatus::Pending,
                1 => EmberEffectStatus::Interrupted,
                2 => EmberEffectStatus::Cancelled,
                _ => return Err(MagicSnapshotError::Corrupt),
            };
            let character = CharacterId::new(reader.u64()?).ok_or(MagicSnapshotError::Corrupt)?;
            let sequence = reader.u64()?;
            let zone = match reader.u8()? {
                0 => ZoneId::Moonvale,
                1 => ZoneId::RedLionInn,
                _ => return Err(MagicSnapshotError::Corrupt),
            };
            let intent = EmberEffectIntent {
                status,
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
            cast_cost_receipts,
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
    fn interrupt_and_cancel_become_durable_tombstones_not_pending_effects() {
        let mut magic = MagicAuthority::new();
        let hero = character(720);
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 20, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        magic
            .stage_ember_intent(hero, 21, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        magic
            .resolve_ember_without_effect(hero, 20, EmberEffectStatus::Interrupted)
            .unwrap();
        magic
            .resolve_ember_without_effect(hero, 21, EmberEffectStatus::Cancelled)
            .unwrap();
        assert_eq!(magic.pending_ember_intents().count(), 0);
        assert_eq!(magic.resolved_ember_intents().count(), 2);
        let bytes = magic.encode_progression().unwrap();
        let mut restored = MagicAuthority::decode_progression(&bytes).unwrap();
        assert_eq!(
            restored.ember_intent(hero, 20).unwrap().status,
            EmberEffectStatus::Interrupted
        );
        assert_eq!(
            restored.ember_intent(hero, 21).unwrap().status,
            EmberEffectStatus::Cancelled
        );
        assert_eq!(restored.pending_ember_intents().count(), 0);
        assert_eq!(
            restored.resolve_ember_without_effect(hero, 20, EmberEffectStatus::Cancelled),
            Err(MagicError::EffectAlreadyResolved)
        );
        assert_eq!(
            restored.stage_ember_intent(hero, 20, ZoneId::Moonvale, 200.0, 200.0, 0.0),
            Err(MagicError::InvalidEffectIntent)
        );
    }

    #[test]
    fn forged_terminal_status_and_nonexistent_resolution_fail_closed() {
        let mut magic = MagicAuthority::new();
        let hero = character(721);
        assert_eq!(
            magic.resolve_ember_without_effect(hero, 10, EmberEffectStatus::Interrupted),
            Err(MagicError::UnknownEffectIntent)
        );
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 9, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        assert_eq!(
            magic.resolve_ember_without_effect(hero, 9, EmberEffectStatus::Pending),
            Err(MagicError::InvalidEffectIntent)
        );
        let mut bytes = magic.encode_progression().unwrap();
        // Each record ends with 29 bytes after the one-byte status.
        let status_index = bytes.len() - 30;
        bytes[status_index] = 255;
        assert!(matches!(
            MagicAuthority::decode_progression(&bytes),
            Err(MagicSnapshotError::Corrupt)
        ));
        assert_eq!(magic.pending_ember_intents().count(), 1);
    }

    /// P0 physical sword ownership transfer is independent of earned magic:
    /// no Fire/Ember prerequisite, cost, wipe or ownership-based spell grant.
    /// This is only the dormant Items u64 checkpoint prototype, NOT a
    /// Core-8B u128, authenticated browser or live fencing/Physics proof.
    #[test]
    fn spell_progression_survives_checked_sword_drop_and_new_owner_pickup() {
        use crate::loot::LootError;
        use crate::loot_transaction::{
            commit_verified_equipped_sword_drop_checked,
            commit_verified_ground_sword_equip_checked, GroundSwordAuthority, PickupCommitError,
            PickupWorldTick, VerifiedLootOperation,
        };
        use crate::magic_checkpoint::load_joint;
        use crate::zone::ZoneAuthority;
        use std::sync::atomic::{AtomicU64, Ordering};

        static CHECKPOINT_SEQ: AtomicU64 = AtomicU64::new(1);
        let number = CHECKPOINT_SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "myaso-magic2a-drop-no-spell-transfer-{}-{number}.bin",
            std::process::id()
        ));

        let mut world = World::new(800.0, 600.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for (id, x) in [(1, 200.0), (2, 245.0), (3, 212.0), (4, 340.0)] {
            assert!(world.add_player_at(id, x, 200.0, 0.0));
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id, 1), character(u64::from(id)))
                .unwrap();
            loot.register(id).unwrap();
        }

        // Fire/Ember are already earned by the former sword owner, while
        // the eventual receiver has NEVER learned a spell or awakened mana.
        let mut magic = MagicAuthority::new();
        magic
            .grant_lesson(award(91, character(1), Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(92, character(1), Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .grant_lesson(award(93, character(2), Lesson::Rune(Rune::Water)))
            .unwrap();
        magic.characters.get_mut(&character(1)).unwrap().mana = 37;
        let before = magic.encode_progression().unwrap();
        assert_eq!(magic.mana(character(1)), 37);
        assert_eq!(magic.mana(character(3)), 0);

        let physical_id = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        loot.equip(1, physical_id, EquipmentSlot::MainHand).unwrap();
        // The Items drop primitive must not require transient backpack space.
        for _ in 0..crate::loot::BACKPACK_CAPACITY {
            loot.grant(1, ItemKind::Gold, 1).unwrap();
        }
        assert_eq!(
            loot.inventory(1).unwrap().backpack().len(),
            crate::loot::BACKPACK_CAPACITY
        );

        macro_rules! sword_authority {
            ($actor:expr, $seq:expr) => {
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: lease($actor, 1),
                        sequence: $seq,
                    },
                }
            };
        }

        // Failed trusted geometry must not consume a command or leak a sword.
        assert!(matches!(
            commit_verified_equipped_sword_drop_checked(sword_authority!(1, 1), |_, _| Err(
                PickupCommitError::GeometryRejected
            )),
            Err(PickupCommitError::GeometryRejected)
        ));
        assert!(!path.exists());
        assert!(loot.ground().is_empty());
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(loot.committed_operation_sequence(character(1)), None);
        assert_eq!(magic.encode_progression().unwrap(), before);

        // The authoritative prototype drops the ORIGINAL physical sword ID,
        // not an item cloned into a backpack or issued by learned magic.
        let dropped =
            commit_verified_equipped_sword_drop_checked(sword_authority!(1, 1), |fighter, zone| {
                assert_eq!((fighter.x, fighter.y), (200.0, 200.0));
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            })
            .unwrap();
        assert_eq!(dropped.expected_item_id, physical_id);
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(loot.inventory(1).unwrap().backpack().len(), 64);
        assert_eq!(loot.ground().len(), 1);
        assert_eq!(
            loot.ground()[&dropped.ground_entity_id].item.id,
            physical_id
        );
        assert_eq!(magic.encode_progression().unwrap(), before);
        let (after_drop, saved_magic) = load_joint(&path).unwrap();
        assert_eq!(saved_magic.encode_progression().unwrap(), before);
        assert_eq!(
            after_drop.committed_operation_sequence(character(1)),
            Some(1)
        );
        assert!(after_drop
            .parked_inventory(character(1))
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());

        // An unawakened receiver must equip the SAME item without Fire,
        // Ember, mana, a Spellbook, a lesson or a spell debit.
        let taken = commit_verified_ground_sword_equip_checked(
            sword_authority!(3, 1),
            dropped,
            |fighter, ground, zone| {
                assert_eq!(fighter.net_id, 3);
                assert_eq!(ground.item.id, physical_id);
                assert_eq!(ground.zone, zone);
                assert_eq!(fighter.x - ground.at.x, 12.0);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(taken.id, physical_id);
        assert!(loot.ground().is_empty());
        assert_eq!(
            loot.inventory(3)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(magic.encode_progression().unwrap(), before);
        assert_eq!(magic.mana(character(3)), 0);
        assert!(!magic.knows_rune(character(3), Rune::Fire));
        assert!(!magic.knows_spell(character(3), Spell::Ember));

        // Same verified sequence cannot reissue the sword or modify magic.
        assert!(matches!(
            commit_verified_ground_sword_equip_checked(
                sword_authority!(3, 1),
                dropped,
                |_, _, _| panic!("replay must not reach geometry"),
            ),
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));
        assert_eq!(magic.encode_progression().unwrap(), before);

        let (mut recovered, recovered_magic) = load_joint(&path).unwrap();
        assert_eq!(recovered_magic.encode_progression().unwrap(), before);
        assert!(recovered_magic.knows_rune(character(1), Rune::Fire));
        assert!(recovered_magic.knows_spell(character(1), Spell::Ember));
        assert!(recovered_magic.knows_rune(character(2), Rune::Water));
        assert_eq!(recovered_magic.mana(character(1)), 37);
        assert_eq!(recovered_magic.mana(character(3)), 0);
        assert!(recovered.ground().is_empty());
        assert!(recovered
            .parked_inventory(character(1))
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            recovered
                .parked_inventory(character(3))
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(
            recovered.committed_operation_sequence(character(1)),
            Some(1)
        );
        assert_eq!(
            recovered.committed_operation_sequence(character(3)),
            Some(1)
        );
        assert_eq!(
            recovered
                .parked_inventory(character(1))
                .unwrap()
                .backpack()
                .len(),
            crate::loot::BACKPACK_CAPACITY
        );

        // A reconnect creates NEW authenticated sessions, not new characters.
        // Neither the transfer nor reattachment can move earned knowledge or
        // mint a replacement item for either player's MainHand.
        let mut fresh_identity = SessionIdentityRegistry::new();
        fresh_identity
            .bind_verified(lease(101, 2), character(1))
            .unwrap();
        fresh_identity
            .bind_verified(lease(103, 2), character(3))
            .unwrap();
        recovered
            .resume_inventory(&fresh_identity, lease(101, 2))
            .unwrap();
        recovered
            .resume_inventory(&fresh_identity, lease(103, 2))
            .unwrap();
        assert!(recovered
            .inventory(101)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            recovered
                .inventory(103)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(recovered_magic.encode_progression().unwrap(), before);
        assert_eq!(recovered_magic.mana(character(1)), 37);
        assert_eq!(recovered_magic.mana(character(3)), 0);
        assert!(!recovered_magic.knows_spell(character(3), Spell::Ember));
        let _ = std::fs::remove_file(&path);
    }

    /// A real physical sword transaction must never turn a forged or
    /// unbacked P2 Ember intent into an acknowledged, recoverable state.
    /// Conversely, already checkpointed pending intents belong permanently
    /// to their casting CHARACTER, never to the physical sword's next owner.
    #[test]
    fn checked_sword_transfer_fences_unbacked_ember_intent_and_preserves_backed_one() {
        use crate::loot_transaction::{
            commit_verified_equipped_sword_drop_checked,
            commit_verified_ground_sword_equip_checked, GroundSwordAuthority, PickupCommitError,
            PickupWorldTick, VerifiedLootOperation,
        };
        use crate::magic_checkpoint::{load_joint, JointCheckpointError};
        use crate::zone::ZoneAuthority;
        use std::sync::atomic::{AtomicU64, Ordering};

        static CHECKPOINT_SEQ: AtomicU64 = AtomicU64::new(1);
        let count = CHECKPOINT_SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "myaso-magic2a-sword-pending-intent-{}-{count}.bin",
            std::process::id()
        ));
        let mut world = World::new(800.0, 600.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for (id, x) in [(1, 200.0_f32), (2, 224.0)] {
            assert!(world.add_player_at(id, x, 200.0, 0.0));
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id, 1), character(u64::from(id)))
                .unwrap();
            loot.register(id).unwrap();
        }
        let physical_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, physical_id, EquipmentSlot::MainHand).unwrap();

        // Deliberately staged in a dormant server-side test fixture, NOT a
        // real spell cast or an authorization to activate Ember in gameplay.
        let mut magic = MagicAuthority::new();
        magic
            .grant_lesson(award(11, character(1), Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(12, character(1), Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(character(1), 7, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        let pending = *magic.ember_intent(character(1), 7).unwrap();
        assert_eq!(pending.status, EmberEffectStatus::Pending);
        let progression = magic.encode_progression().unwrap();

        macro_rules! authority {
            ($id:expr, $seq:expr) => {
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: lease($id, 1),
                        sequence: $seq,
                    },
                }
            };
        }

        // seq7 has NO backing committed operation. Writing a new sword
        // checkpoint at seq1 must fail CLOSED rather than persist a pending
        // future damage intent with no durable command provenance.
        assert!(matches!(
            commit_verified_equipped_sword_drop_checked(authority!(1, 1), |_, _| Ok(())),
            Err(PickupCommitError::JointCheckpoint(
                JointCheckpointError::Corrupt
            ))
        ));
        assert!(!path.exists());
        assert!(loot.ground().is_empty());
        assert_eq!(loot.committed_operation_sequence(character(1)), None);
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(magic.encode_progression().unwrap(), progression);

        // Replace the deliberately uncosted fixture with a real Ember cost
        // transaction: actual Spellbook, SulfurAsh and mana are committed
        // together with a typed Magic-local cast-cost receipt.
        magic = MagicAuthority::new();
        magic
            .grant_lesson(award(13, character(1), Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(14, character(1), Lesson::Spell(Spell::Ember)))
            .unwrap();
        let spellbook = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, spellbook, EquipmentSlot::OffHand).unwrap();
        loot.grant(1, ItemKind::SulfurAsh, 2).unwrap();
        let fighter = world.fighter(1).unwrap().clone();
        let cost = crate::magic_cast::commit_ember_cost(
            &path,
            &mut loot,
            &mut magic,
            &identity,
            &zones,
            VerifiedLootOperation {
                lease: lease(1, 1),
                sequence: 7,
            },
            &fighter,
        )
        .unwrap();
        assert_eq!((cost.mana_spent, cost.sulfur_ash_spent), (15, 1));
        assert_eq!(magic.mana(character(1)), 85);
        let pending = *magic.ember_intent(character(1), 7).unwrap();
        let progression = magic.encode_progression().unwrap();
        let prior_cost = magic.ember_cost_receipt(character(1), 7).unwrap();
        assert_eq!(prior_cost.lease, lease(1, 1));
        assert_eq!(prior_cost.mana_spent, 15);
        assert_eq!(prior_cost.sulfur_ash_spent, 1);
        let (prior_loot, prior_magic) = load_joint(&path).unwrap();
        assert_eq!(
            prior_loot.committed_operation_sequence(character(1)),
            Some(7)
        );
        assert_eq!(prior_magic.ember_intent(character(1), 7), Some(&pending));
        assert_eq!(
            prior_magic.ember_cost_receipt(character(1), 7),
            Some(prior_cost)
        );
        assert_eq!(prior_magic.encode_progression().unwrap(), progression);

        // Later successful physical sword drop is sequence 8. The intent
        // remains pending, tied to character1, not moved with the sword.
        let dropped =
            commit_verified_equipped_sword_drop_checked(authority!(1, 8), |fighter, zone| {
                assert_eq!(fighter.net_id, 1);
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            })
            .unwrap();
        assert_eq!(dropped.expected_item_id, physical_id);
        assert_eq!(
            loot.ground()[&dropped.ground_entity_id].item.id,
            physical_id
        );
        assert_eq!(magic.encode_progression().unwrap(), progression);

        let claimed = commit_verified_ground_sword_equip_checked(
            authority!(2, 1),
            dropped,
            |fighter, ground, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(ground.item.id, physical_id);
                assert_eq!(ground.zone, zone);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(claimed.id, physical_id);
        assert!(loot.ground().is_empty());
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert!(!magic.knows_rune(character(2), Rune::Fire));
        assert!(!magic.knows_spell(character(2), Spell::Ember));
        assert!(magic.ember_intent(character(2), 7).is_none());
        assert_eq!(magic.ember_intent(character(1), 7), Some(&pending));

        let (recovered, recovered_magic) = load_joint(&path).unwrap();
        assert_eq!(recovered_magic.encode_progression().unwrap(), progression);
        assert_eq!(
            recovered_magic.ember_intent(character(1), 7),
            Some(&pending)
        );
        assert!(recovered_magic.ember_intent(character(2), 7).is_none());
        assert_eq!(recovered_magic.pending_ember_intents().count(), 1);
        assert_eq!(
            recovered.committed_operation_sequence(character(1)),
            Some(8)
        );
        assert_eq!(
            recovered.committed_operation_sequence(character(2)),
            Some(1)
        );
        assert!(recovered.ground().is_empty());
        assert_eq!(
            recovered
                .parked_inventory(character(2))
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );

        // The persisted pending Ember intent belongs to the original caster
        // across BOTH players' authenticated reconnects. A sword changes
        // owners; neither the intent key nor the spell knowledge changes.
        let mut fresh_identity = SessionIdentityRegistry::new();
        fresh_identity
            .bind_verified(lease(101, 2), character(1))
            .unwrap();
        fresh_identity
            .bind_verified(lease(102, 2), character(2))
            .unwrap();
        let mut resumed = recovered;
        resumed
            .resume_inventory(&fresh_identity, lease(101, 2))
            .unwrap();
        resumed
            .resume_inventory(&fresh_identity, lease(102, 2))
            .unwrap();
        assert!(resumed
            .inventory(101)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            resumed
                .inventory(102)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            physical_id
        );
        assert_eq!(recovered_magic.encode_progression().unwrap(), progression);
        assert_eq!(
            recovered_magic.ember_intent(character(1), 7),
            Some(&pending)
        );
        assert!(recovered_magic.ember_intent(character(2), 7).is_none());
        assert_eq!(recovered_magic.pending_ember_intents().count(), 1);
        assert_eq!(recovered_magic.mana(character(2)), 0);
        let _ = std::fs::remove_file(&path);
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
