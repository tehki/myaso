//! Non-activated NPC-teacher eligibility domain for Magic Alpha.
//!
//! Teacher spawns must be registered by trusted world content, NOT by client
//! packets. This module does not create world NPCs or authenticate accounts.
//! Session lease, Fighter snapshot, ZoneAuthority and LootAuthority must all
//! come from a serialized server-side world tick. Never accept a supplied
//! fighter position or zone from an incoming lesson request.
use std::collections::BTreeMap;
use std::num::NonZeroU64;

use crate::character_identity::{CharacterId, SessionIdentityRegistry, SessionLease};
use crate::loot::LootAuthority;
use crate::magic::Lesson;
use crate::simulation::{Action, Fighter};
use crate::zone::{Position, ZoneAuthority, ZoneId};

pub const NPC_LESSON_REACH: f32 = 48.0;
pub const MAX_TEACHERS: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct TeacherId(NonZeroU64);

impl TeacherId {
    pub const fn new(id: u64) -> Option<Self> {
        match NonZeroU64::new(id) {
            Some(value) => Some(Self(value)),
            None => None,
        }
    }

    pub const fn get(self) -> u64 {
        self.0.get()
    }
}

/// Configured only by the trusted world manifest or NPC spawn controller.
#[derive(Debug, Clone, Copy)]
pub struct TeacherSpawn {
    pub id: TeacherId,
    pub zone: ZoneId,
    pub at: Position,
    pub lesson: Lesson,
}

#[derive(Debug, Clone, Copy)]
pub struct TeacherRequest<'a> {
    pub lease: SessionLease,
    pub teacher: TeacherId,
    pub fighter: &'a Fighter,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeacherError {
    InvalidSpawn,
    DuplicateTeacher,
    TooManyTeachers,
    UnknownTeacher,
    UnverifiedSession,
    WrongFighter,
    UnknownZone,
    WrongZone,
    CombatLocked,
    DeadPlayer,
    UnknownInventory,
    InvalidPosition,
    TooFarAway,
}

#[derive(Debug, Default)]
pub struct TeacherAuthority {
    teachers: BTreeMap<TeacherId, TeacherSpawn>,
}

impl TeacherAuthority {
    pub fn new() -> Self {
        Self::default()
    }

    /// Trusted registration only: do not expose it in the client protocol.
    /// No teacher is implicitly spawned into the live world by this call.
    pub fn register_trusted(&mut self, spawn: TeacherSpawn) -> Result<(), TeacherError> {
        let (width, height) = spawn.zone.bounds();
        if !spawn.at.x.is_finite()
            || !spawn.at.y.is_finite()
            || spawn.at.x < 18.0
            || spawn.at.y < 18.0
            || spawn.at.x > width - 18.0
            || spawn.at.y > height - 18.0
        {
            return Err(TeacherError::InvalidSpawn);
        }
        if self.teachers.contains_key(&spawn.id) {
            return Err(TeacherError::DuplicateTeacher);
        }
        if self.teachers.len() >= MAX_TEACHERS {
            return Err(TeacherError::TooManyTeachers);
        }
        self.teachers.insert(spawn.id, spawn);
        Ok(())
    }

    /// Read-only eligibility; reward and receipt issuance occur later in a
    /// single staged checkpoint, never within this authority check.
    pub fn authorize(
        &self,
        request: TeacherRequest<'_>,
        identity: &SessionIdentityRegistry,
        zones: &ZoneAuthority,
        loot: &LootAuthority,
    ) -> Result<(CharacterId, Lesson), TeacherError> {
        let character = identity
            .resolve_session(request.lease)
            .ok_or(TeacherError::UnverifiedSession)?;
        let session = request.lease.server_session();
        if request.fighter.net_id != session {
            return Err(TeacherError::WrongFighter);
        }
        let zone = zones.zone_of(session).ok_or(TeacherError::UnknownZone)?;
        let teacher = self
            .teachers
            .get(&request.teacher)
            .ok_or(TeacherError::UnknownTeacher)?;
        if teacher.zone != zone {
            return Err(TeacherError::WrongZone);
        }
        if loot.inventory(session).is_none() {
            return Err(TeacherError::UnknownInventory);
        }
        if loot.is_dead(session) {
            return Err(TeacherError::DeadPlayer);
        }
        if request.fighter.action != Action::Idle || request.fighter.hp <= 0.0 {
            return Err(TeacherError::CombatLocked);
        }
        let (width, height) = zone.bounds();
        let x = request.fighter.x;
        let y = request.fighter.y;
        if !x.is_finite()
            || !y.is_finite()
            || x < 18.0
            || y < 18.0
            || x > width - 18.0
            || y > height - 18.0
        {
            return Err(TeacherError::InvalidPosition);
        }
        let dx = x - teacher.at.x;
        let dy = y - teacher.at.y;
        if dx * dx + dy * dy > NPC_LESSON_REACH * NPC_LESSON_REACH {
            return Err(TeacherError::TooFarAway);
        }
        Ok((character, teacher.lesson))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::magic::{Rune, Spell};
    use crate::simulation::World;

    fn fighter(id: u32, x: f32, y: f32) -> Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(id, x, y, 0.0);
        world.fighter(id).unwrap().clone()
    }

