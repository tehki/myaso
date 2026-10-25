//! COMPILED PRIVATE LOOPBACK ENGINEERING ONLY. Public packet allocation and
//! production HIT activation remain HOLD. Uses one original World and writer;
//! server-assigned QUIC leases are not authenticated player accounts.
use anyhow::{anyhow, bail, Result};
use myaso_server::{
    combat_hit_control_proposal::{
        decode_hit_control, encode_hit_control, HitControl, HitControlOp,
    },
    combat_hit_delivery_proposal::{
        project_world_tick_for_recipients, ActorIncarnation, DeliveryError,
        ProposedRecipientHitDelivery,
    },
    combat_hit_lease_mint_proposal::PreparedHitLeaseUnallocated,
    combat_hit_receipt::encode_hit_receipt,
    combat_hit_world_commit_proposal::ProposedWorldHitOrigin,
    simulation::{CombatEvent, World},
};
use std::{collections::BTreeMap, sync::Arc, time::Instant};
use wtransport::{Connection, VarInt};

pub const WRITE_TIMEOUT_MS: u64 = 1500;

#[derive(Clone, Copy)]
pub enum WrittenKind {
    Grant,
    Receipt(u32),
    Replay(u32),
    Terminal,
}

pub struct Outgoing {
    pub bytes: Vec<u8>,
    pub kind: WrittenKind,
}

// ReliablePayload implements Debug; its nested grant MUST redact capability bytes.
impl std::fmt::Debug for Outgoing {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PrivateHitOutgoing")
            .field("bytes", &"[REDACTED]")
            .finish()
    }
}

struct Session {
    connection: Arc<Connection>,
    binding: ActorIncarnation,
    scope_index: usize,
    token: [u8; 16],
    hello: bool,
    grant_written: bool,
    terminal: Option<HitControlOp>,
    replay_request: Option<u32>,
    unacknowledged_since: Option<Instant>,
}

impl Drop for Session {
    fn drop(&mut self) {
        self.token.fill(0);
    }
}

pub struct PrivateHitLab {
    origin: ProposedWorldHitOrigin,
    scopes: Vec<ProposedRecipientHitDelivery>,
    sessions: BTreeMap<u64, Session>,
}

impl PrivateHitLab {
    pub fn new(world: &World, boot: u128) -> Result<Self> {
        Ok(Self {
            origin: ProposedWorldHitOrigin::new(world, boot)
                .map_err(|e| anyhow!("private HIT origin: {e:?}"))?,
            scopes: Vec::new(),
            sessions: BTreeMap::new(),
        })
    }

    // Called only by the existing accepted QUIC connection's v2 admission,
    // with server-allocated actor/lease values under the original World lock.
    pub fn admit(
        &mut self,
        world: &World,
        player: u32,
        epoch: u64,
        connection: Arc<Connection>,
    ) -> Result<()> {
        if self.sessions.len() >= 512 || self.sessions.contains_key(&epoch) {
            bail!("private HIT capacity or reused lease");
        }
        let binding = self
            .origin
            .bind_admitted(world, player, epoch)
            .map_err(|e| anyhow!("private HIT admission: {e:?}"))?;
        let prepared = (|| {
            let candidate = PreparedHitLeaseUnallocated::prepare_review_only(binding, 64)
                .map_err(|e| anyhow!("private HIT entropy: {e:?}"))?;
            let (token, cap) = candidate
                .inspect_for_review_only(binding)
                .map_err(|e| anyhow!("private HIT scope: {e:?}"))?;
            let scope = ProposedRecipientHitDelivery::new(binding, token, cap)
                .map_err(|e| anyhow!("private HIT queue: {e:?}"))?;
            Ok::<_, anyhow::Error>((token, scope))
        })();
        let (token, scope) = match prepared {
            Ok(value) => value,
            Err(error) => {
                let _ = self.origin.retire_exact(binding);
                return Err(error);
            }
        };
        self.scopes.push(scope);
        self.sessions.insert(
            epoch,
            Session {
                connection,
                binding,
                scope_index: self.scopes.len() - 1,
                token,
                hello: false,
                grant_written: false,
                terminal: None,
                replay_request: None,
                unacknowledged_since: None,
            },
        );
        Ok(())
    }

    fn scope_index(&self, epoch: u64) -> Result<usize> {
        Ok(self
            .sessions
            .get(&epoch)
            .ok_or_else(|| anyhow!("private HIT unadmitted lease"))?
            .scope_index)
    }

    fn current(&self, world: &World, epoch: u64) -> Result<()> {
        let s = self
            .sessions
            .get(&epoch)
            .ok_or_else(|| anyhow!("private HIT missing admitted lease"))?;
        let f = world
            .fighter(s.binding.player_id)
            .ok_or_else(|| anyhow!("private HIT departed actor"))?;
        // Final lethal HIT may be presented only on its original incarnation.
        // Respawn/rebind cannot consume that old receipt or grant.
        if world.world_instance() != s.binding.world_instance
            || f.world_incarnation() != s.binding.incarnation
        {
            bail!("private HIT stale incarnation");
        }
        Ok(())
    }

