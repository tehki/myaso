use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

pub const PROTOCOL_VERSION: u8 = 1;
pub const INPUT_PACKET_TYPE: u8 = 1;
pub const INPUT_HEADER_BYTES: usize = 16;
pub const INPUT_SAMPLE_BYTES: usize = 6;
pub const INPUT_REDUNDANCY_MAX: usize = 3;
pub const TARGET_PLAYERS_PER_MAP: usize = 512;
pub const CONSERVATIVE_DATAGRAM_BYTES: usize = 1100;

#[derive(Debug, Clone, PartialEq)]
pub struct InputSample {
    pub tick: u32,
    pub move_x: f32,
    pub move_y: f32,
    pub facing_radians: f32,
    pub attack: bool,
    pub dodge: bool,
    pub block: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InputPacket {
    pub sequence: u16,
    pub ack_snapshot_sequence: u16,
    pub client_tick: u32,
    pub ack_server_tick: u32,
    pub samples: Vec<InputSample>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    Truncated,
    UnsupportedProtocol(u8),
    WrongPacketType(u8),
    InvalidSampleCount(u8),
    InvalidLength { expected: usize, actual: usize },
}

pub fn decode_input_packet(bytes: &[u8]) -> Result<InputPacket, DecodeError> {
    if bytes.len() < INPUT_HEADER_BYTES {
        return Err(DecodeError::Truncated);
    }
    if bytes[0] != PROTOCOL_VERSION {
        return Err(DecodeError::UnsupportedProtocol(bytes[0]));
    }
    if bytes[1] != INPUT_PACKET_TYPE {
        return Err(DecodeError::WrongPacketType(bytes[1]));
    }

    let sample_count = bytes[2] as usize;
    if !(1..=INPUT_REDUNDANCY_MAX).contains(&sample_count) {
        return Err(DecodeError::InvalidSampleCount(bytes[2]));
    }

    let expected = INPUT_HEADER_BYTES + sample_count * INPUT_SAMPLE_BYTES;
    if bytes.len() != expected {
        return Err(DecodeError::InvalidLength {
            expected,
            actual: bytes.len(),
        });
    }

    let sequence = u16::from_le_bytes([bytes[4], bytes[5]]);
    let ack_snapshot_sequence = u16::from_le_bytes([bytes[6], bytes[7]]);
    let client_tick = u32::from_le_bytes(bytes[8..12].try_into().expect("length checked"));
    let ack_server_tick = u32::from_le_bytes(bytes[12..16].try_into().expect("length checked"));

    let mut samples = Vec::with_capacity(sample_count);
    let mut offset = INPUT_HEADER_BYTES;
    for _ in 0..sample_count {
        let tick_delta = bytes[offset] as u32;
        let move_x = (bytes[offset + 1] as i8) as f32 / 127.0;
        let move_y = (bytes[offset + 2] as i8) as f32 / 127.0;
        let facing_wire = u16::from_le_bytes([bytes[offset + 3], bytes[offset + 4]]);
        let buttons = bytes[offset + 5];
        samples.push(InputSample {
            tick: client_tick.wrapping_sub(tick_delta),
            move_x,
            move_y,
            facing_radians: (facing_wire as f32 / u16::MAX as f32) * std::f32::consts::TAU,
            attack: buttons & 0b001 != 0,
            dodge: buttons & 0b010 != 0,
            block: buttons & 0b100 != 0,
        });
        offset += INPUT_SAMPLE_BYTES;
    }

    Ok(InputPacket {
        sequence,
        ack_snapshot_sequence,
        client_tick,
        ack_server_tick,
        samples,
    })
}

#[derive(Debug)]
pub struct AdmissionGate {
    max: usize,
    current: AtomicUsize,
}

impl AdmissionGate {
    pub fn new(max: usize) -> Arc<Self> {
        Arc::new(Self {
            max,
            current: AtomicUsize::new(0),
        })
    }

