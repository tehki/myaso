//! Dormant C1 handshake/session invariants for future reliable zone transfer.
//! No current WebTransport handler constructs or calls this type.
//! IMPORTANT: mutation here must eventually be committed atomically alongside
//! the authoritative ZoneWorlds move and replication-history invalidation.

use crate::door_wire::{encode_zone_entered, DoorRequest, ZoneEntered};
use crate::zone::{PortalId, ZoneId, ZoneTransfer, MAP_MANIFEST_VERSION};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoneSessionError {
    InvalidFighter,
    InvalidEpoch,
    Replay,
    WrongPortal,
    InvalidTransfer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ZoneSession {
    fighter_id: u32,
    zone_id: ZoneId,
    epoch: u32,
    last_request_nonce: Option<u32>,
}

impl ZoneSession {
    /// Created by server admission after authenticating a connection. Neither
    /// identity, zone nor epoch may come from a client door request.
    pub fn new(fighter_id: u32) -> Result<Self, ZoneSessionError> {
        if fighter_id == 0 {
            return Err(ZoneSessionError::InvalidFighter);
        }
        Ok(Self {
            fighter_id,
            zone_id: ZoneId::Moonvale,
            epoch: 1,
            last_request_nonce: None,
        })
    }

    pub const fn zone_id(&self) -> ZoneId {
        self.zone_id
    }

    pub const fn zone_epoch(&self) -> u32 {
        self.epoch
    }

    pub const fn fighter_id(&self) -> u32 {
        self.fighter_id
    }

    /// Strict preflight *before* authoritative portal proximity/combat checks.
    /// A valid header is never sufficient to authorize a transfer.
    pub fn validate_request(&self, request: DoorRequest) -> Result<(), ZoneSessionError> {
        if request.expected_epoch != self.epoch {
            return Err(ZoneSessionError::InvalidEpoch);
        }
        if self.last_request_nonce.is_some_and(|last| {
            let distance = request.request_nonce.wrapping_sub(last);
            distance == 0 || distance >= 0x8000_0000
        }) {
            return Err(ZoneSessionError::Replay);
        }
        match (self.zone_id, request.portal_id) {
            (ZoneId::Moonvale, PortalId::RedLionEnter)
            | (ZoneId::RedLionInn, PortalId::RedLionExit) => Ok(()),
            _ => Err(ZoneSessionError::WrongPortal),
        }
    }

    /// Invoked only after successful, server-authorized ZoneWorlds migration.
    /// Performs ALL validation before mutating the in-memory session.
    /// C2 must implement one transaction around both session and world commits.
    /// Accepting here alone is *not* a production-safe transfer.
    pub fn accept_authoritative_transfer(
        &mut self,
        request: DoorRequest,
        transfer: ZoneTransfer,
    ) -> Result<ZoneEntered, ZoneSessionError> {
        self.validate_request(request)?;
        let target = match request.portal_id {
            PortalId::RedLionEnter => ZoneId::RedLionInn,
            PortalId::RedLionExit => ZoneId::Moonvale,
        };
        if transfer.fighter != self.fighter_id
            || transfer.from != self.zone_id
            || transfer.to != target
            || transfer.request_nonce != request.request_nonce
            || transfer.manifest_version != MAP_MANIFEST_VERSION
        {
            return Err(ZoneSessionError::InvalidTransfer);
        }
        // Never emit epoch 0, even when a long-running session wraps u32.
        let next_epoch = self.epoch.wrapping_add(1).max(1);
        let ack = ZoneEntered {
            zone_id: transfer.to,
            request_nonce: request.request_nonce,
            fighter_id: self.fighter_id,
            server_tick: transfer.accepted_tick,
            spawn: transfer.arrival,
            zone_epoch: next_epoch,
        };
        // Validate exact wire-safe spawn before state mutation.
        encode_zone_entered(ack).map_err(|_| ZoneSessionError::InvalidTransfer)?;
        self.zone_id = transfer.to;
        self.epoch = next_epoch;
        self.last_request_nonce = Some(request.request_nonce);
        Ok(ack)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::zone::Position;

    fn enter(nonce: u32, epoch: u32) -> DoorRequest {
        DoorRequest {
            portal_id: PortalId::RedLionEnter,
            request_nonce: nonce,
            expected_epoch: epoch,
        }
    }

    fn transfer(id: u32, nonce: u32) -> ZoneTransfer {
        ZoneTransfer {
            fighter: id,
            from: ZoneId::Moonvale,
            to: ZoneId::RedLionInn,
            arrival: Position { x: 390.0, y: 480.0 },
            accepted_tick: 850,
            request_nonce: nonce,
            manifest_version: MAP_MANIFEST_VERSION,
        }
    }

    #[test]
    fn authenticated_only_and_current_epoch_required() {
        assert_eq!(ZoneSession::new(0), Err(ZoneSessionError::InvalidFighter));
        let session = ZoneSession::new(11).unwrap();
        assert_eq!(session.zone_id(), ZoneId::Moonvale);
        assert_eq!(session.zone_epoch(), 1);
        assert_eq!(session.fighter_id(), 11);
        assert_eq!(
            session.validate_request(enter(1, 0)),
            Err(ZoneSessionError::InvalidEpoch)
        );
        assert_eq!(
            session.validate_request(DoorRequest {
                portal_id: PortalId::RedLionExit,
                request_nonce: 1,
                expected_epoch: 1,
            }),
            Err(ZoneSessionError::WrongPortal)
        );
        assert_eq!(session.validate_request(enter(1, 1)), Ok(()));
    }

    #[test]
    fn accepted_server_transfer_advances_epoch_and_fails_stale_replays() {
        let mut session = ZoneSession::new(11).unwrap();
        let accepted = session
            .accept_authoritative_transfer(enter(5, 1), transfer(11, 5))
            .unwrap();
        assert_eq!(accepted.zone_id, ZoneId::RedLionInn);
        assert_eq!((accepted.spawn.x, accepted.spawn.y), (390.0, 480.0));
        assert_eq!(accepted.zone_epoch, 2);
        assert_eq!(accepted.fighter_id, 11);
        assert_eq!(session.zone_epoch(), 2);
        assert_eq!(
            session.validate_request(enter(6, 1)),
            Err(ZoneSessionError::InvalidEpoch)
        );
        let exit = DoorRequest {
            portal_id: PortalId::RedLionExit,
            request_nonce: 6,
            expected_epoch: 2,
        };
        assert_eq!(session.validate_request(exit), Ok(()));
        let return_transfer = ZoneTransfer {
            fighter: 11,
            from: ZoneId::RedLionInn,
            to: ZoneId::Moonvale,
            arrival: Position {
                x: 4365.0,
                y: 4143.0,
            },
            accepted_tick: 1000,
            request_nonce: 6,
            manifest_version: MAP_MANIFEST_VERSION,
        };
        let back = session
            .accept_authoritative_transfer(exit, return_transfer)
            .unwrap();
        assert_eq!(back.zone_id, ZoneId::Moonvale);
        assert_eq!(back.zone_epoch, 3);
        assert_eq!(
            session.validate_request(enter(6, 3)),
            Err(ZoneSessionError::Replay)
        );
        assert_eq!(
            session.validate_request(enter(5, 3)),
            Err(ZoneSessionError::Replay)
        );
        assert_eq!(session.validate_request(enter(7, 3)), Ok(()));
    }

    #[test]
    fn forged_or_unsafe_transfer_does_not_mutate_state_or_burn_nonce() {
        let mut session = ZoneSession::new(11).unwrap();
        for invalid in [
            ZoneTransfer {
                fighter: 12,
                ..transfer(11, 5)
            },
            ZoneTransfer {
                request_nonce: 6,
                ..transfer(11, 5)
            },
            ZoneTransfer {
                from: ZoneId::RedLionInn,
                ..transfer(11, 5)
            },
            ZoneTransfer {
                to: ZoneId::Moonvale,
                ..transfer(11, 5)
            },
            ZoneTransfer {
                manifest_version: 10,
                ..transfer(11, 5)
            },
            ZoneTransfer {
                arrival: Position {
                    x: f32::NAN,
                    y: 480.0,
                },
                ..transfer(11, 5)
            },
        ] {
            assert_eq!(
                session.accept_authoritative_transfer(enter(5, 1), invalid),
                Err(ZoneSessionError::InvalidTransfer)
            );
            assert_eq!(session.zone_epoch(), 1);
            assert_eq!(session.zone_id(), ZoneId::Moonvale);
            assert_eq!(session.validate_request(enter(5, 1)), Ok(()));
        }
    }

    #[test]
    fn wrapped_nonce_forward_progress_and_epoch_never_zero() {
        let mut session = ZoneSession::new(11).unwrap();
        session.epoch = u32::MAX;
        let accepted = session
            .accept_authoritative_transfer(
                enter(u32::MAX - 1, u32::MAX),
                transfer(11, u32::MAX - 1),
            )
            .unwrap();
        assert_eq!(accepted.zone_epoch, 1);
        let forward = DoorRequest {
            portal_id: PortalId::RedLionExit,
            request_nonce: 1,
            expected_epoch: 1,
        };
        assert_eq!(session.validate_request(forward), Ok(()));
        assert_eq!(
            session.validate_request(DoorRequest {
                request_nonce: u32::MAX - 2,
                ..forward
            }),
            Err(ZoneSessionError::Replay)
        );
    }
}
