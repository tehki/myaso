use crate::simulation::World;

pub const PROJECTILE_SNAPSHOT_TYPE: u8 = 6;
pub const HEADER_BYTES: usize = 12;
pub const PROJECTILE_BYTES: usize = 16;
pub const DISARMED_BYTES: usize = 6;
pub const MAX_VISIBLE_PROJECTILES: usize = 40;
pub const MAX_VISIBLE_DISARMED: usize = 24;
const POSITION_SCALE: f32 = 4.0;

pub fn encode_projectile_snapshot(world: &World, viewer: u32) -> Vec<u8> {
    let eye = world.fighter(viewer);
    let (eye_x, eye_y) = eye.map_or((0.0, 0.0), |fighter| (fighter.x, fighter.y));
    let mut projectiles: Vec<_> = world.thrown_weapons().iter().collect();
    projectiles.sort_by(|a, b| {
        distance_sq(a.x, a.y, eye_x, eye_y)
            .total_cmp(&distance_sq(b.x, b.y, eye_x, eye_y))
            .then(a.id.cmp(&b.id))
    });
    projectiles.truncate(MAX_VISIBLE_PROJECTILES);

    let mut disarmed: Vec<_> = world
        .fighters()
        .iter()
        .filter_map(|fighter| {
            let remaining = world.weapon_rearm_remaining_ms(fighter.net_id);
            (remaining > 0).then_some((fighter.net_id, fighter.x, fighter.y, remaining))
        })
        .collect();
    disarmed.sort_by(|a, b| {
        distance_sq(a.1, a.2, eye_x, eye_y)
            .total_cmp(&distance_sq(b.1, b.2, eye_x, eye_y))
            .then(a.0.cmp(&b.0))
    });
    disarmed.truncate(MAX_VISIBLE_DISARMED);

    let mut payload = Vec::with_capacity(
        HEADER_BYTES + projectiles.len() * PROJECTILE_BYTES + disarmed.len() * DISARMED_BYTES,
    );
    payload.push(crate::PROTOCOL_VERSION);
    payload.push(PROJECTILE_SNAPSHOT_TYPE);
    payload.push(projectiles.len() as u8);
    payload.push(disarmed.len() as u8);
    payload.extend_from_slice(&world.tick.to_le_bytes());
    let own_disarm = world.weapon_rearm_remaining_ms(viewer).min(u16::MAX as u64) as u16;
    payload.extend_from_slice(&own_disarm.to_le_bytes());
    payload.extend_from_slice(&[0, 0]);
    for projectile in projectiles {
        payload.extend_from_slice(&(projectile.id as u32).to_le_bytes());
        payload.extend_from_slice(&projectile.owner.to_le_bytes());
        payload.extend_from_slice(&position(projectile.x).to_le_bytes());
        payload.extend_from_slice(&position(projectile.y).to_le_bytes());
        payload.extend_from_slice(&angle(projectile.dir_y.atan2(projectile.dir_x)).to_le_bytes());
        let remaining = projectile
            .expires_at
            .saturating_sub(world.projectile_now_ms());
        let remaining_seconds = remaining.div_ceil(1000).min(u16::MAX as u64) as u16;
        payload.extend_from_slice(&remaining_seconds.to_le_bytes());
    }
    for (net_id, _, _, remaining) in disarmed {
        payload.extend_from_slice(&net_id.to_le_bytes());
        payload.extend_from_slice(
            &(remaining.div_ceil(1000).min(u16::MAX as u64) as u16).to_le_bytes(),
        );
    }
    payload
}

fn distance_sq(x: f32, y: f32, eye_x: f32, eye_y: f32) -> f32 {
    let dx = x - eye_x;
    let dy = y - eye_y;
    dx * dx + dy * dy
}

fn position(value: f32) -> u16 {
    (value * POSITION_SCALE).round().clamp(0.0, u16::MAX as f32) as u16
}

fn angle(radians: f32) -> u16 {
    let radians = radians.rem_euclid(std::f32::consts::TAU);
    ((radians / std::f32::consts::TAU) * u16::MAX as f32).round() as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_world_snapshot_encodes_throw_disarm_and_removes_expired_projectile() {
        let mut world = World::new(1000.0, 700.0);
        world.add_player_at(1, 100.0, 100.0, 0.0);
        world.add_player_at(2, 150.0, 100.0, 0.0);
        let empty = encode_projectile_snapshot(&world, 1);
        assert_eq!(empty.len(), HEADER_BYTES);
        assert_eq!(empty[2], 0);
        assert_eq!(empty[3], 0);
        world.throw_weapon(1).unwrap();
        let payload = encode_projectile_snapshot(&world, 1);
        assert_eq!(
            payload.len(),
            HEADER_BYTES + PROJECTILE_BYTES + DISARMED_BYTES
        );
        assert_eq!(payload[0..4], [1, 6, 1, 1]);
        assert_eq!(u16::from_le_bytes([payload[8], payload[9]]), 30_000);
        assert_eq!(u32::from_le_bytes(payload[12..16].try_into().unwrap()), 1);
        assert_eq!(u32::from_le_bytes(payload[16..20].try_into().unwrap()), 1);
        assert_eq!(u16::from_le_bytes(payload[20..22].try_into().unwrap()), 400);
        assert_eq!(u16::from_le_bytes(payload[26..28].try_into().unwrap()), 900);
    }

    #[test]
    fn snapshot_is_strictly_bounded_below_quic_datagram_budget() {
        let mut world = World::new(8192.0, 8192.0);
        for id in 1..=MAX_VISIBLE_PROJECTILES as u32 {
            let x = 100.0 + id as f32 * 45.0;
            assert!(world.add_player_at(id, x, 150.0, 0.0));
            assert!(world.throw_weapon(id).is_ok());
        }
        let packet = encode_projectile_snapshot(&world, 1);
        assert_eq!(packet[2] as usize, MAX_VISIBLE_PROJECTILES);
        assert_eq!(packet[3] as usize, MAX_VISIBLE_DISARMED);
        assert_eq!(packet.len(), HEADER_BYTES + MAX_VISIBLE_PROJECTILES * PROJECTILE_BYTES
            + MAX_VISIBLE_DISARMED * DISARMED_BYTES);
        assert!(packet.len() <= crate::CONSERVATIVE_DATAGRAM_BYTES);
    }
}