    pub fn try_acquire(self: &Arc<Self>) -> Option<AdmissionPermit> {
        loop {
            let current = self.current.load(Ordering::Acquire);
            if current >= self.max {
                return None;
            }
            if self
                .current
                .compare_exchange_weak(current, current + 1, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
            {
                return Some(AdmissionPermit {
                    gate: Arc::clone(self),
                });
            }
        }
    }

    pub fn current(&self) -> usize {
        self.current.load(Ordering::Acquire)
    }

    pub fn max(&self) -> usize {
        self.max
    }
}

pub struct AdmissionPermit {
    gate: Arc<AdmissionGate>,
}

impl Drop for AdmissionPermit {
    fn drop(&mut self) {
        self.gate.current.fetch_sub(1, Ordering::AcqRel);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_packet() -> Vec<u8> {
        let mut bytes = vec![0_u8; INPUT_HEADER_BYTES + 3 * INPUT_SAMPLE_BYTES];
        bytes[0] = PROTOCOL_VERSION;
        bytes[1] = INPUT_PACKET_TYPE;
        bytes[2] = 3;
        bytes[4..6].copy_from_slice(&7_u16.to_le_bytes());
        bytes[6..8].copy_from_slice(&9_u16.to_le_bytes());
        bytes[8..12].copy_from_slice(&1000_u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&990_u32.to_le_bytes());

        let samples = [
            (0_u8, 127_i8, 0_i8, 0_u16, 0b001_u8),
            (1_u8, 0_i8, -127_i8, 16384_u16, 0b010_u8),
            (2_u8, -64_i8, 64_i8, 32768_u16, 0b100_u8),
        ];
        let mut offset = INPUT_HEADER_BYTES;
        for (delta, x, y, facing, buttons) in samples {
            bytes[offset] = delta;
            bytes[offset + 1] = x as u8;
            bytes[offset + 2] = y as u8;
            bytes[offset + 3..offset + 5].copy_from_slice(&facing.to_le_bytes());
            bytes[offset + 5] = buttons;
            offset += INPUT_SAMPLE_BYTES;
        }
        bytes
    }

    #[test]
    fn decodes_the_js_input_wire_format() {
        let packet = decode_input_packet(&sample_packet()).expect("valid packet");
        assert_eq!(packet.sequence, 7);
        assert_eq!(packet.ack_snapshot_sequence, 9);
        assert_eq!(packet.client_tick, 1000);
        assert_eq!(packet.ack_server_tick, 990);
        assert_eq!(packet.samples.len(), 3);
        assert_eq!(packet.samples[0].tick, 1000);
        assert!(packet.samples[0].attack);
        assert!(packet.samples[1].dodge);
        assert!(packet.samples[2].block);
        assert!((packet.samples[0].move_x - 1.0).abs() < 0.001);
        assert!((packet.samples[1].move_y + 1.0).abs() < 0.001);
    }

    #[test]
    fn rejects_malformed_packets_without_panicking() {
        assert_eq!(decode_input_packet(&[]), Err(DecodeError::Truncated));
        let mut packet = sample_packet();
        packet[0] = 99;
        assert_eq!(decode_input_packet(&packet), Err(DecodeError::UnsupportedProtocol(99)));
        let mut packet = sample_packet();
        packet[2] = 4;
        assert_eq!(decode_input_packet(&packet), Err(DecodeError::InvalidSampleCount(4)));
    }

    #[test]
    fn admission_gate_is_bounded_and_releases_slots() {
        let gate = AdmissionGate::new(2);
        let first = gate.try_acquire().expect("first slot");
        let second = gate.try_acquire().expect("second slot");
        assert_eq!(gate.current(), 2);
        assert!(gate.try_acquire().is_none());
        drop(first);
        assert_eq!(gate.current(), 1);
        let third = gate.try_acquire().expect("released slot");
        drop(second);
        drop(third);
        assert_eq!(gate.current(), 0);
    }
}