    pub fn control(&mut self, world: &World, epoch: u64, bytes: &[u8]) -> Result<()> {
        self.current(world, epoch)?;
        let value =
            decode_hit_control(bytes).map_err(|e| anyhow!("private HIT control parse: {e:?}"))?;
        let s = self.sessions.get_mut(&epoch).unwrap();
        if s.terminal.is_some() {
            bail!("private HIT terminal scope");
        }
        match value.op {
            HitControlOp::ClientHello => {
                if s.hello
                    || world
                        .fighter(s.binding.player_id)
                        .is_none_or(|f| f.hp <= 0.0)
                {
                    bail!("private HIT duplicate/dead HELLO");
                }
                s.hello = true;
            }
            HitControlOp::ClientAck => {
                if !s.grant_written || value.token != s.token {
                    bail!("private HIT foreign/ungranted ACK");
                }
                let binding = s.binding;
                let token = s.token;
                let index = self.scope_index(epoch)?;
                self.scopes[index]
                    .ack_next(binding, &token, value.cursor)
                    .map_err(|e| anyhow!("private HIT presented ACK: {e:?}"))?;
                let session = self.sessions.get_mut(&epoch).unwrap();
                if session
                    .replay_request
                    .is_some_and(|sequence| sequence < value.cursor)
                {
                    // A delayed NACK may be overtaken by the genuine original
                    // receipt's presentation ACK before its replay is queued.
                    session.replay_request = None;
                }
                if self.scopes[index].pending() == 0 {
                    session.unacknowledged_since = None;
                }
            }
            HitControlOp::ClientNack => {
                if !s.grant_written || value.token != s.token {
                    bail!("private HIT foreign NACK");
                }
                let binding = s.binding;
                let token = s.token;
                let index = self.scope_index(epoch)?;
                if self.scopes[index]
                    .replay_unacknowledged(binding, &token, value.cursor)
                    .is_ok()
                {
                    // A cursor only, not a second receipt queue or producer.
                    self.sessions.get_mut(&epoch).unwrap().replay_request = Some(value.cursor);
                } else {
                    self.sessions.get_mut(&epoch).unwrap().terminal = Some(HitControlOp::ServerGap);
                }
            }
            _ => bail!("private HIT client control direction"),
        }
        Ok(())
    }

    pub fn committed_step(&mut self, world: &World, events: &[CombatEvent]) -> Result<()> {
        // Executed after the ONE original step_into. Close old private QUIC
        // scopes before any new-life receipt can be projected or written.
        let stale: Vec<u64> = self
            .sessions
            .iter()
            .filter_map(|(epoch, s)| {
                world
                    .fighter(s.binding.player_id)
                    .is_none_or(|f| f.world_incarnation() != s.binding.incarnation)
                    .then_some(*epoch)
            })
            .collect();
        for epoch in stale {
            self.remove(epoch);
        }
        if events.iter().all(|e| !matches!(e, CombatEvent::Hit { .. })) {
            return Ok(());
        }
        let committed = self
            .origin
            .capture_committed_hits_from_step(world, world.tick, events)
            .map_err(|e| anyhow!("private HIT original commit: {e:?}"))?;
        match project_world_tick_for_recipients(world.tick, &committed, &mut self.scopes) {
            Ok(_) => Ok(()),
            Err(error) => {
                for s in self.sessions.values_mut() {
                    if self.scopes[s.scope_index].gap().is_some() {
                        s.terminal = Some(HitControlOp::ServerGap);
                    }
                }
                if matches!(
                    error,
                    DeliveryError::PendingOverflow { .. }
                        | DeliveryError::ScopeGapped
                        | DeliveryError::ScopeRetired
                        | DeliveryError::SequenceExhaustion
                ) {
                    // Do not let one terminal participant retire unrelated
                    // spectator scopes. Every affected actor gets explicit GAP.
                    for s in self.sessions.values_mut() {
                        if committed.iter().any(|(_, identity)| {
                            s.binding == identity.attacker || s.binding == identity.victim
                        }) {
                            s.terminal = Some(HitControlOp::ServerGap);
                        }
                    }
                    Ok(())
                } else {
                    Err(anyhow!("private HIT terminal projection: {error:?}"))
                }
            }
        }
    }

    pub fn fail_all(&mut self) {
        for s in self.sessions.values_mut() {
            s.terminal = Some(HitControlOp::ServerRetired);
        }
        for scope in &mut self.scopes {
            scope.retire();
        }
    }

