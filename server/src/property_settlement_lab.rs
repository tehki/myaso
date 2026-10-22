//! E2c: INERT in-memory reference for one-transaction property conveyance.
//! Not a database, a payment service, a wallet, a live deed, or crash durability.
//! No player network endpoint may instantiate VerifiedBuyer or a trusted Seed.

use std::collections::BTreeMap;

pub const MAX_FEE_BPS: u16 = 1_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum AccountId {
    Player(u64),
    Treasury,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Balance {
    pub units: u64,
    pub revision: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Title {
    pub parcel_id: u64,
    pub owner_id: u64,
    pub revision: u64,
    pub map_revision: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Listing {
    pub id: u64,
    pub parcel_id: u64,
    pub seller_id: u64,
    pub expected_title_revision: u64,
    pub expected_map_revision: u64,
    pub price: u64,
    pub fee_bps: u16,
    /// Reference to a previously verified and audited seller authorization.
    /// Merely being nonzero is NOT actual authorization or a signature.
    pub accepted_seller_consent_id: u128,
    pub expires_at_tick: u64,
    pub active: bool,
}

#[derive(Clone, Debug)]
pub struct Seed {
    pub accounts: Vec<(u64, u64)>,
    pub treasury: u64,
    pub titles: Vec<Title>,
    pub listings: Vec<Listing>,
    pub title_cap: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VerifiedBuyer {
    /// Must be resolved by a future trusted authentication/admission service.
    pub player_id: u64,
    pub session_epoch: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Intent {
    pub operation_id: u128,
    pub buyer_id: u64,
    pub listing_id: u64,
    pub expected_title_revision: u64,
    pub expected_buyer_balance_revision: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Posting {
    pub account: AccountId,
    pub delta: i128,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Receipt {
    pub sequence: u64,
    pub intent: Intent,
    pub verified: VerifiedBuyer,
    pub server_tick: u64,
    pub consent_id: u128,
    pub title_before: Title,
    pub title_after: Title,
    pub buyer_before: Balance,
    pub buyer_after: Balance,
    pub seller_before: Balance,
    pub seller_after: Balance,
    pub treasury_before: Balance,
    pub treasury_after: Balance,
    pub postings: [Posting; 3],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    BadSeed,
    UnknownAccount,
    UnknownListing,
    BadIdentity,
    Unauthorized,
    ReplayConflict,
    ListingUnavailable,
    Expired,
    StaleTitle,
    StaleBalance,
    IneligibleBuyer,
    NotEnoughCredits,
    Overflow,
    CorruptJournal,
}

/// Laboratory replay completeness expectations that must be obtained from
/// an INDEPENDENT trustworthy committed checkpoint in a future implementation.
/// Constructing these from the same untrusted/replayed journal proves nothing.
/// This carries no MAC/signature and does not authenticate a real database.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct JournalAnchor {
    pub expected_sequence: u64,
    pub expected_total_supply: u128,
    pub expected_player_accounts: usize,
    pub expected_owned_titles: usize,
    pub expected_active_listings: usize,
}

/// Reference aggregate simulates ONE writer via &mut self. In production:
/// serializable DB row locks + UNIQUE operation_id + atomic ledger/title/listing
/// journal commit are all mandatory. No independent service updates permitted.
#[derive(Debug)]
pub struct Lab {
    accounts: BTreeMap<u64, Balance>,
    treasury: Balance,
    titles: BTreeMap<u64, Title>,
    listings: BTreeMap<u64, Listing>,
    operation_receipts: BTreeMap<u128, Receipt>,
    journal: Vec<Receipt>,
    total_supply: u128,
    title_cap: u16,
    sequence: u64,
}

impl Lab {
    pub fn from_seed(seed: &Seed) -> Result<Self, Error> {
        if seed.title_cap == 0 {
            return Err(Error::BadSeed);
        }
        let mut accounts = BTreeMap::new();
        let mut total_supply = u128::from(seed.treasury);
        for &(id, credits) in &seed.accounts {
            if id == 0
                || accounts
                    .insert(
                        id,
                        Balance {
                            units: credits,
                            revision: 1,
                        },
                    )
                    .is_some()
            {
                return Err(Error::BadSeed);
            }
            total_supply = total_supply
                .checked_add(u128::from(credits))
                .ok_or(Error::Overflow)?;
        }
        let mut titles = BTreeMap::new();
        for &title in &seed.titles {
            if title.parcel_id == 0
                || title.owner_id == 0
                || title.revision == 0
                || title.map_revision == 0
                || !accounts.contains_key(&title.owner_id)
                || titles.insert(title.parcel_id, title).is_some()
            {
                return Err(Error::BadSeed);
            }
        }
        let mut listings = BTreeMap::new();
        for &listing in &seed.listings {
            if listing.id == 0
                || listing.price == 0
                || listing.accepted_seller_consent_id == 0
                || listing.expires_at_tick == 0
                || listing.fee_bps > MAX_FEE_BPS
            {
                return Err(Error::BadSeed);
            }
            let title = titles.get(&listing.parcel_id).ok_or(Error::BadSeed)?;
            if title.owner_id != listing.seller_id
                || title.revision != listing.expected_title_revision
                || title.map_revision != listing.expected_map_revision
                || listings.insert(listing.id, listing).is_some()
            {
                return Err(Error::BadSeed);
            }
        }
        Ok(Self {
            accounts,
            treasury: Balance {
                units: seed.treasury,
                revision: 1,
            },
            titles,
            listings,
            operation_receipts: BTreeMap::new(),
            journal: Vec::new(),
            total_supply,
            title_cap: seed.title_cap,
            sequence: 0,
        })
    }

    pub fn balance(&self, id: u64) -> Option<Balance> {
        self.accounts.get(&id).copied()
    }

    pub fn treasury(&self) -> Balance {
        self.treasury
    }

    pub fn title(&self, id: u64) -> Option<Title> {
        self.titles.get(&id).copied()
    }

    pub fn listing(&self, id: u64) -> Option<Listing> {
        self.listings.get(&id).copied()
    }

    pub fn journal(&self) -> &[Receipt] {
        &self.journal
    }

    pub fn conserved(&self) -> bool {
        self.accounts
            .values()
            .try_fold(u128::from(self.treasury.units), |sum, balance| {
                sum.checked_add(u128::from(balance.units))
            })
            == Some(self.total_supply)
    }

    /// PURELY in-memory consistency step. A successful call is NOT durable.
    pub fn purchase(
        &mut self,
        verified: VerifiedBuyer,
        intent: Intent,
        server_tick: u64,
    ) -> Result<Receipt, Error> {
        if verified.player_id == 0
            || verified.session_epoch == 0
            || intent.buyer_id == 0
            || intent.operation_id == 0
        {
            return Err(Error::BadIdentity);
        }
        // Authorization precedes the idempotent response, to prevent guessing
        // another buyer's operation ID and receiving their receipt.
        if verified.player_id != intent.buyer_id {
            return Err(Error::Unauthorized);
        }
        if let Some(receipt) = self.operation_receipts.get(&intent.operation_id) {
            return if receipt.intent == intent && receipt.verified == verified {
                Ok(*receipt)
            } else {
                Err(Error::ReplayConflict)
            };
        }

        let listing = *self
            .listings
            .get(&intent.listing_id)
            .ok_or(Error::UnknownListing)?;
        if !listing.active || listing.seller_id == intent.buyer_id {
            return Err(Error::ListingUnavailable);
        }
        if server_tick > listing.expires_at_tick {
            return Err(Error::Expired);
        }
        let title = *self.titles.get(&listing.parcel_id).ok_or(Error::BadSeed)?;
        if title.owner_id != listing.seller_id
            || title.revision != listing.expected_title_revision
            || title.revision != intent.expected_title_revision
            || title.map_revision != listing.expected_map_revision
        {
            return Err(Error::StaleTitle);
        }
        let buyer_before = *self
            .accounts
            .get(&intent.buyer_id)
            .ok_or(Error::UnknownAccount)?;
        let seller_before = *self
            .accounts
            .get(&listing.seller_id)
            .ok_or(Error::UnknownAccount)?;
        let treasury_before = self.treasury;
        if buyer_before.revision != intent.expected_buyer_balance_revision {
            return Err(Error::StaleBalance);
        }
        let owned_count = self
            .titles
            .values()
            .filter(|t| t.owner_id == intent.buyer_id)
            .count();
        if owned_count >= usize::from(self.title_cap) {
            return Err(Error::IneligibleBuyer);
        }
        if buyer_before.units < listing.price {
            return Err(Error::NotEnoughCredits);
        }
        // Stage ALL fallible calculations before modifying a single field.
        let fee = u64::try_from(u128::from(listing.price) * u128::from(listing.fee_bps) / 10_000)
            .map_err(|_| Error::Overflow)?;
        let seller_amount = listing.price.checked_sub(fee).ok_or(Error::Overflow)?;
        let buyer_after = Balance {
            units: buyer_before.units - listing.price,
            revision: buyer_before
                .revision
                .checked_add(1)
                .ok_or(Error::Overflow)?,
        };
        let seller_after = Balance {
            units: seller_before
                .units
                .checked_add(seller_amount)
                .ok_or(Error::Overflow)?,
            revision: seller_before
                .revision
                .checked_add(1)
                .ok_or(Error::Overflow)?,
        };
        let treasury_after = Balance {
            units: treasury_before
                .units
                .checked_add(fee)
                .ok_or(Error::Overflow)?,
            revision: treasury_before
                .revision
                .checked_add(1)
                .ok_or(Error::Overflow)?,
        };
        let title_after = Title {
            parcel_id: title.parcel_id,
            owner_id: intent.buyer_id,
            revision: title.revision.checked_add(1).ok_or(Error::Overflow)?,
            map_revision: title.map_revision,
        };
        let sequence = self.sequence.checked_add(1).ok_or(Error::Overflow)?;
        let postings = [
            Posting {
                account: AccountId::Player(intent.buyer_id),
                delta: -i128::from(listing.price),
            },
            Posting {
                account: AccountId::Player(listing.seller_id),
                delta: i128::from(seller_amount),
            },
            Posting {
                account: AccountId::Treasury,
                delta: i128::from(fee),
            },
        ];
        if postings.iter().map(|p| p.delta).sum::<i128>() != 0 {
            return Err(Error::Overflow);
        }
        let receipt = Receipt {
            sequence,
            intent,
            verified,
            server_tick,
            consent_id: listing.accepted_seller_consent_id,
            title_before: title,
            title_after,
            buyer_before,
            buyer_after,
            seller_before,
            seller_after,
            treasury_before,
            treasury_after,
            postings,
        };

        // The following writes cannot fail logically after validation; this is
        // NOT an ACID database commit or a failure-safe storage implementation.
        self.accounts.insert(intent.buyer_id, buyer_after);
        self.accounts.insert(listing.seller_id, seller_after);
        self.treasury = treasury_after;
        self.titles.insert(listing.parcel_id, title_after);
        if let Some(row) = self.listings.get_mut(&listing.id) {
            row.active = false;
        }
        self.operation_receipts.insert(intent.operation_id, receipt);
        self.journal.push(receipt);
        self.sequence = sequence;
        Ok(receipt)
    }

    /// A model checkpoint for testing. Production MUST read its expected
    /// values from an independent, integrity-protected committed checkpoint;
    /// a value produced from this object is not a trusted recovery anchor.
    pub fn journal_anchor(&self) -> JournalAnchor {
        JournalAnchor {
            expected_sequence: self.sequence,
            expected_total_supply: self.total_supply,
            expected_player_accounts: self.accounts.len(),
            expected_owned_titles: self.titles.len(),
            expected_active_listings: self.listings.values().filter(|l| l.active).count(),
        }
    }

    /// Adds expected committed-tail completeness to deterministic replay.
    /// This cannot verify a *self-declared* anchor or identify who altered a
    /// journal. Persistent DB transaction and authenticated checkpoint are
    /// still necessary; valid journal prefixes otherwise look consistent.
    pub fn reconstruct_with_anchor(
        seed: &Seed,
        journal: &[Receipt],
        trusted: JournalAnchor,
    ) -> Result<Self, Error> {
        let state = Self::reconstruct(seed, journal)?;
        if state.journal_anchor() != trusted {
            return Err(Error::CorruptJournal);
        }
        Ok(state)
    }

    /// Laboratory-only deterministic journal verification/reconstruction.
    /// Both the seed and journal must come from a future authenticated durable
    /// store. This DOES NOT read files, fsync, or prove tamper-resistant storage.
    pub fn reconstruct(seed: &Seed, journal: &[Receipt]) -> Result<Self, Error> {
        let mut state = Self::from_seed(seed)?;
        for expected in journal {
            if expected.sequence != state.sequence.checked_add(1).ok_or(Error::Overflow)? {
                return Err(Error::CorruptJournal);
            }
            let observed = state
                .purchase(expected.verified, expected.intent, expected.server_tick)
                .map_err(|_| Error::CorruptJournal)?;
            if observed != *expected {
                return Err(Error::CorruptJournal);
            }
        }
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed() -> Seed {
        Seed {
            accounts: vec![(10, 1500), (20, 200), (30, 600)],
            treasury: 100,
            titles: vec![Title {
                parcel_id: 42,
                owner_id: 20,
                revision: 1,
                map_revision: 7,
            }],
            listings: vec![Listing {
                id: 50,
                parcel_id: 42,
                seller_id: 20,
                expected_title_revision: 1,
                expected_map_revision: 7,
                price: 500,
                fee_bps: 200,
                accepted_seller_consent_id: 99,
                expires_at_tick: 100,
                active: true,
            }],
            title_cap: 2,
        }
    }

    fn auth(id: u64) -> VerifiedBuyer {
        VerifiedBuyer {
            player_id: id,
            session_epoch: 15,
        }
    }

    fn intent(id: u128, buyer: u64) -> Intent {
        Intent {
            operation_id: id,
            buyer_id: buyer,
            listing_id: 50,
            expected_title_revision: 1,
            expected_buyer_balance_revision: 1,
        }
    }

    #[test]
    fn one_purchase_moves_title_and_balances_together() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        let receipt = lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        assert_eq!(receipt.postings.iter().map(|x| x.delta).sum::<i128>(), 0);
        assert_eq!(lab.balance(10).unwrap().units, 1000);
        assert_eq!(lab.balance(20).unwrap().units, 690);
        assert_eq!(lab.treasury().units, 110);
        assert_eq!(lab.title(42).unwrap().owner_id, 10);
        assert_eq!(lab.title(42).unwrap().revision, 2);
        assert!(!lab.listing(50).unwrap().active);
        assert!(lab.conserved());
    }

    #[test]
    fn idempotent_duplicate_never_debits_twice() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        let first = lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        let second = lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        assert_eq!(first, second);
        assert_eq!(lab.balance(10).unwrap().units, 1000);
        assert_eq!(lab.journal().len(), 1);
    }

    #[test]
    fn conflicted_replay_and_impersonation_fail_before_receipt() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        let mut altered = intent(1, 10);
        altered.expected_title_revision = 2;
        assert_eq!(
            lab.purchase(auth(10), altered, 50),
            Err(Error::ReplayConflict)
        );
        assert_eq!(
            lab.purchase(auth(30), intent(1, 10), 50),
            Err(Error::Unauthorized)
        );
        assert_eq!(
            lab.purchase(auth(10), intent(1, 30), 50),
            Err(Error::Unauthorized)
        );
        assert_eq!(lab.journal().len(), 1);
    }

    #[test]
    fn two_buyers_race_but_only_one_gets_title() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        lab.purchase(auth(30), intent(1, 30), 50).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(2, 10), 50),
            Err(Error::ListingUnavailable)
        );
        assert_eq!(lab.title(42).unwrap().owner_id, 30);
        assert_eq!(lab.balance(10).unwrap().units, 1500);
        assert!(lab.conserved());
    }

    #[test]
    fn insufficient_funds_does_not_move_any_value_or_title() {
        let mut s = seed();
        s.accounts[0].1 = 499;
        let mut lab = Lab::from_seed(&s).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(1, 10), 50),
            Err(Error::NotEnoughCredits)
        );
        assert_eq!(lab.title(42).unwrap().owner_id, 20);
        assert_eq!(lab.balance(20).unwrap().units, 200);
        assert!(lab.listing(50).unwrap().active);
        assert!(lab.journal().is_empty());
        assert!(lab.conserved());
    }

    #[test]
    fn unauthenticated_or_invalid_id_must_not_commit() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        assert_eq!(
            lab.purchase(
                VerifiedBuyer {
                    player_id: 10,
                    session_epoch: 0
                },
                intent(1, 10),
                50
            ),
            Err(Error::BadIdentity)
        );
        let mut bad = intent(1, 10);
        bad.operation_id = 0;
        assert_eq!(lab.purchase(auth(10), bad, 50), Err(Error::BadIdentity));
        assert!(lab.journal().is_empty());
    }

    #[test]
    fn expired_revoked_or_self_listing_cannot_sell() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(1, 10), 101),
            Err(Error::Expired)
        );
        assert!(lab.journal().is_empty());
        let mut s = seed();
        s.listings[0].active = false;
        let mut lab = Lab::from_seed(&s).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(1, 10), 50),
            Err(Error::ListingUnavailable)
        );
        assert!(lab.journal().is_empty());
        let mut s = seed();
        s.accounts[0].1 = 2000;
        // Seller trying to buy their own still-valid listing.
        let mut lab = Lab::from_seed(&s).unwrap();
        assert_eq!(
            lab.purchase(auth(20), intent(2, 20), 50),
            Err(Error::ListingUnavailable)
        );
    }

    #[test]
    fn revision_and_holding_cap_checks_fail_closed() {
        let mut lab = Lab::from_seed(&seed()).unwrap();
        let mut i = intent(1, 10);
        i.expected_title_revision = 2;
        assert_eq!(lab.purchase(auth(10), i, 50), Err(Error::StaleTitle));
        i.expected_title_revision = 1;
        i.expected_buyer_balance_revision = 5;
        assert_eq!(lab.purchase(auth(10), i, 50), Err(Error::StaleBalance));
        let mut s = seed();
        s.title_cap = 1;
        s.titles.push(Title {
            parcel_id: 43,
            owner_id: 10,
            revision: 1,
            map_revision: 7,
        });
        let mut lab = Lab::from_seed(&s).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(1, 10), 50),
            Err(Error::IneligibleBuyer)
        );
        assert!(lab.conserved());
    }

    #[test]
    fn checked_overflow_prevents_torn_account_or_deed() {
        let mut s = seed();
        s.accounts[1].1 = u64::MAX;
        let mut lab = Lab::from_seed(&s).unwrap();
        assert_eq!(
            lab.purchase(auth(10), intent(1, 10), 50),
            Err(Error::Overflow)
        );
        assert!(lab.journal().is_empty());
        assert_eq!(lab.balance(10).unwrap().units, 1500);
        assert_eq!(lab.title(42).unwrap().owner_id, 20);
        assert!(lab.conserved());

        let mut s = seed();
        s.titles[0].revision = u64::MAX;
        s.listings[0].expected_title_revision = u64::MAX;
        let mut lab = Lab::from_seed(&s).unwrap();
        let mut i = intent(1, 10);
        i.expected_title_revision = u64::MAX;
        assert_eq!(lab.purchase(auth(10), i, 50), Err(Error::Overflow));
        assert_eq!(lab.title(42).unwrap().owner_id, 20);
    }

    #[test]
    fn journal_replay_recreates_exact_result() {
        let s = seed();
        let mut lab = Lab::from_seed(&s).unwrap();
        lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        let reconstructed = Lab::reconstruct(&s, lab.journal()).unwrap();
        assert_eq!(reconstructed.journal(), lab.journal());
        assert_eq!(reconstructed.title(42), lab.title(42));
        assert_eq!(reconstructed.balance(10), lab.balance(10));
        assert_eq!(reconstructed.treasury(), lab.treasury());
        assert!(reconstructed.conserved());
    }

    #[test]
    fn incomplete_or_forged_journal_receipts_are_rejected() {
        let s = seed();
        let mut lab = Lab::from_seed(&s).unwrap();
        let receipt = lab.purchase(auth(10), intent(1, 10), 50).unwrap();
        let mut altered = receipt;
        altered.seller_after.units += 1;
        assert!(matches!(
            Lab::reconstruct(&s, &[altered]),
            Err(Error::CorruptJournal)
        ));
        altered = receipt;
        altered.sequence = 2;
        assert!(matches!(
            Lab::reconstruct(&s, &[altered]),
            Err(Error::CorruptJournal)
        ));
        altered = receipt;
        altered.verified.player_id = 30;
        assert!(matches!(
            Lab::reconstruct(&s, &[altered]),
            Err(Error::CorruptJournal)
        ));
    }

    #[test]
    fn trusted_sequence_anchor_detects_valid_but_truncated_journal_tail() {
        let genesis = seed();
        let mut state = Lab::from_seed(&genesis).unwrap();
        // An empty journal is a perfectly valid standalone replay prefix.
        // But it must be rejected if an independently trusted checkpoint
        // asserts that transaction #1 was already committed.
        let first = state.purchase(auth(10), intent(1, 10), 50).unwrap();
        let committed = state.journal_anchor();
        assert_eq!(committed.expected_sequence, 1);
        assert_eq!(committed.expected_total_supply, 2400);
        assert_eq!(committed.expected_active_listings, 0);
        let empty_prefix = Lab::reconstruct(&genesis, &[]).unwrap();
        assert_eq!(empty_prefix.title(42).unwrap().owner_id, 20);
        assert!(matches!(
            Lab::reconstruct_with_anchor(&genesis, &[], committed),
            Err(Error::CorruptJournal)
        ));
        let restored = Lab::reconstruct_with_anchor(&genesis, &[first], committed).unwrap();
        assert_eq!(restored.journal_anchor(), committed);
        assert_eq!(restored.title(42).unwrap().owner_id, 10);
        assert!(restored.conserved());
    }

    #[test]
    fn stale_or_mismatched_trusted_anchor_is_not_silently_accepted() {
        let genesis = seed();
        let mut state = Lab::from_seed(&genesis).unwrap();
        let receipt = state.purchase(auth(10), intent(1, 10), 50).unwrap();
        let anchor = state.journal_anchor();

        let mut wrong = anchor;
        wrong.expected_sequence = 0;
        assert_eq!(
            Lab::reconstruct_with_anchor(&genesis, &[receipt], wrong).map(|s| s.journal_anchor()),
            Err(Error::CorruptJournal)
        );

        wrong = anchor;
        wrong.expected_total_supply += 1;
        assert!(matches!(
            Lab::reconstruct_with_anchor(&genesis, &[receipt], wrong),
            Err(Error::CorruptJournal)
        ));

        wrong = anchor;
        wrong.expected_active_listings = 1;
        assert!(matches!(
            Lab::reconstruct_with_anchor(&genesis, &[receipt], wrong),
            Err(Error::CorruptJournal)
        ));

        wrong = anchor;
        wrong.expected_owned_titles = 2;
        assert!(matches!(
            Lab::reconstruct_with_anchor(&genesis, &[receipt], wrong),
            Err(Error::CorruptJournal)
        ));
    }

    #[test]
    fn anchored_replay_does_not_count_duplicate_purchase_twice() {
        let genesis = seed();
        let mut state = Lab::from_seed(&genesis).unwrap();
        let first = state.purchase(auth(10), intent(1, 10), 50).unwrap();
        assert_eq!(state.purchase(auth(10), intent(1, 10), 50), Ok(first));
        let anchor = state.journal_anchor();
        assert_eq!(anchor.expected_sequence, 1);
        let replayed = Lab::reconstruct_with_anchor(&genesis, state.journal(), anchor).unwrap();
        assert_eq!(replayed.journal().len(), 1);
        assert_eq!(replayed.balance(10), state.balance(10));
        assert_eq!(replayed.treasury(), state.treasury());
    }

    #[test]
    fn malformed_initial_state_rejected_not_accepted_as_title() {
        let mut s = seed();
        s.titles[0].owner_id = 9999;
        assert!(matches!(Lab::from_seed(&s), Err(Error::BadSeed)));
        s = seed();
        s.listings[0].accepted_seller_consent_id = 0;
        assert!(matches!(Lab::from_seed(&s), Err(Error::BadSeed)));
        s = seed();
        s.accounts.push((10, 100));
        assert!(matches!(Lab::from_seed(&s), Err(Error::BadSeed)));
    }
}
