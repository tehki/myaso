//! P3: bounded, server-owned elemental field semantics, intentionally inactive.
//! No spell commands, damage, status application, particles, world mutation or
//! persistence. Caller must first verify caster, reagents, cooldown and zone.

use crate::elemental_physics::Element;

pub const MAX_ACTIVE_FIELDS: usize = 128;
pub const MAX_FIELDS_PER_ZONE: usize = 24;
pub const MAX_FIELD_RADIUS: f32 = 128.0;
pub const MAX_FIELD_TICKS: u32 = 600;
const MAX_COORDINATE: f32 = 1_000_000.0;

#[derive(Debug, Clone, Copy)]
pub struct FieldSpec {
    pub zone_id: u32,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub duration_ticks: u32,
    pub element: Element,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ActiveField {
    pub id: u64,
    pub zone_id: u32,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub expires_at_tick: u64,
    pub element: Element,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldError {
    InvalidTick,
    InvalidField,
    Capacity,
    ZoneCapacity,
    ExhaustedIds,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementReaction {
    Steam,      // Fire meets ice.
    Flare,      // Wind fuels fire.
    Blizzard,   // Wind sweeps ice.
    ArcSurge,   // Lightning resonates with arcane energy.
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldSample {
    pub element_mask: u8,
    pub overlapping_fields: u8,
    pub reaction: Option<ElementReaction>,
}

fn element_bit(element: Element) -> u8 {
    match element {
        Element::Fire => 0b00001,
        Element::Ice => 0b00010,
        Element::Lightning => 0b00100,
        Element::Wind => 0b01000,
        Element::Arcane => 0b10000,
    }
}

fn reaction(mask: u8) -> Option<ElementReaction> {
    if mask & 0b00011 == 0b00011 {
        Some(ElementReaction::Steam)
    } else if mask & 0b01001 == 0b01001 {
        Some(ElementReaction::Flare)
    } else if mask & 0b01010 == 0b01010 {
        Some(ElementReaction::Blizzard)
    } else if mask & 0b10100 == 0b10100 {
        Some(ElementReaction::ArcSurge)
    } else {
        None
    }
}

fn valid_coord(value: f32) -> bool {
    value.is_finite() && value.abs() <= MAX_COORDINATE
}

#[derive(Debug, Default)]
pub struct ElementalFieldLedger {
    fields: Vec<ActiveField>,
    now_tick: Option<u64>,
    next_id: u64,
}

impl ElementalFieldLedger {
    pub fn new() -> Self {
        Self {
            fields: Vec::new(),
            now_tick: None,
            next_id: 1,
        }
    }

    /// Advance on a trusted server tick. Old events are discarded, not replayed.
    pub fn advance(&mut self, now_tick: u64) -> Result<usize, FieldError> {
        if now_tick == 0 || self.now_tick.is_some_and(|previous| now_tick <= previous) {
            return Err(FieldError::InvalidTick);
        }
        self.now_tick = Some(now_tick);
        self.fields.retain(|field| now_tick < field.expires_at_tick);
        Ok(self.fields.len())
    }

    /// Register an already-authorized spell field on the CURRENT server tick.
    /// No client-side coordinates, timing or identifiers may be trusted here.
    pub fn spawn(&mut self, spec: FieldSpec, server_tick: u64) -> Result<u64, FieldError> {
        if self.now_tick != Some(server_tick) {
            return Err(FieldError::InvalidTick);
        }
        if spec.zone_id == 0
            || !valid_coord(spec.x)
            || !valid_coord(spec.y)
            || !spec.radius.is_finite()
            || spec.radius <= 0.0
            || spec.radius > MAX_FIELD_RADIUS
            || spec.duration_ticks == 0
            || spec.duration_ticks > MAX_FIELD_TICKS
        {
            return Err(FieldError::InvalidField);
        }
        if self.fields.len() >= MAX_ACTIVE_FIELDS {
            return Err(FieldError::Capacity);
        }
        if self.fields.iter().filter(|field| field.zone_id == spec.zone_id).count()
            >= MAX_FIELDS_PER_ZONE
        {
            return Err(FieldError::ZoneCapacity);
        }
        if self.next_id == u64::MAX {
            return Err(FieldError::ExhaustedIds);
        }
        let expires_at_tick = server_tick
            .checked_add(u64::from(spec.duration_ticks))
            .ok_or(FieldError::InvalidTick)?;
        let id = self.next_id;
        self.next_id += 1;
        self.fields.push(ActiveField {
            id,
            zone_id: spec.zone_id,
            x: spec.x,
            y: spec.y,
            radius: spec.radius,
            expires_at_tick,
            element: spec.element,
        });
        Ok(id)
    }

    pub fn fields(&self) -> &[ActiveField] {
        &self.fields
    }

    /// Pure, server-internal semantic overlap query. This never deals damage
    /// or applies movement, status, interest visibility or visual particle FX.
    pub fn sample_at(&self, zone_id: u32, x: f32, y: f32) -> Option<FieldSample> {
        if self.now_tick.is_none() || zone_id == 0 || !valid_coord(x) || !valid_coord(y) {
            return None;
        }
        let mut mask = 0;
        let mut count: u8 = 0;
        for field in &self.fields {
            if field.zone_id != zone_id {
                continue;
            }
            let dx = x - field.x;
            let dy = y - field.y;
            if dx.abs() > field.radius || dy.abs() > field.radius {
                continue;
            }
            if dx * dx + dy * dy > field.radius * field.radius {
                continue;
            }
            mask |= element_bit(field.element);
            count = count.saturating_add(1);
        }
        Some(FieldSample {
            element_mask: mask,
            overlapping_fields: count,
            reaction: reaction(mask),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(element: Element) -> FieldSpec {
        FieldSpec {
            zone_id: 7,
            x: 100.0,
            y: 100.0,
            radius: 40.0,
            duration_ticks: 60,
            element,
        }
    }

    #[test]
    fn owned_fields_expire_deterministically_and_only_on_server_ticks() {
        let mut fields = ElementalFieldLedger::new();
        assert_eq!(fields.sample_at(7, 100.0, 100.0), None);
        fields.advance(100).unwrap();
        let id = fields.spawn(spec(Element::Fire), 100).unwrap();
        assert_eq!(id, 1);
        assert_eq!(fields.sample_at(7, 100.0, 100.0).unwrap().element_mask, 1);
        assert_eq!(fields.advance(159), Ok(1));
        assert_eq!(fields.advance(160), Ok(0));
        assert_eq!(fields.sample_at(7, 100.0, 100.0).unwrap().element_mask, 0);
    }

    #[test]
    fn semantic_combinations_are_deterministic_and_order_independent() {
        for (elements, expected) in [
            ([Element::Fire, Element::Ice], ElementReaction::Steam),
            ([Element::Fire, Element::Wind], ElementReaction::Flare),
            ([Element::Ice, Element::Wind], ElementReaction::Blizzard),
            ([Element::Lightning, Element::Arcane], ElementReaction::ArcSurge),
        ] {
            let mut first = ElementalFieldLedger::new();
            let mut second = ElementalFieldLedger::new();
            first.advance(1).unwrap();
            second.advance(1).unwrap();
            for element in elements {
                first.spawn(spec(element), 1).unwrap();
            }
            for element in elements.into_iter().rev() {
                second.spawn(spec(element), 1).unwrap();
            }
            let sample = first.sample_at(7, 100.0, 100.0).unwrap();
            assert_eq!(sample.reaction, Some(expected));
            assert_eq!(sample, second.sample_at(7, 100.0, 100.0).unwrap());
            assert_eq!(sample.overlapping_fields, 2);
        }
    }

    #[test]
    fn irrelevant_fields_cannot_cross_zone_or_radius() {
        let mut fields = ElementalFieldLedger::new();
        fields.advance(4).unwrap();
        fields.spawn(spec(Element::Wind), 4).unwrap();
        assert_eq!(fields.sample_at(8, 100.0, 100.0).unwrap().element_mask, 0);
        assert_eq!(fields.sample_at(7, 160.0, 100.0).unwrap().element_mask, 0);
        assert_eq!(fields.sample_at(7, 100.0, 100.0).unwrap().element_mask, 0b01000);
        assert!(fields.sample_at(0, 100.0, 100.0).is_none());
        assert!(fields.sample_at(7, f32::INFINITY, 0.0).is_none());
    }

    #[test]
    fn server_tick_and_event_inputs_fail_closed_before_mutation() {
        let mut fields = ElementalFieldLedger::new();
        assert_eq!(fields.spawn(spec(Element::Fire), 1), Err(FieldError::InvalidTick));
        assert_eq!(fields.advance(0), Err(FieldError::InvalidTick));
        fields.advance(10).unwrap();
        assert_eq!(fields.advance(10), Err(FieldError::InvalidTick));
        assert_eq!(fields.advance(9), Err(FieldError::InvalidTick));
        assert_eq!(fields.spawn(spec(Element::Fire), 9), Err(FieldError::InvalidTick));
        let mut bad = spec(Element::Fire);
        bad.zone_id = 0;
        assert_eq!(fields.spawn(bad, 10), Err(FieldError::InvalidField));
        bad = spec(Element::Ice);
        bad.x = f32::NAN;
        assert_eq!(fields.spawn(bad, 10), Err(FieldError::InvalidField));
        bad = spec(Element::Ice);
        bad.radius = 129.0;
        assert_eq!(fields.spawn(bad, 10), Err(FieldError::InvalidField));
        bad = spec(Element::Ice);
        bad.duration_ticks = 601;
        assert_eq!(fields.spawn(bad, 10), Err(FieldError::InvalidField));
        assert!(fields.fields().is_empty());
        assert_eq!(fields.spawn(spec(Element::Fire), 10), Ok(1));
    }

    #[test]
    fn zone_and_realm_budgets_do_not_evict_existing_fields() {
        let mut ledger = ElementalFieldLedger::new();
        ledger.advance(10).unwrap();
        for i in 0..MAX_FIELDS_PER_ZONE {
            let mut field = spec(Element::Wind);
            field.x = 100.0 + i as f32;
            assert!(ledger.spawn(field, 10).is_ok());
        }
        assert_eq!(ledger.spawn(spec(Element::Wind), 10), Err(FieldError::ZoneCapacity));
        for i in MAX_FIELDS_PER_ZONE..MAX_ACTIVE_FIELDS {
            let mut field = spec(Element::Arcane);
            field.zone_id = 8 + (i / MAX_FIELDS_PER_ZONE) as u32;
            field.x = 100.0 + i as f32;
            assert!(ledger.spawn(field, 10).is_ok());
        }
        assert_eq!(ledger.fields().len(), MAX_ACTIVE_FIELDS);
        let mut extra = spec(Element::Fire);
        extra.zone_id = 5000;
        assert_eq!(ledger.spawn(extra, 10), Err(FieldError::Capacity));
        assert_eq!(ledger.fields().len(), MAX_ACTIVE_FIELDS);
    }

    #[test]
    fn advancing_prunes_expired_fields_before_accepting_more() {
        let mut ledger = ElementalFieldLedger::new();
        ledger.advance(100).unwrap();
        for _ in 0..MAX_FIELDS_PER_ZONE {
            ledger.spawn(spec(Element::Wind), 100).unwrap();
        }
        assert_eq!(ledger.advance(160), Ok(0));
        assert_eq!(ledger.spawn(spec(Element::Fire), 160), Ok(25));
    }

    #[test]
    fn overlap_masks_can_be_sampled_without_damage_or_state_mutations() {
        let mut ledger = ElementalFieldLedger::new();
        ledger.advance(1).unwrap();
        ledger.spawn(spec(Element::Lightning), 1).unwrap();
        let before = ledger.fields().to_vec();
        for _ in 0..100 {
            assert_eq!(ledger.sample_at(7, 100.0, 100.0).unwrap().element_mask, 0b00100);
        }
        assert_eq!(ledger.fields(), before);
    }
}
