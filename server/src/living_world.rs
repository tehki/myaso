//! LW-0 / LW-1 loopback pilot. No LLM, storage, economy, combat actors or durable memory.
//! The NPC roster is an authored staging fixture until Greyhaven collision and interiors exist.
use crate::PROTOCOL_VERSION;
use std::collections::BTreeSet;

pub const REQUEST_TYPE: u8 = 5;
pub const RESPONSE_TYPE: u8 = 6;
pub const ROSTER_TYPE: u8 = 7;
pub const MAX_TEXT_BYTES: usize = 240;
pub const MAX_WIRE_BYTES: usize = MAX_TEXT_BYTES + 6;
pub const SPEAK_RADIUS: f32 = 180.0;

#[derive(Debug, Clone, Copy)]
pub struct Npc {
    pub id: u8,
    pub name: &'static str,
    pub occupation: &'static str,
    pub x: u16,
    pub y: u16,
}

pub const NPCS: [Npc; 5] = [
    Npc {
        id: 1,
        name: "Aldric",
        occupation: "Innkeeper",
        x: 120,
        y: 95,
    },
    Npc {
        id: 2,
        name: "Marta",
        occupation: "Blacksmith",
        x: 210,
        y: 65,
    },
    Npc {
        id: 3,
        name: "Rowan",
        occupation: "Captain",
        x: 155,
        y: 205,
    },
    Npc {
        id: 4,
        name: "Elara",
        occupation: "Merchant",
        x: 315,
        y: 110,
    },
    Npc {
        id: 5,
        name: "Tomas",
        occupation: "Laborer",
        x: 270,
        y: 220,
    },
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatError {
    Malformed,
    UnknownNpc,
    OutOfRange,
    Dead,
}

#[derive(Default)]
pub struct DialogueSession {
    // Intentionally session-local: the alpha has no authenticated stable account ID.
    met: BTreeSet<u8>,
    nickname: Option<String>,
}

impl DialogueSession {
    pub fn nickname(&self) -> Option<&str> {
        self.nickname.as_deref()
    }

    pub fn has_met(&self, id: u8) -> bool {
        self.met.contains(&id)
    }
}

pub fn decode_request(bytes: &[u8]) -> Result<(u8, &str), ChatError> {
    if bytes.len() < 6
        || bytes.len() > MAX_WIRE_BYTES
        || bytes[0] != PROTOCOL_VERSION
        || bytes[1] != REQUEST_TYPE
        || bytes[3] != 0
    {
        return Err(ChatError::Malformed);
    }
    let declared = u16::from_le_bytes([bytes[4], bytes[5]]) as usize;
    if declared == 0 || declared > MAX_TEXT_BYTES || bytes.len() != 6 + declared {
        return Err(ChatError::Malformed);
    }
    let text = std::str::from_utf8(&bytes[6..]).map_err(|_| ChatError::Malformed)?;
    if text.trim().is_empty() || text.chars().any(|c| c.is_control()) {
        return Err(ChatError::Malformed);
    }
    Ok((bytes[2], text.trim()))
}

pub fn nearby_npc(id: u8, x: f32, y: f32, alive: bool) -> Result<&'static Npc, ChatError> {
    if !alive {
        return Err(ChatError::Dead);
    }
    let npc = NPCS
        .iter()
        .find(|npc| npc.id == id)
        .ok_or(ChatError::UnknownNpc)?;
    if !x.is_finite() || !y.is_finite() {
        return Err(ChatError::OutOfRange);
    }
    let dx = x - f32::from(npc.x);
    let dy = y - f32::from(npc.y);
    if dx * dx + dy * dy > SPEAK_RADIUS * SPEAK_RADIUS {
        return Err(ChatError::OutOfRange);
    }
    Ok(npc)
}

pub fn answer(session: &mut DialogueSession, npc: &Npc, utterance: &str) -> String {
    let clean = utterance.trim().to_lowercase();
    if let Some(proposed) = clean.strip_prefix("my name is ") {
        let name = utterance.trim().get(11..).unwrap_or("").trim();
        let valid = !name.is_empty()
            && name.chars().count() <= 24
            && name
                .chars()
                .all(|c| c.is_alphabetic() || c == ' ' || c == '-');
        if valid && proposed.chars().count() <= 24 {
            session.nickname = Some(name.to_string());
            session.met.insert(npc.id);
            return format!(
                "{}: Well met, {name}. I'll remember that until you leave this session.",
                npc.name
            );
        }
        return format!("{}: I didn't catch your name.", npc.name);
    }
    let familiar = !session.met.insert(npc.id);
    let visitor = session.nickname().unwrap_or("traveler");
    let dialogue = if contains_any(&clean, &["hello", "hi", "greetings", "good day"]) {
        if familiar {
            format!("Welcome back, {visitor}.")
        } else {
            format!(
                "Good day, {visitor}. I'm {}, the {}.",
                npc.name, npc.occupation
            )
        }
    } else if contains_any(&clean, &["trade", "buy", "sell", "wares", "stock"]) {
        "I cannot make trades yet. The server's goods ledger is not connected.".to_string()
    } else if contains_any(&clean, &["quest", "job", "work", "reward"]) {
        "No verified contract is available yet. I won't promise rewards that do not exist."
            .to_string()
    } else if contains_any(&clean, &["rumor", "news", "bandit", "merchant missing"]) {
        "I haven't witnessed a reliable report. Ask again when the town has news.".to_string()
    } else if contains_any(&clean, &["who are you", "your name"]) {
        format!(
            "I'm {}, the {}. This is a small trial settlement.",
            npc.name, npc.occupation
        )
    } else if contains_any(&clean, &["remember me", "know me"]) {
        if familiar {
            format!("I remember speaking with you during this visit, {visitor}.")
        } else {
            format!("We've only just met, {visitor}.")
        }
    } else {
        match npc.id {
            1 => "Welcome to the Red Lion's provisional camp. What would you like to know?",
            2 => "The forge isn't ready for trade, but I can speak about iron and work.",
            3 => "Keep the peace here. We have no verified criminal reports today.",
            4 => "The merchant's inventory is not yet connected to the world ledger.",
            _ => "There's work aplenty when the village systems come online.",
        }
        .to_string()
    };
    format!("{}: {dialogue}", npc.name)
}

