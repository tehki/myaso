//! IDR phase 1: dormant server-owned identity and observer-specific evidence.
//! No live wire integration: Core 8B must bind SubjectId to canonical CharacterId.
use std::collections::BTreeMap;
use std::num::NonZeroU128;

pub const UNKNOWN_LABEL: &str = "Unknown stranger";
pub const MAX_SUBJECTS: usize = 512;
pub const MAX_KNOWLEDGE: usize = 8192;
const MAX_NAME_CHARS: usize = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SubjectId(NonZeroU128);
impl SubjectId {
    pub fn new(id: u128) -> Option<Self> {
        NonZeroU128::new(id).map(Self)
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivateController {
    Human,
    Sentinel,
}
#[derive(Debug, Clone)]
struct Subject {
    true_name: String,
    controller: PrivateController,
    appearance: String,
    presentation_epoch: u64,
    disguised: bool,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Certainty {
    Unknown,
    Claimed,
    Verified,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservedIdentity {
    pub label: String,
    pub certainty: Certainty,
    pub appearance: String,
    pub presentation_epoch: u64,
}
#[derive(Debug, Clone)]
struct Knowledge {
    epoch: u64,
    certainty: Certainty,
    claim: Option<String>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityError {
    InvalidName,
    InvalidAppearance,
    Duplicate,
    UnknownSubject,
    SameCharacter,
    Capacity,
    EpochExhausted,
}

/// The calling authority MUST validate LOS and trusted evidence.
/// Client-supplied claims cannot request verified recognition.
#[derive(Default)]
pub struct IdentityRegistry {
    subjects: BTreeMap<SubjectId, Subject>,
    knowledge: BTreeMap<(SubjectId, SubjectId), Knowledge>,
}
fn valid_name(value: &str) -> bool {
    let chars = value.chars().count();
    if chars == 0 || chars > MAX_NAME_CHARS || value.trim() != value {
        return false;
    }
    let lower = value.to_ascii_lowercase();
    if [
        "system",
        "admin",
        "administrator",
        "moderator",
        "gm",
        "server",
    ]
    .contains(&lower.as_str())
    {
        return false;
    }
    value
        .chars()
        .all(|c| c.is_alphanumeric() || matches!(c, ' ' | '\'' | '-' | '\u{2019}'))
        && !value.contains("  ")
}
fn valid_appearance(value: &str) -> bool {
    (1..=64).contains(&value.len())
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}
impl IdentityRegistry {
    pub fn register(
        &mut self,
        id: SubjectId,
        private_name: &str,
        controller: PrivateController,
        appearance: &str,
    ) -> Result<(), IdentityError> {
        if !valid_name(private_name) {
            return Err(IdentityError::InvalidName);
        }
        if !valid_appearance(appearance) {
            return Err(IdentityError::InvalidAppearance);
        }
        if self.subjects.contains_key(&id) {
            return Err(IdentityError::Duplicate);
        }
        if self.subjects.len() >= MAX_SUBJECTS {
            return Err(IdentityError::Capacity);
        }
        self.subjects.insert(
            id,
            Subject {
                true_name: private_name.to_owned(),
                controller,
                appearance: appearance.to_owned(),
                presentation_epoch: 1,
                disguised: false,
            },
        );
        Ok(())
    }
    pub fn remove(&mut self, id: SubjectId) {
        self.subjects.remove(&id);
        self.knowledge
            .retain(|(viewer, subject), _| *viewer != id && *subject != id);
    }

    /// Caller must supply witnesses validated from current World LOS.
    /// Unwitnessed changes hide both verified identity and earlier claims.
    pub fn change_appearance(
        &mut self,
        id: SubjectId,
        appearance: &str,
        disguised: bool,
        witnesses: &[SubjectId],
    ) -> Result<(), IdentityError> {
        if !valid_appearance(appearance) {
            return Err(IdentityError::InvalidAppearance);
        }
        let actor = self
            .subjects
            .get_mut(&id)
            .ok_or(IdentityError::UnknownSubject)?;
        let epoch = actor
            .presentation_epoch
            .checked_add(1)
            .ok_or(IdentityError::EpochExhausted)?;
        actor.appearance = appearance.to_owned();
        actor.disguised = disguised;
        actor.presentation_epoch = epoch;
        for ((viewer, subject), known) in &mut self.knowledge {
            if *subject == id && witnesses.contains(viewer) {
                known.epoch = epoch;
            }
        }
        Ok(())
    }

    /// Verbal self-introduction is a CLAIM, never trusted identity evidence.
    pub fn introduce(
        &mut self,
        speaker: SubjectId,
        listener: SubjectId,
        claimed_name: &str,
    ) -> Result<(), IdentityError> {
        if speaker == listener {
            return Err(IdentityError::SameCharacter);
        }
        if !valid_name(claimed_name) {
            return Err(IdentityError::InvalidName);
        }
        let epoch = self
            .subjects
            .get(&speaker)
            .ok_or(IdentityError::UnknownSubject)?
            .presentation_epoch;
        if !self.subjects.contains_key(&listener) {
            return Err(IdentityError::UnknownSubject);
        }
        let key = (listener, speaker);
        if let Some(known) = self.knowledge.get(&key) {
            if known.epoch == epoch && known.certainty == Certainty::Verified {
                return Ok(());
            }
        }
        if !self.knowledge.contains_key(&key) && self.knowledge.len() >= MAX_KNOWLEDGE {
            return Err(IdentityError::Capacity);
        }
        self.knowledge.insert(
            key,
            Knowledge {
                epoch,
                certainty: Certainty::Claimed,
                claim: Some(claimed_name.to_owned()),
            },
        );
        Ok(())
    }

    /// Trusted server evidence only, NEVER a client-originated command.
    pub fn verified_evidence(
        &mut self,
        observer: SubjectId,
        subject: SubjectId,
    ) -> Result<(), IdentityError> {
        if observer == subject {
            return Err(IdentityError::SameCharacter);
        }
        let epoch = self
            .subjects
            .get(&subject)
            .ok_or(IdentityError::UnknownSubject)?
            .presentation_epoch;
        if !self.subjects.contains_key(&observer) {
            return Err(IdentityError::UnknownSubject);
        }
        let key = (observer, subject);
        if !self.knowledge.contains_key(&key) && self.knowledge.len() >= MAX_KNOWLEDGE {
            return Err(IdentityError::Capacity);
        }
        self.knowledge.insert(
            key,
            Knowledge {
                epoch,
                certainty: Certainty::Verified,
                claim: None,
            },
        );
        Ok(())
    }

    /// Per-viewer public projection never exposes true ID, actor type or controller.
    pub fn observe(
        &self,
        observer: SubjectId,
        subject: SubjectId,
    ) -> Result<ObservedIdentity, IdentityError> {
        let actor = self
            .subjects
            .get(&subject)
            .ok_or(IdentityError::UnknownSubject)?;
        if !self.subjects.contains_key(&observer) {
            return Err(IdentityError::UnknownSubject);
        }
        let knowledge = self
            .knowledge
            .get(&(observer, subject))
            .filter(|k| k.epoch == actor.presentation_epoch);
        let (label, certainty) = match knowledge {
            Some(Knowledge {
                certainty: Certainty::Verified,
                ..
            }) => (actor.true_name.clone(), Certainty::Verified),
            Some(Knowledge {
                certainty: Certainty::Claimed,
                claim: Some(name),
                ..
            }) => (format!("Calls themselves {name}"), Certainty::Claimed),
            _ => (UNKNOWN_LABEL.to_owned(), Certainty::Unknown),
        };
        Ok(ObservedIdentity {
            label,
            certainty,
            appearance: actor.appearance.clone(),
            presentation_epoch: actor.presentation_epoch,
        })
    }

    // Admin-only diagnostic: never add these fields to public snapshots.
    pub fn private_controller(&self, id: SubjectId) -> Option<PrivateController> {
        self.subjects.get(&id).map(|s| s.controller)
    }
    pub fn is_disguised_private(&self, id: SubjectId) -> Option<bool> {
        self.subjects.get(&id).map(|s| s.disguised)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn id(n: u128) -> SubjectId {
        SubjectId::new(n).unwrap()
    }
    fn people() -> IdentityRegistry {
        let mut s = IdentityRegistry::default();
        s.register(id(1), "Aldric", PrivateController::Human, "hooded-figure")
            .unwrap();
        s.register(id(2), "Marta", PrivateController::Sentinel, "hooded-figure")
            .unwrap();
        s.register(id(3), "Elara", PrivateController::Human, "hooded-figure")
            .unwrap();
        s
    }
    #[test]
    fn unknown_player_and_npc_have_identical_observer_projection() {
        let s = people();
        let human = s.observe(id(3), id(1)).unwrap();
        let npc = s.observe(id(3), id(2)).unwrap();
        assert_eq!(human, npc);
        assert_eq!(human.label, UNKNOWN_LABEL);
    }
    #[test]
    fn introductions_are_unverified_per_observer_and_may_lie() {
        let mut s = people();
        s.introduce(id(1), id(2), "Tomas").unwrap();
        assert_eq!(
            s.observe(id(2), id(1)).unwrap().label,
            "Calls themselves Tomas"
        );
        assert_eq!(
            s.observe(id(3), id(1)).unwrap().certainty,
            Certainty::Unknown
        );
        s.verified_evidence(id(2), id(1)).unwrap();
        assert_eq!(s.observe(id(2), id(1)).unwrap().label, "Aldric");
        s.introduce(id(1), id(2), "Another Name").unwrap();
        assert_eq!(s.observe(id(2), id(1)).unwrap().label, "Aldric");
    }
    #[test]
    fn witness_follows_disguise_nonwitness_loses_recognition() {
        let mut s = people();
        s.verified_evidence(id(2), id(1)).unwrap();
        s.verified_evidence(id(3), id(1)).unwrap();
        s.change_appearance(id(1), "sentinel-uniform", true, &[id(2)])
            .unwrap();
        assert_eq!(s.observe(id(2), id(1)).unwrap().label, "Aldric");
        assert_eq!(s.observe(id(3), id(1)).unwrap().label, UNKNOWN_LABEL);
        s.introduce(id(1), id(3), "Marta").unwrap();
        assert_eq!(
            s.observe(id(3), id(1)).unwrap().label,
            "Calls themselves Marta"
        );
    }
    #[test]
    fn unwitnessed_change_resets_claim() {
        let mut s = people();
        s.introduce(id(1), id(3), "Aldric").unwrap();
        s.change_appearance(id(1), "silver-knight", false, &[])
            .unwrap();
        assert_eq!(
            s.observe(id(3), id(1)).unwrap().certainty,
            Certainty::Unknown
        );
    }
    #[test]
    fn reject_reserved_names_bidi_html_duplicate_zero_bad_appearance() {
        assert!(SubjectId::new(0).is_none());
        let mut s = people();
        for name in [
            "System",
            "Admin",
            "GM",
            "<admin>",
            "A\u{202e}B",
            "Bad\nName",
            "Bad  Name",
            "",
        ] {
            assert_eq!(
                s.introduce(id(1), id(3), name),
                Err(IdentityError::InvalidName)
            );
        }
        assert_eq!(
            s.register(id(1), "Again", PrivateController::Human, "avatar"),
            Err(IdentityError::Duplicate)
        );
        assert_eq!(
            s.change_appearance(id(1), "../unsafe.png", true, &[]),
            Err(IdentityError::InvalidAppearance)
        );
    }
    #[test]
    fn reused_character_id_cannot_inherit_prior_observer_knowledge() {
        let mut s = people();
        s.verified_evidence(id(2), id(1)).unwrap();
        s.remove(id(1));
        s.register(
            id(1),
            "New Arrival",
            PrivateController::Human,
            "hooded-figure",
        )
        .unwrap();
        assert_eq!(
            s.observe(id(2), id(1)).unwrap().certainty,
            Certainty::Unknown
        );
    }
    #[test]
    fn invalid_observer_and_self_evidence_fail_closed() {
        let mut s = people();
        assert_eq!(s.observe(id(9), id(1)), Err(IdentityError::UnknownSubject));
        assert_eq!(
            s.verified_evidence(id(1), id(1)),
            Err(IdentityError::SameCharacter)
        );
        assert_eq!(
            s.introduce(id(1), id(9), "Tomas"),
            Err(IdentityError::UnknownSubject)
        );
    }
}

[executed on device: Serj (3e40bd2b-5db8-48a7-8e78-f84cd7273888)]