// Acceptance-only: all three guard-break flights reuse one genuine local
// Firefox wheel channel. This does not change actual browser controls.
const GUARD_BREAK_WHEEL_SCENARIOS = Object.freeze([
  "uiguardbreak",
  "uiguardbreakpunishffa",
  "uiguardbreakpunishffahit",
]);

export function requiresM338GuardBreakWheelSocket(scenario, browser) {
  return browser === "firefox" && GUARD_BREAK_WHEEL_SCENARIOS.includes(scenario);
}
