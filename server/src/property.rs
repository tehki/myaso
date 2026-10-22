//! E2 staging-only land registry: authored parcels and inert deed records.
//! This is NOT a purchasable house, a persisted title, a currency transfer,
//! or an active network endpoint. A trusted admission service must supply Actor.

use std::collections::BTreeMap;

pub const MAX_AUTHORED_PARCELS: usize = 4096;
const MAX_COORD: i32 = 1_000_000;
const MAX_PARCEL_EDGE: i64 = 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
}

impl Rect {
    fn valid(self) -> bool {
        let width = i64::from(self.max_x) - i64::from(self.min_x);
        let height = i64::from(self.max_y) - i64::from(self.min_y);
        [self.min_x, self.min_y, self.max_x, self.max_y]
            .iter()
            .all(|v| i64::from(*v).abs() <= i64::from(MAX_COORD))
            && width > 0
            && height > 0
            && width <= MAX_PARCEL_EDGE
            && height <= MAX_PARCEL_EDGE
    }

    fn overlaps(self, other: Self) -> bool {
        self.min_x < other.max_x
            && other.min_x < self.max_x
            && self.min_y < other.max_y
            && other.min_y < self.max_y
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Use {
    Residence,
    Workshop,
    GuildHall,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Parcel {
    /// Only accepted from server-authored, revision-pinned world geometry.
    pub id: u64,
    pub zone_id: u32,
    pub map_revision: u64,
    pub bounds: Rect,
    pub use_kind: Use,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Deed {
    pub parcel_id: u64,
    pub owner: u64,
    pub title_version: u64,
    pub last_operation: u128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Actor {
    /// Trusted back-office registrar; cannot be constructed from client input.
    Registrar,
    /// Must be resolved from an authenticated durable character identity.
    Owner(u64),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// Records an authorized, *nonfinancial* initial grant. NOT a purchase.
    Grant { parcel_id: u64, owner: u64 },
    /// A voluntary, *unpaid* owner-authorized gift. No market sale is possible.
    Gift {
        parcel_id: u64,
        from: u64,
        to: u64,
        expected_title_version: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeedEvent {
    pub sequence: u64,
    pub operation_id: u128,
    pub actor: Actor,
    pub action: Action,
    pub prior_title: Option<Deed>,
    pub next_title: Deed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PropertyError {
    InvalidParcel,
    TooManyParcels,
    DuplicateParcel,
    OverlappingParcel,
    RevisionMismatch,
    InvalidIdentity,
    Unauthorized,
    UnknownParcel,
    AlreadyGranted,
    MissingTitle,
    WrongOwner,
    StaleTitle,
    ConflictingReplay,
    ArithmeticOverflow,
}

/// Catalog cannot be altered through untrusted runtime input.
///
/// Design-only in-memory mutation: no persistence, transactional settlement,
/// item storage, collision binding, network commands, or payment authority.
#[derive(Debug)]
pub struct StagedRegistry {
    parcels: BTreeMap<u64, Parcel>,
    deeds: BTreeMap<u64, Deed>,
    operations: BTreeMap<u128, DeedEvent>,
    events: Vec<DeedEvent>,
    sequence: u64,
}

impl StagedRegistry {
    pub fn from_authored_parcels(authored: &[Parcel]) -> Result<Self, PropertyError> {
        if authored.len() > MAX_AUTHORED_PARCELS {
            return Err(PropertyError::TooManyParcels);
        }
        let mut parcels = BTreeMap::new();
        let mut zone_revisions = BTreeMap::<u32, u64>::new();
        for parcel in authored {
            if parcel.id == 0
                || parcel.zone_id == 0
                || parcel.map_revision == 0
                || !parcel.bounds.valid()
            {
                return Err(PropertyError::InvalidParcel);
            }
            match zone_revisions.insert(parcel.zone_id, parcel.map_revision) {
                Some(previous) if previous != parcel.map_revision => {
                    return Err(PropertyError::RevisionMismatch)
                }
                _ => {}
            }
            if parcels.contains_key(&parcel.id) {
                return Err(PropertyError::DuplicateParcel);
            }
            if parcels.values().any(|other: &Parcel| {
                other.zone_id == parcel.zone_id && other.bounds.overlaps(parcel.bounds)
            }) {
                return Err(PropertyError::OverlappingParcel);
            }
            parcels.insert(parcel.id, *parcel);
        }
        Ok(Self {
            parcels,
            deeds: BTreeMap::new(),
            operations: BTreeMap::new(),
            events: Vec::new(),
            sequence: 0,
        })
    }

    pub fn parcel(&self, parcel_id: u64) -> Option<Parcel> {
        self.parcels.get(&parcel_id).copied()
    }

    pub fn deed(&self, parcel_id: u64) -> Option<Deed> {
        self.deeds.get(&parcel_id).copied()
    }

    pub fn events(&self) -> &[DeedEvent] {
        &self.events
    }

    /// Authorization is checked BEFORE idempotent replay to avoid receipt leaks.
    /// This API cannot establish external payment or enforce signed consent:
    /// both require later integration with durable admission + economy service.
    pub fn apply(
        &mut self,
        actor: Actor,
        operation_id: u128,
        action: Action,
    ) -> Result<DeedEvent, PropertyError> {
        match action {
            Action::Grant { owner, .. } => {
                if actor != Actor::Registrar {
                    return Err(PropertyError::Unauthorized);
                }
                if owner == 0 {
                    return Err(PropertyError::InvalidIdentity);
                }
            }
            Action::Gift { from, to, .. } => {
                if actor != Actor::Owner(from) {
                    return Err(PropertyError::Unauthorized);
                }
                if from == 0 || to == 0 || from == to {
                    return Err(PropertyError::InvalidIdentity);
                }
            }
        }
        if operation_id == 0 {
            return Err(PropertyError::InvalidIdentity);
        }
        if let Some(receipt) = self.operations.get(&operation_id) {
            return if receipt.actor == actor && receipt.action == action {
                Ok(*receipt)
            } else {
                Err(PropertyError::ConflictingReplay)
            };
        }

        let (prior_title, next_title) = match action {
            Action::Grant { parcel_id, owner } => {
                if !self.parcels.contains_key(&parcel_id) {
                    return Err(PropertyError::UnknownParcel);
                }
                if self.deeds.contains_key(&parcel_id) {
                    return Err(PropertyError::AlreadyGranted);
                }
                (
                    None,
                    Deed {
                        parcel_id,
                        owner,
                        title_version: 1,
                        last_operation: operation_id,
                    },
                )
            }
            Action::Gift {
                parcel_id,
                from,
                to,
                expected_title_version,
            } => {
                if !self.parcels.contains_key(&parcel_id) {
                    return Err(PropertyError::UnknownParcel);
                }
                let current = *self
                    .deeds
                    .get(&parcel_id)
                    .ok_or(PropertyError::MissingTitle)?;
                if current.owner != from {
                    return Err(PropertyError::WrongOwner);
                }
                if expected_title_version != current.title_version {
                    return Err(PropertyError::StaleTitle);
                }
                (
                    Some(current),
                    Deed {
                        parcel_id,
                        owner: to,
                        title_version: current
                            .title_version
                            .checked_add(1)
                            .ok_or(PropertyError::ArithmeticOverflow)?,
                        last_operation: operation_id,
                    },
                )
            }
        };

        let sequence = self
            .sequence
            .checked_add(1)
            .ok_or(PropertyError::ArithmeticOverflow)?;
        let event = DeedEvent {
            sequence,
            operation_id,
            actor,
            action,
            prior_title,
            next_title,
        };
        // Only commit after every validation. No disk durability or
        // cross-service atomicity is provided (and no game code calls this).
        self.deeds.insert(next_title.parcel_id, next_title);
        self.operations.insert(operation_id, event);
        self.events.push(event);
        self.sequence = sequence;
        Ok(event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parcel(id: u64, zone_id: u32, min_x: i32, max_x: i32) -> Parcel {
        Parcel {
            id,
            zone_id,
            map_revision: 7,
            bounds: Rect {
                min_x,
                min_y: 10,
                max_x,
                max_y: 30,
            },
            use_kind: Use::Residence,
        }
    }

    fn example() -> StagedRegistry {
        StagedRegistry::from_authored_parcels(&[
            parcel(1, 1, 10, 20),
            parcel(2, 1, 20, 30),
            parcel(3, 2, 10, 20),
        ])
        .unwrap()
    }

    #[test]
    fn authenticated_registrar_can_issue_exact_known_parcel_once() {
        let mut r = example();
        let first = r
            .apply(
                Actor::Registrar,
                10,
                Action::Grant {
                    parcel_id: 1,
                    owner: 42,
                },
            )
            .unwrap();
        assert_eq!(first.next_title.owner, 42);
        assert_eq!(r.deed(1).unwrap().title_version, 1);
        assert_eq!(r.apply(Actor::Registrar, 10, first.action), Ok(first));
        assert_eq!(r.events().len(), 1);
        assert_eq!(
            r.apply(
                Actor::Registrar,
                11,
                Action::Grant {
                    parcel_id: 1,
                    owner: 99
                }
            ),
            Err(PropertyError::AlreadyGranted)
        );
        assert!(r.deed(2).is_none());
    }

    #[test]
    fn rejects_unauthorized_grant_and_unauthenticated_gift() {
        let mut r = example();
        assert_eq!(
            r.apply(
                Actor::Owner(42),
                1,
                Action::Grant {
                    parcel_id: 1,
                    owner: 42
                }
            ),
            Err(PropertyError::Unauthorized)
        );
        r.apply(
            Actor::Registrar,
            2,
            Action::Grant {
                parcel_id: 1,
                owner: 42,
            },
        )
        .unwrap();
        assert_eq!(
            r.apply(
                Actor::Owner(55),
                3,
                Action::Gift {
                    parcel_id: 1,
                    from: 42,
                    to: 55,
                    expected_title_version: 1,
                }
            ),
            Err(PropertyError::Unauthorized)
        );
        assert_eq!(r.deed(1).unwrap().owner, 42);
    }

    #[test]
    fn voluntary_gift_is_versioned_and_idempotent() {
        let mut r = example();
        r.apply(
            Actor::Registrar,
            1,
            Action::Grant {
                parcel_id: 1,
                owner: 42,
            },
        )
        .unwrap();
        let gift = Action::Gift {
            parcel_id: 1,
            from: 42,
            to: 77,
            expected_title_version: 1,
        };
        let receipt = r.apply(Actor::Owner(42), 2, gift).unwrap();
        assert_eq!(r.apply(Actor::Owner(42), 2, gift), Ok(receipt));
        assert_eq!(r.deed(1).unwrap().owner, 77);
        assert_eq!(r.deed(1).unwrap().title_version, 2);
        assert_eq!(r.events().len(), 2);
        assert_eq!(
            r.apply(Actor::Owner(42), 3, gift),
            Err(PropertyError::WrongOwner)
        );
        assert_eq!(
            r.apply(
                Actor::Owner(77),
                4,
                Action::Gift {
                    parcel_id: 1,
                    from: 77,
                    to: 99,
                    expected_title_version: 1
                }
            ),
            Err(PropertyError::StaleTitle)
        );
    }

    #[test]
    fn idempotency_key_cannot_be_reused_to_change_title() {
        let mut r = example();
        r.apply(
            Actor::Registrar,
            7,
            Action::Grant {
                parcel_id: 1,
                owner: 42,
            },
        )
        .unwrap();
        assert_eq!(
            r.apply(
                Actor::Registrar,
                7,
                Action::Grant {
                    parcel_id: 2,
                    owner: 42
                }
            ),
            Err(PropertyError::ConflictingReplay)
        );
        assert!(r.deed(2).is_none());
        assert_eq!(
            r.apply(
                Actor::Owner(44),
                7,
                Action::Gift {
                    parcel_id: 1,
                    from: 44,
                    to: 42,
                    expected_title_version: 1,
                }
            ),
            Err(PropertyError::ConflictingReplay)
        );
    }

    #[test]
    fn catalog_rejects_overlap_and_accepts_touching_edges_and_other_zones() {
        assert!(example().parcel(3).is_some());
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[parcel(1, 1, 10, 20), parcel(2, 1, 19, 25)]),
            Err(PropertyError::OverlappingParcel)
        ));
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[parcel(1, 1, 10, 20), parcel(1, 2, 10, 20)]),
            Err(PropertyError::DuplicateParcel)
        ));
    }

    #[test]
    fn rejects_mixed_zone_revisions_and_impossible_bounds() {
        let mut mismatched = parcel(2, 1, 20, 30);
        mismatched.map_revision = 8;
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[parcel(1, 1, 10, 20), mismatched]),
            Err(PropertyError::RevisionMismatch)
        ));
        let mut invalid = parcel(1, 1, 10, 20);
        invalid.bounds.max_x = 10;
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[invalid]),
            Err(PropertyError::InvalidParcel)
        ));
        invalid.bounds.max_x = i32::MIN;
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[invalid]),
            Err(PropertyError::InvalidParcel)
        ));
        invalid.bounds = Rect {
            min_x: -1_000_000,
            max_x: 1_000_000,
            min_y: 0,
            max_y: 1,
        };
        assert!(matches!(
            StagedRegistry::from_authored_parcels(&[invalid]),
            Err(PropertyError::InvalidParcel)
        ));
    }

    #[test]
    fn rejects_unknown_parcels_zero_ids_and_gift_to_self() {
        let mut r = example();
        assert_eq!(
            r.apply(
                Actor::Registrar,
                1,
                Action::Grant {
                    parcel_id: 500,
                    owner: 42
                }
            ),
            Err(PropertyError::UnknownParcel)
        );
        assert_eq!(
            r.apply(
                Actor::Registrar,
                1,
                Action::Grant {
                    parcel_id: 1,
                    owner: 0
                }
            ),
            Err(PropertyError::InvalidIdentity)
        );
        assert_eq!(
            r.apply(
                Actor::Registrar,
                0,
                Action::Grant {
                    parcel_id: 1,
                    owner: 42
                }
            ),
            Err(PropertyError::InvalidIdentity)
        );
        r.apply(
            Actor::Registrar,
            1,
            Action::Grant {
                parcel_id: 1,
                owner: 42,
            },
        )
        .unwrap();
        assert_eq!(
            r.apply(
                Actor::Owner(42),
                2,
                Action::Gift {
                    parcel_id: 1,
                    from: 42,
                    to: 42,
                    expected_title_version: 1,
                }
            ),
            Err(PropertyError::InvalidIdentity)
        );
        assert_eq!(r.events().len(), 1);
    }

    #[test]
    fn missing_title_cannot_be_transferred() {
        let mut r = example();
        assert_eq!(
            r.apply(
                Actor::Owner(42),
                1,
                Action::Gift {
                    parcel_id: 1,
                    from: 42,
                    to: 77,
                    expected_title_version: 1,
                }
            ),
            Err(PropertyError::MissingTitle)
        );
        assert!(r.events().is_empty());
    }
}
