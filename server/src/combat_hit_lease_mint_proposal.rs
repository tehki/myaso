//! Core8A M147 nonrelease OS-entropy lease preparation.
//!
//! This is deliberately not a live HIT capability issuer. It has no access to
//! an authenticated QUIC connection, does not register proposed packet types
//! 5/6, and cannot send a HIT_CONTROL GRANT. Its input binding MUST be obtained
//! from the future server-authoritative admission owner, never client bytes.
//! The sole purpose is to prove fail-closed generation and incarnation scoping
//! of a proposed 128-bit delivery secret using the existing OS CSPRNG.
use crate::combat_hit_delivery_proposal::MAX_PER_RECIPIENT_PENDING;
use crate::prealpha_authenticated_gesture::ServerActorBinding;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreparedHitLeaseError {
    InvalidActorBinding,
    InvalidCapacity,
    EntropyUnavailable,
    ForeignActorIncarnation,
    Retired,
}

/// One unallocated, server-side, non-cloneable candidate lease.
/// Deliberately does not implement Debug: a secret must not enter logs.
pub struct PreparedHitLeaseUnallocated {
    binding: ServerActorBinding,
    secret: [u8; 16],
    max_pending: usize,
    retired: bool,
}

impl PreparedHitLeaseUnallocated {
    /// Prepare fresh OS-derived token material without enabling or issuing
    /// proposed reliable type 5/6. This method CANNOT authenticate its caller:
    /// the real trusted QUIC principal + boot/World/actor admission must be
    /// verified separately, under Core8B/8C ownership, before any activation.
    pub fn prepare_review_only(
        accepted_server_binding: ServerActorBinding,
        max_pending: usize,
    ) -> Result<Self, PreparedHitLeaseError> {
        if accepted_server_binding.player_id == 0
            || accepted_server_binding.boot_nonce == 0
            || accepted_server_binding.lease_epoch == 0
            || accepted_server_binding.world_instance == 0
            || accepted_server_binding.incarnation == 0
        {
            return Err(PreparedHitLeaseError::InvalidActorBinding);
        }
        if !(1..=MAX_PER_RECIPIENT_PENDING).contains(&max_pending) {
            return Err(PreparedHitLeaseError::InvalidCapacity);
        }

        let mut secret = [0_u8; 16];
        getrandom::fill(&mut secret).map_err(|_| PreparedHitLeaseError::EntropyUnavailable)?;
        if secret.iter().all(|byte| *byte == 0) {
            return Err(PreparedHitLeaseError::EntropyUnavailable);
        }
        Ok(Self {
            binding: accepted_server_binding,
            secret,
            max_pending,
            retired: false,
        })
    }

    /// Review-only proof of the exact server-owned incarnation check.
    /// The caller provides an UNTRUSTED assertion of scope; equality is NOT
    /// authentication of the live TLS/QUIC principal. Never call this directly
    /// on a client-supplied binding or serialize its return without Main0 GO.
    pub fn inspect_for_review_only(
        &self,
        asserted_binding: ServerActorBinding,
    ) -> Result<([u8; 16], usize), PreparedHitLeaseError> {
        if self.retired {
            return Err(PreparedHitLeaseError::Retired);
        }
        if asserted_binding != self.binding {
            return Err(PreparedHitLeaseError::ForeignActorIncarnation);
        }
        Ok((self.secret, self.max_pending))
    }

    /// A stale disconnect/rejoin must retire the entire candidate lease.
    pub fn retire(&mut self) {
        self.secret.fill(0);
        self.retired = true;
    }
}

impl Drop for PreparedHitLeaseUnallocated {
    fn drop(&mut self) {
        self.secret.fill(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn actor() -> ServerActorBinding {
        ServerActorBinding {
            player_id: 2,
            boot_nonce: 83,
            lease_epoch: 7,
            world_instance: 19,
            incarnation: 5,
        }
    }

    #[test]
    fn two_server_preparations_use_independent_nonzero_os_random_secrets() {
        let first = PreparedHitLeaseUnallocated::prepare_review_only(actor(), 64).unwrap();
        let second = PreparedHitLeaseUnallocated::prepare_review_only(actor(), 64).unwrap();
        let (first_token, first_cap) = first.inspect_for_review_only(actor()).unwrap();
        let (second_token, second_cap) = second.inspect_for_review_only(actor()).unwrap();
        assert_ne!(first_token, [0; 16]);
        assert_ne!(second_token, [0; 16]);
        assert_ne!(first_token, second_token);
        assert_eq!(first_cap, 64);
        assert_eq!(second_cap, 64);
    }

    #[test]
    fn invalid_actor_fields_and_pending_limits_fail_before_any_lease() {
        let base = actor();
        for bad in [
            ServerActorBinding {
                player_id: 0,
                ..base
            },
            ServerActorBinding {
                boot_nonce: 0,
                ..base
            },
            ServerActorBinding {
                lease_epoch: 0,
                ..base
            },
            ServerActorBinding {
                world_instance: 0,
                ..base
            },
            ServerActorBinding {
                incarnation: 0,
                ..base
            },
        ] {
            assert!(matches!(
                PreparedHitLeaseUnallocated::prepare_review_only(bad, 64),
                Err(PreparedHitLeaseError::InvalidActorBinding)
            ));
        }
        for cap in [0, MAX_PER_RECIPIENT_PENDING + 1, usize::MAX] {
            assert!(matches!(
                PreparedHitLeaseUnallocated::prepare_review_only(base, cap),
                Err(PreparedHitLeaseError::InvalidCapacity)
            ));
        }
    }

    #[test]
    fn old_connection_cannot_inspect_rejoin_restart_or_other_actor_lease() {
        let base = actor();
        let prepared = PreparedHitLeaseUnallocated::prepare_review_only(base, 16).unwrap();
        for foreign in [
            ServerActorBinding {
                player_id: 3,
                ..base
            },
            ServerActorBinding {
                boot_nonce: 84,
                ..base
            },
            ServerActorBinding {
                lease_epoch: 8,
                ..base
            },
            ServerActorBinding {
                world_instance: 20,
                ..base
            },
            ServerActorBinding {
                incarnation: 6,
                ..base
            },
        ] {
            assert_eq!(
                prepared.inspect_for_review_only(foreign),
                Err(PreparedHitLeaseError::ForeignActorIncarnation)
            );
        }
        assert_eq!(prepared.inspect_for_review_only(base).unwrap().1, 16);
    }

    #[test]
    fn retired_candidate_cannot_be_reused_even_with_original_binding() {
        let base = actor();
        let mut candidate = PreparedHitLeaseUnallocated::prepare_review_only(base, 64).unwrap();
        candidate.retire();
        assert_eq!(candidate.secret, [0; 16]);
        assert_eq!(
            candidate.inspect_for_review_only(base),
            Err(PreparedHitLeaseError::Retired)
        );
    }
}
