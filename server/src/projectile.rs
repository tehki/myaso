use std::collections::BTreeMap;

// Engine-only foundation for R2; transport, authoritative fighter mutations,
// snapshot replication and F key routing are separately required.
pub const REARM_MS: u64 = 30_000;
pub const MAX_LIFETIME_MS: u64 = 900_000;
pub const SPEED: f32 = 700.0;
pub const RADIUS: f32 = 7.0;
pub const MAX_ALIVE: usize = 256;
const FIGHTER_RADIUS: f32 = 18.0;
const REFLECT_GUARD_MS: u64 = 180;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Obstacle {
    pub x0: f32,
    pub y0: f32,
    pub x1: f32,
    pub y1: f32,
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Fighter {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub aim: f32,
    pub kick_active: bool,
    pub alive: bool,
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Projectile {
    pub id: u64,
    pub owner: u32,
    pub x: f32,
    pub y: f32,
    pub dir_x: f32,
    pub dir_y: f32,
    pub expires_at: u64,
    pub last_reflection: Option<u64>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    BadInput,
    Disarmed,
    Full,
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Event {
    Spawn { id: u64, owner: u32 },
    Reflect { id: u64, from: u32, to: u32 },
    Hit { id: u64, owner: u32, target: u32 },
    Obstacle { id: u64 },
    Expire { id: u64 },
}

#[derive(Debug, Default)]
pub struct WeaponProjectiles {
    clock: u64,
    next_id: u64,
    rearm: BTreeMap<u32, u64>,
    active: Vec<Projectile>,
}
impl WeaponProjectiles {
    pub fn new() -> Self {
        Self {
            clock: 0,
            next_id: 1,
            rearm: BTreeMap::new(),
            active: Vec::new(),
        }
    }
    pub fn now(&self) -> u64 {
        self.clock
    }
    pub fn active(&self) -> &[Projectile] {
        &self.active
    }
    pub fn remaining_disarm_ms(&self, owner: u32) -> u64 {
        self.rearm
            .get(&owner)
            .copied()
            .unwrap_or(0)
            .saturating_sub(self.clock)
    }
    pub fn equipped(&self, owner: u32) -> bool {
        owner != 0 && self.remaining_disarm_ms(owner) == 0
    }
    pub fn throw(
        &mut self,
        owner: u32,
        x: f32,
        y: f32,
        aim: f32,
        width: f32,
        height: f32,
    ) -> Result<Event, Refusal> {
        if owner == 0
            || ![x, y, aim, width, height].iter().all(|v| v.is_finite())
            || width <= RADIUS * 2.0
            || height <= RADIUS * 2.0
            || x <= RADIUS
            || x >= width - RADIUS
            || y <= RADIUS
            || y >= height - RADIUS
        {
            return Err(Refusal::BadInput);
        }
        if !self.equipped(owner) {
            return Err(Refusal::Disarmed);
        }
        if self.active.len() >= MAX_ALIVE || self.next_id == u64::MAX {
            return Err(Refusal::Full);
        }
        let id = self.next_id;
        self.next_id += 1;
        self.active.push(Projectile {
            id,
            owner,
            x,
            y,
            dir_x: aim.cos(),
            dir_y: aim.sin(),
            expires_at: self.clock.saturating_add(MAX_LIFETIME_MS),
            last_reflection: None,
        });
        self.rearm
            .insert(owner, self.clock.saturating_add(REARM_MS));
        Ok(Event::Spawn { id, owner })
    }

    pub fn advance(
        &mut self,
        elapsed_ms: u32,
        width: f32,
        height: f32,
        fighters: &[Fighter],
        obstacles: &[Obstacle],
    ) -> Result<Vec<Event>, Refusal> {
        if ![width, height].iter().all(|v| v.is_finite())
            || width <= RADIUS * 2.0
            || height <= RADIUS * 2.0
            || !obstacles.iter().all(|o| o.valid())
        {
            return Err(Refusal::BadInput);
        }
        let now = self.clock.saturating_add(elapsed_ms as u64);
        let mut events = Vec::new();
        let mut i = 0;
        while i < self.active.len() {
            let mut weapon = self.active[i];
            if now >= weapon.expires_at {
                events.push(Event::Expire { id: weapon.id });
                self.active.swap_remove(i);
                continue;
            }
            let next_x = weapon.x + weapon.dir_x * SPEED * elapsed_ms as f32 / 1000.0;
            let next_y = weapon.y + weapon.dir_y * SPEED * elapsed_ms as f32 / 1000.0;
            let mut contact: Option<(f32, Collision)> = None;
            // World bounds are actual solid obstacles, not a visual-only limit.
            for (start, end, min, max) in [
                (weapon.x, next_x, RADIUS, width - RADIUS),
                (weapon.y, next_y, RADIUS, height - RADIUS),
            ] {
                let crossing = if end < min {
                    Some(min)
                } else if end > max {
                    Some(max)
                } else {
                    None
                };
                if let Some(border) = crossing {
                    if (end - start).abs() > 1e-6 {
                        earliest(
                            &mut contact,
                            (border - start) / (end - start),
                            Collision::Obstacle,
                        );
                    }
                }
            }
            for o in obstacles {
                if let Some(t) = segment_rect(
                    weapon.x,
                    weapon.y,
                    next_x,
                    next_y,
                    Obstacle {
                        x0: o.x0 - RADIUS,
                        y0: o.y0 - RADIUS,
                        x1: o.x1 + RADIUS,
                        y1: o.y1 + RADIUS,
                    },
                ) {
                    earliest(&mut contact, t, Collision::Obstacle);
                }
            }
            for fighter in fighters {
                if !fighter.alive
                    || fighter.id == 0
                    || fighter.id == weapon.owner
                    || ![fighter.x, fighter.y, fighter.aim]
                        .iter()
                        .all(|v| v.is_finite())
                {
                    continue;
                }
                if let Some(t) = segment_circle(
                    weapon.x,
                    weapon.y,
                    next_x,
                    next_y,
                    fighter.x,
                    fighter.y,
                    FIGHTER_RADIUS + RADIUS,
                ) {
                    let impact_x = weapon.x + (next_x - weapon.x) * t - fighter.x;
                    let impact_y = weapon.y + (next_y - weapon.y) * t - fighter.y;
                    let mag = impact_x.hypot(impact_y);
                    let facing = mag <= 1e-5
                        || (impact_x * fighter.aim.cos() + impact_y * fighter.aim.sin()) / mag
                            >= (std::f32::consts::PI * 0.46).cos();
                    let reflect = fighter.kick_active
                        && facing
                        && weapon
                            .last_reflection
                            .is_none_or(|last| now.saturating_sub(last) >= REFLECT_GUARD_MS);
                    earliest(
                        &mut contact,
                        t,
                        if reflect {
                            Collision::Reflect(fighter.id, fighter.aim)
                        } else {
                            Collision::Hit(fighter.id)
                        },
                    );
                }
            }
            if let Some((t, action)) = contact {
                weapon.x += (next_x - weapon.x) * t;
                weapon.y += (next_y - weapon.y) * t;
                match action {
                    Collision::Obstacle => {
                        events.push(Event::Obstacle { id: weapon.id });
                        self.active.swap_remove(i);
                        continue;
                    }
                    Collision::Hit(target) => {
                        events.push(Event::Hit {
                            id: weapon.id,
                            owner: weapon.owner,
                            target,
                        });
                        self.active.swap_remove(i);
                        continue;
                    }
                    Collision::Reflect(by, aim) => {
                        events.push(Event::Reflect {
                            id: weapon.id,
                            from: weapon.owner,
                            to: by,
                        });
                        weapon.owner = by;
                        weapon.dir_x = aim.cos();
                        weapon.dir_y = aim.sin();
                        weapon.last_reflection = Some(now);
                    }
                }
            } else {
                weapon.x = next_x;
                weapon.y = next_y;
            }
            self.active[i] = weapon;
            i += 1;
        }
        self.clock = now;
        self.rearm.retain(|_, expiry| *expiry > now);
        Ok(events)
    }
}
impl Obstacle {
    fn valid(&self) -> bool {
        [self.x0, self.y0, self.x1, self.y1]
            .iter()
            .all(|v| v.is_finite())
            && self.x0 < self.x1
            && self.y0 < self.y1
    }
}
#[derive(Debug, Clone, Copy)]
enum Collision {
    Obstacle,
    Hit(u32),
    Reflect(u32, f32),
}
fn earliest(hit: &mut Option<(f32, Collision)>, t: f32, what: Collision) {
    if (0.0..=1.0).contains(&t) && hit.as_ref().is_none_or(|(before, _)| t < *before) {
        *hit = Some((t, what));
    }
}
fn segment_circle(x: f32, y: f32, nx: f32, ny: f32, cx: f32, cy: f32, r: f32) -> Option<f32> {
    let dx = nx - x;
    let dy = ny - y;
    let fx = x - cx;
    let fy = y - cy;
    let a = dx * dx + dy * dy;
    let c = fx * fx + fy * fy - r * r;
    if c <= 0.0 {
        return Some(0.0);
    }
    if a <= 1e-9 {
        return None;
    }
    let b = 2.0 * (fx * dx + fy * dy);
    let disc = b * b - 4.0 * a * c;
    if disc < 0.0 {
        return None;
    }
    let t = (-b - disc.sqrt()) / (2.0 * a);
    (0.0..=1.0).contains(&t).then_some(t)
}
fn segment_rect(
    x: f32,
    y: f32,
    nx: f32,
    ny: f32,
    box_: Obstacle,
) -> Option<f32> {
    let Obstacle { x0, y0, x1, y1 } = box_;
    let mut lo = 0.0f32;
    let mut hi = 1.0f32;
    for (start, end, min, max) in [(x, nx, x0, x1), (y, ny, y0, y1)] {
        let d = end - start;
        if d.abs() < 1e-7 {
            if start < min || start > max {
                return None;
            }
            continue;
        }
        let a = (min - start) / d;
        let b = (max - start) / d;
        lo = lo.max(a.min(b));
        hi = hi.min(a.max(b));
        if lo > hi {
            return None;
        }
    }
    Some(lo)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn actor(id: u32, x: f32, aim: f32, kick_active: bool) -> Fighter {
        Fighter {
            id,
            x,
            y: 100.0,
            aim,
            kick_active,
            alive: true,
        }
    }
    #[test]
    fn throw_disarms_for_30_seconds_but_projectile_remains() {
        let mut s = WeaponProjectiles::new();
        assert_eq!(
            s.throw(1, 100.0, 100.0, 0.0, 1_000_000.0, 500.0),
            Ok(Event::Spawn { id: 1, owner: 1 })
        );
        assert_eq!(s.remaining_disarm_ms(1), 30_000);
        assert_eq!(
            s.throw(1, 100.0, 100.0, 0.0, 1_000_000.0, 500.0),
            Err(Refusal::Disarmed)
        );
        s.advance(29_999, 1_000_000.0, 500.0, &[], &[]).unwrap();
        assert_eq!(s.remaining_disarm_ms(1), 1);
        s.advance(1, 1_000_000.0, 500.0, &[], &[]).unwrap();
        assert!(s.equipped(1));
        assert_eq!(s.active().len(), 1);
    }
    #[test]
    fn projectile_lasts_exactly_15_minutes_without_obstacles() {
        let mut s = WeaponProjectiles::new();
        let w = 1_000_000_000.0;
        s.throw(1, 1000.0, 1000.0, 0.0, w, w).unwrap();
        s.advance(899_999, w, w, &[], &[]).unwrap();
        assert_eq!(s.active().len(), 1);
        assert_eq!(
            s.advance(1, w, w, &[], &[]).unwrap(),
            vec![Event::Expire { id: 1 }]
        );
    }
    #[test]
    fn swept_collision_prevents_tunneling_and_prioritizes_nearest_obstacle() {
        let mut s = WeaponProjectiles::new();
        s.throw(1, 100.0, 100.0, 0.0, 600.0, 400.0).unwrap();
        let obstacle = Obstacle {
            x0: 170.0,
            y0: 60.0,
            x1: 185.0,
            y1: 140.0,
        };
        assert_eq!(
            s.advance(
                300,
                600.0,
                400.0,
                &[actor(2, 240.0, 0.0, false)],
                &[obstacle]
            )
            .unwrap(),
            vec![Event::Obstacle { id: 1 }]
        );
        assert!(s.active().is_empty());
    }
    #[test]
    fn kick_from_front_reflects_in_kicker_aim_and_transfers_credit() {
        let mut s = WeaponProjectiles::new();
        s.throw(1, 100.0, 100.0, 0.0, 600.0, 400.0).unwrap();
        let first = s
            .advance(
                200,
                600.0,
                400.0,
                &[actor(2, 200.0, std::f32::consts::PI, true)],
                &[],
            )
            .unwrap();
        assert_eq!(
            first,
            vec![Event::Reflect {
                id: 1,
                from: 1,
                to: 2
            }]
        );
        assert_eq!(s.active()[0].owner, 2);
        assert!(s.active()[0].dir_x < -0.99);
        assert_eq!(s.active()[0].expires_at, 900_000);
        assert!(s.equipped(2));
        let second = s
            .advance(200, 600.0, 400.0, &[actor(1, 120.0, 0.0, false)], &[])
            .unwrap();
        assert_eq!(
            second,
            vec![Event::Hit {
                id: 1,
                owner: 2,
                target: 1
            }]
        );
    }
    #[test]
    fn rear_facing_kick_cannot_reflect_and_hit_is_real() {
        let mut s = WeaponProjectiles::new();
        s.throw(1, 100.0, 100.0, 0.0, 600.0, 400.0).unwrap();
        assert_eq!(
            s.advance(200, 600.0, 400.0, &[actor(2, 200.0, 0.0, true)], &[])
                .unwrap(),
            vec![Event::Hit {
                id: 1,
                owner: 1,
                target: 2
            }]
        );
    }
    #[test]
    fn invalid_input_never_consumes_weapon_or_spawns() {
        let mut s = WeaponProjectiles::new();
        assert_eq!(
            s.throw(0, 100.0, 100.0, 0.0, 600.0, 400.0),
            Err(Refusal::BadInput)
        );
        assert_eq!(
            s.throw(1, 100.0, 100.0, f32::NAN, 600.0, 400.0),
            Err(Refusal::BadInput)
        );
        assert!(s.active().is_empty());
        assert!(s.equipped(1));
    }
}