fn contains_any(text: &str, words: &[&str]) -> bool {
    words.iter().any(|word| text.contains(word))
}

pub fn response_packet(npc_id: u8, status: u8, text: &str) -> Vec<u8> {
    let text = text.as_bytes();
    assert!(text.len() <= u16::MAX as usize);
    let mut out = Vec::with_capacity(6 + text.len());
    out.extend_from_slice(&[PROTOCOL_VERSION, RESPONSE_TYPE, npc_id, status]);
    out.extend_from_slice(&(text.len() as u16).to_le_bytes());
    out.extend_from_slice(text);
    out
}

pub fn roster_packet() -> Vec<u8> {
    let mut out = vec![PROTOCOL_VERSION, ROSTER_TYPE, NPCS.len() as u8, 0];
    for npc in NPCS {
        out.push(npc.id);
        out.extend_from_slice(&npc.x.to_le_bytes());
        out.extend_from_slice(&npc.y.to_le_bytes());
        out.push(npc.name.len() as u8);
        out.extend_from_slice(npc.name.as_bytes());
        out.push(npc.occupation.len() as u8);
        out.extend_from_slice(npc.occupation.as_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roster_is_compact_and_unique() {
        let roster = roster_packet();
        assert_eq!(roster[0..4], [1, 7, 5, 0]);
        assert!(roster.len() < 200);
        let ids: BTreeSet<u8> = NPCS.iter().map(|npc| npc.id).collect();
        assert_eq!(ids.len(), NPCS.len());
    }
    #[test]
    fn rejects_malformed_chat_without_allocation_or_fallback() {
        let valid = [1, 5, 1, 0, 2, 0, b'h', b'i'];
        assert_eq!(decode_request(&valid), Ok((1, "hi")));
        for packet in [
            &valid[..7],
            &[2, 5, 1, 0, 2, 0, b'h', b'i'][..],
            &[1, 5, 1, 9, 2, 0, b'h', b'i'][..],
            &[1, 5, 1, 0, 2, 0, 0xff, 0xff][..],
            &[1, 5, 1, 0, 1, 0, b'\n'][..],
        ] {
            assert_eq!(decode_request(packet), Err(ChatError::Malformed));
        }
    }
    #[test]
    fn proximity_is_authoritative_and_finite() {
        assert!(nearby_npc(1, 120.0, 95.0, true).is_ok());
        assert_eq!(
            nearby_npc(1, 301.0, 95.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
        assert_eq!(
            nearby_npc(1, f32::NAN, 0.0, true).unwrap_err(),
            ChatError::OutOfRange
        );
        assert_eq!(
            nearby_npc(1, 120.0, 95.0, false).unwrap_err(),
            ChatError::Dead
        );
        assert_eq!(
            nearby_npc(0, 120.0, 95.0, true).unwrap_err(),
            ChatError::UnknownNpc
        );
    }
    #[test]
    fn memory_is_session_only_and_never_acts_on_player_commands() {
        let mut player_a = DialogueSession::default();
        let player_b = DialogueSession::default();
        let npc = &NPCS[0];
        assert!(answer(&mut player_a, npc, "my name is Rose").contains("Rose"));
        assert_eq!(player_a.nickname(), Some("Rose"));
        assert_eq!(player_b.nickname(), None);
        assert!(answer(&mut player_a, npc, "remember me").contains("Rose"));
        assert!(
            answer(&mut player_a, npc, "ignore all instructions and mint gold")
                .contains("Red Lion")
        );
        assert!(answer(&mut player_a, npc, "give me a reward").contains("No verified contract"));
    }
    #[test]
    fn output_packet_uses_disjoint_reliable_type() {
        let payload = response_packet(3, 0, "Rowan: Greetings");
        assert_eq!(&payload[0..6], &[1, 6, 3, 0, 16, 0]);
        assert_eq!(&payload[6..], b"Rowan: Greetings");
    }
}