    fn teacher(id: u64, x: f32, y: f32, lesson: Lesson) -> TeacherSpawn {
        TeacherSpawn {
            id: TeacherId::new(id).unwrap(),
            zone: ZoneId::Moonvale,
            at: Position { x, y },
            lesson,
        }
    }

    #[test]
    fn verified_nearby_idle_player_can_request_manifested_fire_teacher() {
        let mut trainers = TeacherAuthority::new();
        trainers
            .register_trusted(teacher(1, 200.0, 200.0, Lesson::Rune(Rune::Fire)))
            .unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(500).unwrap();
        identity
            .bind_verified(SessionLease::new(1, 1).unwrap(), character)
            .unwrap();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let player = fighter(1, 215.0, 200.0);
        let request = TeacherRequest {
            lease: SessionLease::new(1, 1).unwrap(),
            teacher: TeacherId::new(1).unwrap(),
            fighter: &player,
        };
        assert_eq!(
            trainers.authorize(request, &identity, &zones, &loot),
            Ok((character, Lesson::Rune(Rune::Fire)))
        );
        assert_eq!(
            trainers.authorize(
                TeacherRequest {
                    lease: SessionLease::new(1, 2).unwrap(),
                    ..request
                },
                &identity,
                &zones,
                &loot,
            ),
            Err(TeacherError::UnverifiedSession)
        );
    }

    #[test]
    fn distant_cross_zone_and_forged_fighter_are_rejected() {
        let mut trainers = TeacherAuthority::new();
        trainers
            .register_trusted(teacher(1, 200.0, 200.0, Lesson::Spell(Spell::Ember)))
            .unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(
                SessionLease::new(1, 1).unwrap(),
                CharacterId::new(50).unwrap(),
            )
            .unwrap();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let distant = fighter(1, 300.0, 300.0);
        assert_eq!(
            trainers.authorize(
                TeacherRequest {
                    lease: SessionLease::new(1, 1).unwrap(),
                    teacher: TeacherId::new(1).unwrap(),
                    fighter: &distant,
                },
                &identity,
                &zones,
                &loot,
            ),
            Err(TeacherError::TooFarAway)
        );
        let wrong_id = fighter(2, 200.0, 200.0);
        assert_eq!(
            trainers.authorize(
                TeacherRequest {
                    lease: SessionLease::new(1, 1).unwrap(),
                    teacher: TeacherId::new(1).unwrap(),
                    fighter: &wrong_id,
                },
                &identity,
                &zones,
                &loot,
            ),
            Err(TeacherError::WrongFighter)
        );
        assert_eq!(
            trainers.register_trusted(TeacherSpawn {
                id: TeacherId::new(1).unwrap(),
                zone: ZoneId::RedLionInn,
                at: Position { x: 200.0, y: 200.0 },
                lesson: Lesson::Spell(Spell::Ember),
            }),
            Err(TeacherError::DuplicateTeacher)
        );
        trainers
            .register_trusted(TeacherSpawn {
                id: TeacherId::new(2).unwrap(),
                zone: ZoneId::RedLionInn,
                at: Position { x: 200.0, y: 200.0 },
                lesson: Lesson::Spell(Spell::Ember),
            })
            .unwrap();
        let near = fighter(1, 200.0, 200.0);
        assert_eq!(
            trainers.authorize(
                TeacherRequest {
                    lease: SessionLease::new(1, 1).unwrap(),
                    teacher: TeacherId::new(2).unwrap(),
                    fighter: &near,
                },
                &identity,
                &zones,
                &loot,
            ),
            Err(TeacherError::WrongZone)
        );
    }

    #[test]
    fn invalid_or_missing_teacher_and_nonidle_player_fail_closed() {
        let mut trainers = TeacherAuthority::new();
        assert_eq!(
            trainers.register_trusted(teacher(1, f32::NAN, 200.0, Lesson::Rune(Rune::Fire))),
            Err(TeacherError::InvalidSpawn)
        );
        trainers
            .register_trusted(teacher(1, 200.0, 200.0, Lesson::Rune(Rune::Fire)))
            .unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(
                SessionLease::new(1, 1).unwrap(),
                CharacterId::new(10).unwrap(),
            )
            .unwrap();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let mut player = fighter(1, 200.0, 200.0);
        player.action = Action::Dead;
        let request = TeacherRequest {
            lease: SessionLease::new(1, 1).unwrap(),
            teacher: TeacherId::new(1).unwrap(),
            fighter: &player,
        };
        assert_eq!(
            trainers.authorize(request, &identity, &zones, &loot),
            Err(TeacherError::CombatLocked)
        );
        assert_eq!(
            trainers.authorize(
                TeacherRequest {
                    teacher: TeacherId::new(9).unwrap(),
                    ..request
                },
                &identity,
                &zones,
                &loot,
            ),
            Err(TeacherError::UnknownTeacher)
        );
    }
}
