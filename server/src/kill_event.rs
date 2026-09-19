use crate::PROTOCOL_VERSION;

pub const KILL_EVENT_PACKET_TYPE: u8 = 4;
pub const KILL_EVENT_BYTES: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KillEventPacket {
    pub sequence: u32,
    pub killer: u32,
    pub victim: u32,
}

pub fn encode_kill_event(packet: KillEventPacket) -> [u8; KILL_EVENT_BYTES] {
    assert!(packet.killer != 0, "killer must be non-zero");
    assert!(packet.victim != 0, "victim must be non-zero");
    assert!(
        packet.killer != packet.victim,
        "killer and victim must differ"
    );

    let mut bytes = [0_u8; KILL_EVENT_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = KILL_EVENT_PACKET_TYPE;
    bytes[4..8].copy_from_slice(&packet.sequence.to_le_bytes());
    bytes[8..12].copy_from_slice(&packet.killer.to_le_bytes());
    bytes[12..16].copy_from_slice(&packet.victim.to_le_bytes());
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kill_event_matches_browser_wire_fixture() {
        let bytes = encode_kill_event(KillEventPacket {
            sequence: 0x0102_0304,
            killer: 17,
            victim: 23,
        });
        assert_eq!(bytes, [1, 4, 0, 0, 4, 3, 2, 1, 17, 0, 0, 0, 23, 0, 0, 0]);
    }
}
