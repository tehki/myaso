//! E2b inert purchase planner: validates *trusted snapshots* and returns a
//! proposed all-or-nothing accounting/deed instruction. It NEVER posts credits,
//! moves titles, verifies a signature, talks to a database, or holds real value.
//!
//! Do not use this directly with client-supplied Listing, Admission, or Snapshot.
//! A future durable transaction coordinator must load/verify them under ONE
//! serializable transaction, enforce replay uniqueness, and commit atomically.

pub const MAX_LISTING_FEE_BPS: u16 = 1_000; // 10% ceiling; not a chosen live tax

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Account {
    Player(u64),
    Treasury,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Posting {
    pub account: Account,
    pub delta: i128,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Admission {
    /// Server-resolved durable actor, not a value the browser may choose.
    pub verified_buyer: u64,
    pub session_epoch: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Intent {
    pub operation_id: u128,
    pub buyer: u64,
    pub listing_id: u128,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Listing {
    /// Must have been accepted by the trusted marketplace after verifying
    /// a voluntary seller authorization and be read from its own durable store.
    pub listing_id: u128,
    pub seller_consent_id: u128,
    pub parcel_id: u64,
    pub seller: u64,
    pub title_version: u64,
    pub map_revision: u64,
    pub price_units: u64,
    pub fee_bps: u16,
    pub fee_schedule_revision: u64,
    pub expires_at_tick: u64,
    pub is_active: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DeedSnapshot {
    pub parcel_id: u64,
    pub owner: u64,
    pub title_version: u64,
    pub map_revision: u64,
    pub transferable: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct BalanceSnapshot {
    pub account: Account,
    pub available_units: u64,
    pub account_revision: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct BuyerLandPolicy {
    pub current_titles: u16,
    pub maximum_titles: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TrustedSnapshots {
    pub admission: Admission,
    pub intent: Intent,
    pub listing: Listing,
    pub deed: DeedSnapshot,
    pub buyer: BalanceSnapshot,
    pub seller: BalanceSnapshot,
    pub treasury: BalanceSnapshot,
    pub land_policy: BuyerLandPolicy,
    /// Server-authored logical time; never the player's computer clock.
    pub current_tick: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanError {
    MissingIdentity,
    UnauthorizedBuyer,
    InvalidListing,
    ListingExpired,
    ListingMismatch,
    StaleDeed,
    NotTransferable,
    InvalidBalanceSnapshot,
    HoldingCapReached,
    InsufficientFunds,
    ArithmeticOverflow,
}

/// Immutable expected-state / resulting-state preconditions; coordinator
/// must atomically compare-and-swap all of them with idempotency and listing
/// consumption. A successful plan alone grants NO title or currency.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PurchasePlan {
    pub operation_id: u128,
    pub listing_id: u128,
    pub seller_consent_id: u128,
    pub parcel_id: u64,
    pub from_owner: u64,
    pub to_owner: u64,
    pub expected_title_version: u64,
    pub new_title_version: u64,
    pub expected_map_revision: u64,
    pub expected_fee_schedule_revision: u64,
    pub buyer_balance_revision: u64,
    pub seller_balance_revision: u64,
    pub treasury_balance_revision: u64,
    pub price_units: u64,
    pub fee_units: u64,
    pub expected_buyer_balance: u64,
    pub expected_seller_balance: u64,
    pub expected_treasury_balance: u64,
    pub resulting_buyer_balance: u64,
    pub resulting_seller_balance: u64,
    pub resulting_treasury_balance: u64,
    pub postings: [Posting; 3],
}

pub fn plan_purchase(snapshot: TrustedSnapshots) -> Result<PurchasePlan, PlanError> {
    let TrustedSnapshots {
        admission,
        intent,
        listing,
        deed,
        buyer,
        seller,
        treasury,
        land_policy,
        current_tick,
    } = snapshot;

    if admission.verified_buyer == 0
        || admission.session_epoch == 0
        || intent.operation_id == 0
        || intent.buyer == 0
    {
        return Err(PlanError::MissingIdentity);
    }
    if admission.verified_buyer != intent.buyer {
        return Err(PlanError::UnauthorizedBuyer);
    }

    if listing.listing_id == 0
        || listing.seller_consent_id == 0
        || listing.parcel_id == 0
        || listing.seller == 0
        || listing.seller == intent.buyer
        || listing.title_version == 0
        || listing.map_revision == 0
        || listing.fee_schedule_revision == 0
        || listing.price_units == 0
        || listing.fee_bps > MAX_LISTING_FEE_BPS
        || !listing.is_active
    {
        return Err(PlanError::InvalidListing);
    }
    if listing.listing_id != intent.listing_id {
        return Err(PlanError::ListingMismatch);
    }
    if current_tick > listing.expires_at_tick {
        return Err(PlanError::ListingExpired);
    }
    if deed.parcel_id != listing.parcel_id
        || deed.owner != listing.seller
        || deed.title_version != listing.title_version
        || deed.map_revision != listing.map_revision
    {
        return Err(PlanError::StaleDeed);
    }
    if !deed.transferable {
        return Err(PlanError::NotTransferable);
    }
    if buyer.account != Account::Player(intent.buyer)
        || seller.account != Account::Player(listing.seller)
        || treasury.account != Account::Treasury
        || buyer.account_revision == 0
        || seller.account_revision == 0
        || treasury.account_revision == 0
    {
        return Err(PlanError::InvalidBalanceSnapshot);
    }
    if land_policy.maximum_titles == 0 || land_policy.current_titles >= land_policy.maximum_titles {
        return Err(PlanError::HoldingCapReached);
    }
    if buyer.available_units < listing.price_units {
        return Err(PlanError::InsufficientFunds);
    }

    let fee =
        u64::try_from((u128::from(listing.price_units) * u128::from(listing.fee_bps)) / 10_000)
            .map_err(|_| PlanError::ArithmeticOverflow)?;
    let proceeds = listing.price_units - fee;
    let resulting_buyer = buyer.available_units - listing.price_units;
    let resulting_seller = seller
        .available_units
        .checked_add(proceeds)
        .ok_or(PlanError::ArithmeticOverflow)?;
    let resulting_treasury = treasury
        .available_units
        .checked_add(fee)
        .ok_or(PlanError::ArithmeticOverflow)?;
    let next_title = deed
        .title_version
        .checked_add(1)
        .ok_or(PlanError::ArithmeticOverflow)?;
    let postings = [
        Posting {
            account: buyer.account,
            delta: -i128::from(listing.price_units),
        },
        Posting {
            account: seller.account,
            delta: i128::from(proceeds),
        },
        Posting {
            account: Account::Treasury,
            delta: i128::from(fee),
        },
    ];
    // Total credit supply is conserved: a fee is a treasury transfer, not a burn.
    debug_assert_eq!(postings.iter().map(|p| p.delta).sum::<i128>(), 0);

    Ok(PurchasePlan {
        operation_id: intent.operation_id,
        listing_id: listing.listing_id,
        seller_consent_id: listing.seller_consent_id,
        parcel_id: listing.parcel_id,
        from_owner: listing.seller,
        to_owner: intent.buyer,
        expected_title_version: deed.title_version,
        new_title_version: next_title,
        expected_map_revision: deed.map_revision,
        expected_fee_schedule_revision: listing.fee_schedule_revision,
        buyer_balance_revision: buyer.account_revision,
        seller_balance_revision: seller.account_revision,
        treasury_balance_revision: treasury.account_revision,
        price_units: listing.price_units,
        fee_units: fee,
        expected_buyer_balance: buyer.available_units,
        expected_seller_balance: seller.available_units,
        expected_treasury_balance: treasury.available_units,
        resulting_buyer_balance: resulting_buyer,
        resulting_seller_balance: resulting_seller,
        resulting_treasury_balance: resulting_treasury,
        postings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> TrustedSnapshots {
        TrustedSnapshots {
            admission: Admission {
                verified_buyer: 21,
                session_epoch: 5,
            },
            intent: Intent {
                operation_id: 1000,
                buyer: 21,
                listing_id: 555,
            },
            listing: Listing {
                listing_id: 555,
                seller_consent_id: 999,
                parcel_id: 42,
                seller: 13,
                title_version: 8,
                map_revision: 17,
                price_units: 1_000,
                fee_bps: 200,
                fee_schedule_revision: 3,
                expires_at_tick: 300,
                is_active: true,
            },
            deed: DeedSnapshot {
                parcel_id: 42,
                owner: 13,
                title_version: 8,
                map_revision: 17,
                transferable: true,
            },
            buyer: BalanceSnapshot {
                account: Account::Player(21),
                available_units: 2_000,
                account_revision: 4,
            },
            seller: BalanceSnapshot {
                account: Account::Player(13),
                available_units: 600,
                account_revision: 9,
            },
            treasury: BalanceSnapshot {
                account: Account::Treasury,
                available_units: 200,
                account_revision: 12,
            },
            land_policy: BuyerLandPolicy {
                current_titles: 1,
                maximum_titles: 2,
            },
            current_tick: 100,
        }
    }

    #[test]
    fn proposed_sale_conserves_supply_and_changes_title_once() {
        let s = fixture();
        let p = plan_purchase(s).unwrap();
        assert_eq!(p.new_title_version, 9);
        assert_eq!((p.from_owner, p.to_owner), (13, 21));
        assert_eq!(p.fee_units, 20);
        assert_eq!(p.resulting_buyer_balance, 1_000);
        assert_eq!(p.resulting_seller_balance, 1_580);
        assert_eq!(p.resulting_treasury_balance, 220);
        assert_eq!(p.postings.iter().map(|e| e.delta).sum::<i128>(), 0);
        assert_eq!(p.postings[0].delta, -1000);
        assert_eq!(p.postings[1].delta, 980);
        assert_eq!(p.postings[2].delta, 20);
        assert_eq!(
            p.expected_buyer_balance as u128
                + p.expected_seller_balance as u128
                + p.expected_treasury_balance as u128,
            p.resulting_buyer_balance as u128
                + p.resulting_seller_balance as u128
                + p.resulting_treasury_balance as u128
        );
        // Planning is pure and cannot debit or transfer anything.
        assert_eq!(s.buyer.available_units, 2_000);
        assert_eq!(s.deed.owner, 13);
    }

    #[test]
    fn denies_impersonated_buyer_and_untrusted_session() {
        let mut s = fixture();
        s.admission.verified_buyer = 22;
        assert_eq!(plan_purchase(s), Err(PlanError::UnauthorizedBuyer));
        s.admission.verified_buyer = 21;
        s.admission.session_epoch = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::MissingIdentity));
    }

    #[test]
    fn rejects_stale_or_nontransferable_deed() {
        let mut s = fixture();
        s.deed.title_version = 7;
        assert_eq!(plan_purchase(s), Err(PlanError::StaleDeed));
        s.deed.title_version = 8;
        s.deed.transferable = false;
        assert_eq!(plan_purchase(s), Err(PlanError::NotTransferable));
        s.deed.transferable = true;
        s.deed.map_revision = 99;
        assert_eq!(plan_purchase(s), Err(PlanError::StaleDeed));
    }

    #[test]
    fn rejects_listing_mismatch_expiry_and_revocation() {
        let mut s = fixture();
        s.intent.listing_id = 12;
        assert_eq!(plan_purchase(s), Err(PlanError::ListingMismatch));
        s.intent.listing_id = 555;
        s.current_tick = 301;
        assert_eq!(plan_purchase(s), Err(PlanError::ListingExpired));
        s.current_tick = 100;
        s.listing.is_active = false;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
        s.listing.is_active = true;
        s.listing.seller_consent_id = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
    }

    #[test]
    fn rejects_overdraft_and_account_substitution() {
        let mut s = fixture();
        s.buyer.available_units = 999;
        assert_eq!(plan_purchase(s), Err(PlanError::InsufficientFunds));
        s.buyer.available_units = 2000;
        s.buyer.account = Account::Player(13);
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidBalanceSnapshot));
        s.buyer.account = Account::Player(21);
        s.seller.account_revision = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidBalanceSnapshot));
    }

    #[test]
    fn rejects_hoarding_cap_and_zero_price() {
        let mut s = fixture();
        s.land_policy.current_titles = 2;
        assert_eq!(plan_purchase(s), Err(PlanError::HoldingCapReached));
        s.land_policy.current_titles = 1;
        s.listing.price_units = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
    }

    #[test]
    fn checks_fee_bounds_and_exact_rounding() {
        let mut s = fixture();
        s.listing.fee_bps = 1001;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
        s.listing.fee_bps = 333;
        s.listing.price_units = 101;
        let p = plan_purchase(s).unwrap();
        assert_eq!(p.fee_units, 3);
        assert_eq!(p.postings[1].delta, 98);
        assert_eq!(p.postings.iter().map(|e| e.delta).sum::<i128>(), 0);
    }

    #[test]
    fn handles_numeric_maxima_without_overflow_or_partial_commit() {
        let mut s = fixture();
        s.seller.available_units = u64::MAX;
        assert_eq!(plan_purchase(s), Err(PlanError::ArithmeticOverflow));
        s.seller.available_units = 600;
        s.deed.title_version = u64::MAX;
        s.listing.title_version = u64::MAX;
        assert_eq!(plan_purchase(s), Err(PlanError::ArithmeticOverflow));
        s.deed.title_version = 8;
        s.listing.title_version = 8;
        s.treasury.available_units = u64::MAX;
        assert_eq!(plan_purchase(s), Err(PlanError::ArithmeticOverflow));
    }

    #[test]
    fn rejects_self_sales_and_operation_id_reuse_placeholder() {
        let mut s = fixture();
        s.listing.seller = 21;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
        s.listing.seller = 13;
        s.intent.operation_id = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::MissingIdentity));
    }

    #[test]
    fn does_not_produce_plan_without_trusted_price_policy_revision() {
        let mut s = fixture();
        s.listing.fee_schedule_revision = 0;
        assert_eq!(plan_purchase(s), Err(PlanError::InvalidListing));
    }

    #[test]
    fn upper_bound_price_and_zero_fee_are_exact() {
        let mut s = fixture();
        s.listing.price_units = u64::MAX;
        s.listing.fee_bps = 0;
        s.buyer.available_units = u64::MAX;
        s.seller.available_units = 0;
        s.treasury.available_units = 0;
        let p = plan_purchase(s).unwrap();
        assert_eq!(p.resulting_buyer_balance, 0);
        assert_eq!(p.resulting_seller_balance, u64::MAX);
        assert_eq!(p.fee_units, 0);
        assert_eq!(p.postings.iter().map(|e| e.delta).sum::<i128>(), 0);
    }
}