    pub fn next_frame(&self, world: &World, epoch: u64) -> Result<Option<Outgoing>> {
        self.current(world, epoch)?;
        let s = &self.sessions[&epoch];
        if !s.hello {
            return Ok(None);
        }
        // Conservatively bound a continuously unacknowledged batch as well
        // as writer stalls; explicit resync is safer than silent credit.
        let expired = s
            .unacknowledged_since
            .is_some_and(|at| at.elapsed().as_millis() >= u128::from(WRITE_TIMEOUT_MS));
        if let Some(op) = s.terminal.or(expired.then_some(HitControlOp::ServerGap)) {
            let bytes = encode_hit_control(HitControl {
                op,
                cursor: self.scopes[s.scope_index]
                    .gap()
                    .unwrap_or(self.scopes[s.scope_index].acknowledged_next()),
                token: s.token,
                aux: self.scopes[s.scope_index].acknowledged_next(),
            })
            .map_err(|e| anyhow!("private HIT terminal encoding: {e:?}"))?;
            return Ok(Some(Outgoing {
                bytes: bytes.to_vec(),
                kind: WrittenKind::Terminal,
            }));
        }
        if !s.grant_written {
            let bytes = encode_hit_control(HitControl {
                op: HitControlOp::ServerGrant,
                cursor: 0,
                token: s.token,
                aux: 64,
            })
            .map_err(|e| anyhow!("private HIT grant encoding: {e:?}"))?;
            return Ok(Some(Outgoing {
                bytes: bytes.to_vec(),
                kind: WrittenKind::Grant,
            }));
        }
        let index = self.scope_index(epoch)?;
        if let Some(sequence) = s.replay_request {
            let receipt = self.scopes[index]
                .replay_unacknowledged(s.binding, &s.token, sequence)
                .map_err(|e| anyhow!("private HIT replay queue: {e:?}"))?;
            return Ok(Some(Outgoing {
                bytes: encode_hit_receipt(receipt)
                    .map_err(|e| anyhow!("private HIT replay encoding: {e:?}"))?
                    .to_vec(),
                kind: WrittenKind::Replay(sequence),
            }));
        }
        let Some(receipt) = self.scopes[index]
            .next_unwritten(s.binding, &s.token)
            .map_err(|e| anyhow!("private HIT read queue: {e:?}"))?
        else {
            return Ok(None);
        };
        Ok(Some(Outgoing {
            bytes: encode_hit_receipt(receipt)
                .map_err(|e| anyhow!("private HIT receipt encoding: {e:?}"))?
                .to_vec(),
            kind: WrittenKind::Receipt(receipt.sequence),
        }))
    }

    pub fn written(&mut self, world: &World, epoch: u64, kind: WrittenKind) -> Result<()> {
        self.current(world, epoch)?;
        match kind {
            WrittenKind::Grant => self.sessions.get_mut(&epoch).unwrap().grant_written = true,
            WrittenKind::Receipt(sequence) => {
                let s = &self.sessions[&epoch];
                let binding = s.binding;
                let token = s.token;
                let index = self.scope_index(epoch)?;
                self.scopes[index]
                    .mark_written(binding, &token, sequence)
                    .map_err(|e| anyhow!("private HIT actual writer completion: {e:?}"))?;
                self.sessions
                    .get_mut(&epoch)
                    .unwrap()
                    .unacknowledged_since
                    .get_or_insert_with(Instant::now);
            }
            WrittenKind::Replay(sequence) => {
                if self.sessions[&epoch].replay_request != Some(sequence) {
                    bail!("private HIT unexpected replay completion");
                }
                self.sessions.get_mut(&epoch).unwrap().replay_request = None;
            }
            WrittenKind::Terminal => bail!("private HIT terminal GAP/retirement written"),
        }
        Ok(())
    }

    pub fn remove(&mut self, epoch: u64) {
        if let Some(mut s) = self.sessions.remove(&epoch) {
            s.connection
                .close(VarInt::from_u32(0), b"private HIT incarnation retired");
            let _ = self.origin.retire_exact(s.binding);
            self.scopes[s.scope_index].retire();
            self.scopes.remove(s.scope_index);
            for other in self.sessions.values_mut() {
                if other.scope_index > s.scope_index {
                    other.scope_index -= 1;
                }
            }
            s.token.fill(0);
        }
    }
}

// A private-path error cannot leave the original reliable writer detached.
pub struct WriterAbortGuard(pub tokio::task::AbortHandle);
impl Drop for WriterAbortGuard {
    fn drop(&mut self) {
        self.0.abort();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn private_writer_guard_aborts_the_original_task_on_connection_exit() {
        let task = tokio::spawn(std::future::pending::<()>());
        let guard = WriterAbortGuard(task.abort_handle());
        drop(guard);
        assert!(task.await.unwrap_err().is_cancelled());
    }

    #[test]
    fn nested_reliable_payload_debug_cannot_expose_private_grant_bytes() {
        let first = Outgoing {
            bytes: vec![161; 32],
            kind: WrittenKind::Grant,
        };
        let second = Outgoing {
            bytes: vec![239; 32],
            kind: WrittenKind::Grant,
        };
        let shown = format!("{first:?}");
        assert!(shown.contains("[REDACTED]"));
        assert!(!shown.contains("161"));
        assert_eq!(shown, format!("{second:?}"));
    }
}
