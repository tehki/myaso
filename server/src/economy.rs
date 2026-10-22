//! E1 laboratory ledger. No runtime, network, wallet, or cryptocurrency integration.
//! All currency units are nonredeemable SANDBOX CREDITS. Never deposit real value here.
//! A future authenticated admission service must map a verified session to Actor::Player.

use std::collections::BTreeMap;

/// Server-internal accounts only. These are not blockchain addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Account {
    Player(u64),
    Treasury,
    Escrow(u64),
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Actor {
    /// Must come from a trusted server admission service, never from client input.
    Player(u64),
    /// Trusted backend administration; not exposed as a protocol command.
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    Transfer {
        from: u64,
        to: u64,
        amount: u64,
    },
    ServiceFee {
        player: u64,
        amount: u64,
    },
    OpenEscrow {
        id: u64,
        buyer: u64,
        seller: u64,
        amount: u64,
    },
    SettleEscrow {
        id: u64,
        fee: u64,
    },
    RefundEscrow {
        id: u64,
    },
    /// Sandbox retirement, not an on-chain token burn.
    RetireTreasury {
        amount: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    Open,
    Settled,
    Refunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Escrow {
    pub id: u64,
    pub buyer: u64,
    pub seller: u64,
    pub amount: u64,
    pub status: EscrowStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Posting {
    pub account: Account,
    /// Signed sandbox-credit units. Negative = debit; positive = credit.
    pub delta: i128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalEntry {
    pub sequence: u64,
    pub operation_id: u128,
    pub command: Command,
    pub postings: Vec<Posting>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LedgerError {
    InvalidIdentity,
    InvalidAmount,
    Unauthorized,
    UnknownPlayer,
    InsufficientFunds,
    EscrowAlreadyExists,
    EscrowNotOpen,
    ReplayedOperationConflict,
    ArithmeticOverflow,
}

/// Non-persistent, bounded-scope reference implementation.
/// No live session, disk persistence, payment, token, or game-tick connection.
#[derive(Debug)]
pub struct SandboxLedger {
    balances: BTreeMap<Account, u64>,
    holds: BTreeMap<u64, Escrow>,
    operations: BTreeMap<u128, JournalEntry>,
    journal: Vec<JournalEntry>,
    issued_units: u128,
    sequence: u64,
}

enum HoldChange {
    None,
    Create(Escrow),
    Finalize(u64, EscrowStatus),
}

impl SandboxLedger {
    /// Lab-only genesis, explicitly not a reward/mint endpoint.
    /// Rejects duplicate IDs and arithmetic overflow.
    pub fn sandbox_bootstrap(players: &[(u64, u64)], treasury: u64) -> Result<Self, LedgerError> {
        let mut balances = BTreeMap::new();
        let mut issued_units = u128::from(treasury);
        balances.insert(Account::Treasury, treasury);
        balances.insert(Account::Retired, 0);
        for &(id, units) in players {
            if id == 0 {
                return Err(LedgerError::InvalidIdentity);
            }
            if balances.insert(Account::Player(id), units).is_some() {
                return Err(LedgerError::InvalidIdentity);
            }
            issued_units = issued_units
                .checked_add(u128::from(units))
                .ok_or(LedgerError::ArithmeticOverflow)?;
        }
        Ok(Self {
            balances,
            holds: BTreeMap::new(),
            operations: BTreeMap::new(),
            journal: Vec::new(),
            issued_units,
            sequence: 0,
        })
    }

    pub fn balance(&self, account: Account) -> Option<u64> {
        self.balances.get(&account).copied()
    }

    pub fn escrow(&self, id: u64) -> Option<Escrow> {
        self.holds.get(&id).copied()
    }

    pub fn issued_units(&self) -> u128 {
        self.issued_units
    }

    pub fn journal(&self) -> &[JournalEntry] {
        &self.journal
    }

    /// Authorize before idempotency lookup: an unauthorized caller must not
    /// read/acknowledge an existing operation simply by guessing its ID.
    pub fn execute(
        &mut self,
        actor: Actor,
        operation_id: u128,
        command: Command,
    ) -> Result<JournalEntry, LedgerError> {
        self.authorize(actor, command)?;
        if operation_id == 0 {
            return Err(LedgerError::InvalidIdentity);
        }
        if let Some(previous) = self.operations.get(&operation_id) {
            return if previous.command == command {
                Ok(previous.clone())
            } else {
                Err(LedgerError::ReplayedOperationConflict)
            };
        }

        let (postings, hold_change) = match command {
            Command::Transfer { from, to, amount } => {
                self.ensure_players(&[from, to])?;
                if from == to || amount == 0 {
                    return Err(LedgerError::InvalidAmount);
                }
                (
                    vec![
                        Posting {
                            account: Account::Player(from),
                            delta: -i128::from(amount),
                        },
                        Posting {
                            account: Account::Player(to),
                            delta: i128::from(amount),
                        },
                    ],
                    HoldChange::None,
                )
            }
            Command::ServiceFee { player, amount } => {
                self.ensure_players(&[player])?;
                if amount == 0 {
                    return Err(LedgerError::InvalidAmount);
                }
                (
                    vec![
                        Posting {
                            account: Account::Player(player),
                            delta: -i128::from(amount),
                        },
                        Posting {
                            account: Account::Treasury,
                            delta: i128::from(amount),
                        },
                    ],
                    HoldChange::None,
                )
            }
            Command::OpenEscrow {
                id,
                buyer,
                seller,
                amount,
            } => {
                self.ensure_players(&[buyer, seller])?;
                if id == 0 || buyer == seller || amount == 0 {
                    return Err(LedgerError::InvalidAmount);
                }
                if self.holds.contains_key(&id) {
                    return Err(LedgerError::EscrowAlreadyExists);
                }
                (
                    vec![
                        Posting {
                            account: Account::Player(buyer),
                            delta: -i128::from(amount),
                        },
                        Posting {
                            account: Account::Escrow(id),
                            delta: i128::from(amount),
                        },
                    ],
                    HoldChange::Create(Escrow {
                        id,
                        buyer,
                        seller,
                        amount,
                        status: EscrowStatus::Open,
                    }),
                )
            }
            Command::SettleEscrow { id, fee } => {
                let hold = self.open_hold(id)?;
                if fee >= hold.amount {
                    return Err(LedgerError::InvalidAmount);
                }
                let mut postings = vec![
                    Posting {
                        account: Account::Escrow(id),
                        delta: -i128::from(hold.amount),
                    },
                    Posting {
                        account: Account::Player(hold.seller),
                        delta: i128::from(hold.amount - fee),
                    },
                ];
                if fee != 0 {
                    postings.push(Posting {
                        account: Account::Treasury,
                        delta: i128::from(fee),
                    });
                }
                (postings, HoldChange::Finalize(id, EscrowStatus::Settled))
            }
            Command::RefundEscrow { id } => {
                let hold = self.open_hold(id)?;
                (
                    vec![
                        Posting {
                            account: Account::Escrow(id),
                            delta: -i128::from(hold.amount),
                        },
                        Posting {
                            account: Account::Player(hold.buyer),
                            delta: i128::from(hold.amount),
                        },
                    ],
                    HoldChange::Finalize(id, EscrowStatus::Refunded),
                )
            }
            Command::RetireTreasury { amount } => {
                if amount == 0 {
                    return Err(LedgerError::InvalidAmount);
                }
                (
                    vec![
                        Posting {
                            account: Account::Treasury,
                            delta: -i128::from(amount),
                        },
                        Posting {
                            account: Account::Retired,
                            delta: i128::from(amount),
                        },
                    ],
                    HoldChange::None,
                )
            }
        };

        // Validate every touched account and journal sequence before any mutation.
        let updated = self.stage_postings(&postings)?;
        let next_sequence = self
            .sequence
            .checked_add(1)
            .ok_or(LedgerError::ArithmeticOverflow)?;
        let receipt = JournalEntry {
            sequence: next_sequence,
            operation_id,
            command,
            postings,
        };

        // In-memory atomic state transition. Durability/transactional recovery is
        // explicitly NOT provided by this module and is a prerequisite for activation.
        for (account, balance) in updated {
            self.balances.insert(account, balance);
        }
        match hold_change {
            HoldChange::None => {}
            HoldChange::Create(hold) => {
                self.holds.insert(hold.id, hold);
            }
            HoldChange::Finalize(id, status) => {
                if let Some(hold) = self.holds.get_mut(&id) {
                    hold.status = status;
                }
            }
        }
        self.sequence = next_sequence;
        self.operations.insert(operation_id, receipt.clone());
        self.journal.push(receipt.clone());
        Ok(receipt)
    }

    fn authorize(&self, actor: Actor, command: Command) -> Result<(), LedgerError> {
        let permitted = match command {
            Command::Transfer { from, .. } => actor == Actor::Player(from),
            Command::ServiceFee { player, .. } => actor == Actor::Player(player),
            Command::OpenEscrow { buyer, .. } => actor == Actor::Player(buyer),
            Command::SettleEscrow { .. }
            | Command::RefundEscrow { .. }
            | Command::RetireTreasury { .. } => actor == Actor::System,
        };
        if permitted {
            Ok(())
        } else {
            Err(LedgerError::Unauthorized)
        }
    }

    fn ensure_players(&self, players: &[u64]) -> Result<(), LedgerError> {
        for &id in players {
            if id == 0 {
                return Err(LedgerError::InvalidIdentity);
            }
            if !self.balances.contains_key(&Account::Player(id)) {
                return Err(LedgerError::UnknownPlayer);
            }
        }
        Ok(())
    }

    fn open_hold(&self, id: u64) -> Result<Escrow, LedgerError> {
        match self.holds.get(&id) {
            Some(hold) if hold.status == EscrowStatus::Open => Ok(*hold),
            _ => Err(LedgerError::EscrowNotOpen),
        }
    }

    fn stage_postings(&self, postings: &[Posting]) -> Result<BTreeMap<Account, u64>, LedgerError> {
        let mut net = BTreeMap::<Account, i128>::new();
        let mut sum = 0_i128;
        for posting in postings {
            let total = net.entry(posting.account).or_insert(0);
            *total = total
                .checked_add(posting.delta)
                .ok_or(LedgerError::ArithmeticOverflow)?;
            sum = sum
                .checked_add(posting.delta)
                .ok_or(LedgerError::ArithmeticOverflow)?;
        }
        if sum != 0 {
            return Err(LedgerError::ArithmeticOverflow);
        }
        let mut staged = BTreeMap::new();
        for (account, delta) in net {
            let before = i128::from(self.balances.get(&account).copied().unwrap_or(0));
            let after = before
                .checked_add(delta)
                .ok_or(LedgerError::ArithmeticOverflow)?;
            if after < 0 {
                return Err(LedgerError::InsufficientFunds);
            }
            let after = u64::try_from(after).map_err(|_| LedgerError::ArithmeticOverflow)?;
            staged.insert(account, after);
        }
        Ok(staged)
    }

    /// Fast correctness check for lab tests; not called on the 60 Hz gameplay loop.
    pub fn check_conservation(&self) -> bool {
        self.balances.values().try_fold(0_u128, |total, &balance| {
            total.checked_add(u128::from(balance))
        }) == Some(self.issued_units)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ledger() -> SandboxLedger {
        SandboxLedger::sandbox_bootstrap(&[(1, 100), (2, 20)], 30).unwrap()
    }

    #[test]
    fn transfer_is_double_entry_and_conserves_issuance() {
        let mut l = ledger();
        let entry = l
            .execute(
                Actor::Player(1),
                1,
                Command::Transfer {
                    from: 1,
                    to: 2,
                    amount: 40,
                },
            )
            .unwrap();
        assert_eq!(entry.postings.iter().map(|p| p.delta).sum::<i128>(), 0);
        assert_eq!(l.balance(Account::Player(1)), Some(60));
        assert_eq!(l.balance(Account::Player(2)), Some(60));
        assert_eq!(l.issued_units(), 150);
        assert!(l.check_conservation());
    }

    #[test]
    fn denies_impersonation_and_replay_id_leak() {
        let mut l = ledger();
        let cmd = Command::Transfer {
            from: 1,
            to: 2,
            amount: 3,
        };
        assert_eq!(
            l.execute(Actor::Player(2), 10, cmd),
            Err(LedgerError::Unauthorized)
        );
        l.execute(Actor::Player(1), 10, cmd).unwrap();
        assert_eq!(
            l.execute(Actor::Player(2), 10, cmd),
            Err(LedgerError::Unauthorized)
        );
        assert_eq!(l.journal().len(), 1);
    }

    #[test]
    fn overdraft_and_rejected_operations_change_nothing() {
        let mut l = ledger();
        assert_eq!(
            l.execute(
                Actor::Player(1),
                2,
                Command::Transfer {
                    from: 1,
                    to: 2,
                    amount: 101
                }
            ),
            Err(LedgerError::InsufficientFunds)
        );
        assert_eq!(l.balance(Account::Player(1)), Some(100));
        assert_eq!(l.journal().len(), 0);
        assert!(l.check_conservation());
    }

    #[test]
    fn idempotent_retry_not_double_charged_and_conflict_rejected() {
        let mut l = ledger();
        let cmd = Command::ServiceFee {
            player: 1,
            amount: 7,
        };
        let first = l.execute(Actor::Player(1), 9, cmd).unwrap();
        assert_eq!(l.execute(Actor::Player(1), 9, cmd), Ok(first));
        assert_eq!(l.balance(Account::Player(1)), Some(93));
        assert_eq!(l.balance(Account::Treasury), Some(37));
        assert_eq!(l.journal().len(), 1);
        assert_eq!(
            l.execute(
                Actor::Player(1),
                9,
                Command::ServiceFee {
                    player: 1,
                    amount: 8
                }
            ),
            Err(LedgerError::ReplayedOperationConflict)
        );
    }

    #[test]
    fn escrow_settlement_pays_seller_and_collects_fee_once() {
        let mut l = ledger();
        l.execute(
            Actor::Player(1),
            1,
            Command::OpenEscrow {
                id: 15,
                buyer: 1,
                seller: 2,
                amount: 25,
            },
        )
        .unwrap();
        assert_eq!(l.balance(Account::Escrow(15)), Some(25));
        l.execute(Actor::System, 2, Command::SettleEscrow { id: 15, fee: 2 })
            .unwrap();
        assert_eq!(l.balance(Account::Escrow(15)), Some(0));
        assert_eq!(l.balance(Account::Player(2)), Some(43));
        assert_eq!(l.balance(Account::Treasury), Some(32));
        assert_eq!(l.escrow(15).unwrap().status, EscrowStatus::Settled);
        assert_eq!(
            l.execute(Actor::System, 3, Command::RefundEscrow { id: 15 }),
            Err(LedgerError::EscrowNotOpen)
        );
        assert!(l.check_conservation());
    }

    #[test]
    fn escrow_refund_returns_to_original_buyer() {
        let mut l = ledger();
        l.execute(
            Actor::Player(1),
            1,
            Command::OpenEscrow {
                id: 15,
                buyer: 1,
                seller: 2,
                amount: 25,
            },
        )
        .unwrap();
        l.execute(Actor::System, 2, Command::RefundEscrow { id: 15 })
            .unwrap();
        assert_eq!(l.balance(Account::Player(1)), Some(100));
        assert_eq!(l.balance(Account::Escrow(15)), Some(0));
        assert_eq!(
            l.execute(Actor::System, 3, Command::SettleEscrow { id: 15, fee: 1 }),
            Err(LedgerError::EscrowNotOpen)
        );
        assert!(l.check_conservation());
    }

    #[test]
    fn zero_duplicate_unknown_and_overflow_are_rejected() {
        assert!(matches!(
            SandboxLedger::sandbox_bootstrap(&[(1, 3), (1, 4)], 0),
            Err(LedgerError::InvalidIdentity)
        ));
        let mut l = ledger();
        assert_eq!(
            l.execute(
                Actor::Player(1),
                1,
                Command::Transfer {
                    from: 1,
                    to: 3,
                    amount: 1
                }
            ),
            Err(LedgerError::UnknownPlayer)
        );
        assert_eq!(
            l.execute(
                Actor::Player(1),
                1,
                Command::ServiceFee {
                    player: 1,
                    amount: 0
                }
            ),
            Err(LedgerError::InvalidAmount)
        );
        assert_eq!(
            l.execute(
                Actor::Player(1),
                0,
                Command::ServiceFee {
                    player: 1,
                    amount: 1
                }
            ),
            Err(LedgerError::InvalidIdentity)
        );
        let mut big = SandboxLedger::sandbox_bootstrap(&[(1, u64::MAX), (2, 1)], 0).unwrap();
        assert_eq!(
            big.execute(
                Actor::Player(2),
                1,
                Command::Transfer {
                    from: 2,
                    to: 1,
                    amount: 1
                }
            ),
            Err(LedgerError::ArithmeticOverflow)
        );
        assert!(big.check_conservation());
    }

    #[test]
    fn sandbox_retirement_is_accounted_not_secret_money_deletion() {
        let mut l = ledger();
        l.execute(Actor::System, 1, Command::RetireTreasury { amount: 10 })
            .unwrap();
        assert_eq!(l.balance(Account::Treasury), Some(20));
        assert_eq!(l.balance(Account::Retired), Some(10));
        assert_eq!(l.issued_units(), 150);
        assert!(l.check_conservation());
        assert_eq!(
            l.execute(Actor::Player(1), 2, Command::RetireTreasury { amount: 1 }),
            Err(LedgerError::Unauthorized)
        );
    }

    #[test]
    fn escrow_duplicate_and_fee_overrun_leave_state_unchanged() {
        let mut l = ledger();
        let create = Command::OpenEscrow {
            id: 8,
            buyer: 1,
            seller: 2,
            amount: 9,
        };
        l.execute(Actor::Player(1), 1, create).unwrap();
        assert_eq!(
            l.execute(Actor::Player(1), 2, create),
            Err(LedgerError::EscrowAlreadyExists)
        );
        assert_eq!(
            l.execute(Actor::System, 3, Command::SettleEscrow { id: 8, fee: 9 }),
            Err(LedgerError::InvalidAmount)
        );
        assert_eq!(l.balance(Account::Escrow(8)), Some(9));
        assert_eq!(l.journal().len(), 1);
        assert!(l.check_conservation());
    }
}
