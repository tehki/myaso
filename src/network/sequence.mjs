export function isSequenceNewer16(candidate, reference) {
  assertUint16(candidate, "candidate");
  assertUint16(reference, "reference");
  if (candidate === reference) return false;
  return ((candidate - reference) & 0xffff) < 0x8000;
}

export function sequenceDistance16(newer, older) {
  assertUint16(newer, "newer");
  assertUint16(older, "older");
  return (newer - older) & 0xffff;
}

function assertUint16(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${name} must be a uint16`);
  }
}
