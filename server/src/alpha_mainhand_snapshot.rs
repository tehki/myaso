//! First Playable P0 read-only Core 8B MainHand state for future Graphics/8A.
//! This is *not* a live wire protocol, authenticated actor, sword-kind proof,
//! 8C worker epoch or alternative item writer. No caller can construct an
//! accepted snapshot by copying untrusted client-provided ownership fields.

use crate::{
    identity::CharacterId,
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::ItemId,
};

/// Stable within ONE exclusive journal history. A zero sequence is legitimate
/// for a brand-new empty ledger. Never compare across journal replacement,
/// game servers, 8C epochs, or a legacy MYWLD003 -> MYTX migration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CurrentMainHandSnapshot {
    character: CharacterId,
    journal_sequence: u64,
    item_id: Option<ItemId>,
    item_mutation_sequence: Option<u64>,
}

impl CurrentMainHandSnapshot {
    pub fn character(self) -> CharacterId {
        self.character
    }
    pub fn journal_sequence(self) -> u64 {
        self.journal_sequence
    }
    pub fn item_id(self) -> Option<ItemId> {
        self.item_id
    }
    pub fn item_mutation_sequence(self) -> Option<u64> {
        self.item_mutation_sequence
    }
}

/// Read an exclusive-writer journal's latest *actual* MainHand slot, including
/// authoritative EMPTY. The journal sequence advances with any committed
/// ownership batch (a safe but overbroad per-character rendering watermark).
///
/// The caller MUST first resolve a real authenticated session to `character`
/// and the same 8C world/worker epoch; nothing in this function checks either.
/// Do not expose this as an unguarded endpoint, use a browser-chosen character
/// ID, or publish an observer ACK before the fenced world+item commit/outbox.
pub fn read_current_mainhand(
    journal: &DurableItemJournal,
    character: CharacterId,
) -> Result<CurrentMainHandSnapshot, ItemJournalError> {
    let (journal_sequence, equipped) = journal.committed_mainhand_components(character)?;
    Ok(CurrentMainHandSnapshot {
        character,
        journal_sequence,
        item_id: equipped.map(|(id, _)| id),
        item_mutation_sequence: equipped.map(|(_, revision)| revision),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item_ownership::{
        ItemLocation, OwnershipOp, OwnershipTxnId, ZoneId,
    };
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            static NONCE: AtomicU64 = AtomicU64::new(0);
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-c3r-readonly-mainhand-{}-{stamp}-{}",
                std::process::id(),
                NONCE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn open(&self) -> DurableItemJournal {
            let deadline = Instant::now() + Duration::from_millis(500);
            loop {
                match DurableItemJournal::open(&self.0) {
                    Ok(journal) => return journal,
                    Err(ItemJournalError::WriterBusy) if Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    Err(e) => panic!("test writer reopen rejected: {e:?}"),
                }
            }
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn char_id(n: u128) -> CharacterId {
        CharacterId::new(n).unwrap()
    }
    fn sword(n: u128) -> ItemId {
        ItemId::new(n).unwrap()
    }
    fn txn(n: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(n).unwrap()
    }
    fn rack(n: i32) -> ItemLocation {
        ItemLocation::Ground {
            zone_id: ZoneId::new(1).unwrap(),
            x_cm: 371_000 + n * 35,
            y_cm: 385_000,
        }
    }
    fn hand(n: u128) -> ItemLocation {
        ItemLocation::Equipped {
            character_id: char_id(n),
            slot: 0,
        }
    }
    fn seed(j: &mut DurableItemJournal) {
        j.apply(
            txn(1),
            &[
                OwnershipOp::Create { item: sword(201), at: rack(0) },
                OwnershipOp::Create { item: sword(202), at: rack(1) },
                OwnershipOp::Create { item: sword(203), at: rack(2) },
                OwnershipOp::Create { item: sword(204), at: rack(3) },
            ],
        ).unwrap();
    }

    #[test]
    fn brand_new_empty_journal_gives_authenticated_empty_hand_projection() {
        let root = Root::new();
        let journal = root.open();
        let empty = read_current_mainhand(&journal, char_id(1)).unwrap();
        assert_eq!(empty.character(), char_id(1));
        assert_eq!(empty.journal_sequence(), 0);
        assert_eq!(empty.item_id(), None);
        assert_eq!(empty.item_mutation_sequence(), None);
    }

    #[test]
    fn four_swords_equip_drop_and_other_player_repick_are_revision_ordered() {
        let root = Root::new();
        let mut j = root.open();
        seed(&mut j);
        let empty1 = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(empty1.item_id(), None);
        assert_eq!(empty1.journal_sequence(), 1);
        let equip_receipt = j.apply(
            txn(2),
            &[OwnershipOp::Move { item: sword(201), from: rack(0), to: hand(1) }],
        ).unwrap();
        let equipped = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(equipped.journal_sequence(), equip_receipt.sequence);
        assert_eq!(equipped.item_mutation_sequence(), Some(equip_receipt.sequence));
        assert_eq!(equipped.item_id(), Some(sword(201)));

        let drop_receipt = j.apply(
            txn(3),
            &[OwnershipOp::Move { item: sword(201), from: hand(1), to: rack(4) }],
        ).unwrap();
        let empty_again = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(empty_again.item_id(), None);
        assert_eq!(empty_again.item_mutation_sequence(), None);
        assert!(empty_again.journal_sequence() > equipped.journal_sequence());
        assert_eq!(empty_again.journal_sequence(), drop_receipt.sequence);
        let second_receipt = j.apply(
            txn(4),
            &[OwnershipOp::Move { item: sword(201), from: rack(4), to: hand(2) }],
        ).unwrap();
        let new_owner = read_current_mainhand(&j, char_id(2)).unwrap();
        assert_eq!(new_owner.item_id(), Some(sword(201)));
        assert_eq!(new_owner.item_mutation_sequence(), Some(second_receipt.sequence));
        let former_owner = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(former_owner.item_id(), None);
        assert!(former_owner.journal_sequence() > empty_again.journal_sequence());
        assert!(new_owner.journal_sequence() > equipped.journal_sequence());
        assert_eq!(j.item_count(), 4);

        drop(j);
        let restarted = root.open();
        assert_eq!(read_current_mainhand(&restarted, char_id(1)).unwrap(), former_owner);
        assert_eq!(read_current_mainhand(&restarted, char_id(2)).unwrap(), new_owner);
    }

    #[test]
    fn aba_same_item_return_to_hand_uses_new_watermark_and_does_not_resurrect_old() {
        let root = Root::new();
        let mut j = root.open();
        seed(&mut j);
        j.apply(
            txn(2),
            &[OwnershipOp::Move { item: sword(201), from: rack(0), to: hand(1) }],
        ).unwrap();
        let first = read_current_mainhand(&j, char_id(1)).unwrap();
        j.apply(
            txn(3),
            &[OwnershipOp::Move { item: sword(201), from: hand(1), to: rack(0) }],
        ).unwrap();
        j.apply(
            txn(4),
            &[OwnershipOp::Move { item: sword(201), from: rack(0), to: hand(1) }],
        ).unwrap();
        let second = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(first.item_id(), second.item_id());
        assert!(second.journal_sequence() > first.journal_sequence());
        assert!(second.item_mutation_sequence().unwrap() > first.item_mutation_sequence().unwrap());
        // An unrelated item's commit advances the complete journal watermark,
        // not the 201-specific revision: conservative for renderer freshness.
        j.apply(
            txn(5),
            &[OwnershipOp::Move { item: sword(202), from: rack(1), to: hand(2) }],
        ).unwrap();
        let after_unrelated = read_current_mainhand(&j, char_id(1)).unwrap();
        assert_eq!(after_unrelated.item_mutation_sequence(), second.item_mutation_sequence());
        assert!(after_unrelated.journal_sequence() > second.journal_sequence());
    }
}
