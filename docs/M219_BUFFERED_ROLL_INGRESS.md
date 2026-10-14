# M219 — genuine buffered-roll timing evidence

Addresses issue #259 after M217 main CI first attempt failed original M129 by 3ms (+143ms vs strict 140ms limit). Keep all original W3C, authoritative, HP/guard, mouse direction, buffering and no-duplicate checks unmodified.

This observer records one Chrome actor's genuine wheel epoch, Chrome-observed authoritative attack recovery and Dodge action epochs, nominal 255ms recovery exit, configured 90ms buffered input window, and locally observed time differences. Missing, inverted, or invalid timestamps remain null or unknown. Candidate placement relative to browser-observed snapshots does not prove server input acceptance and is never used to pass acceptance. The original fail-closed M129 gates still own proof of proper buffered roll.

There are no browser input changes, replay retries, physics/combat constants, Rust/protocol changes, gameplay or production telemetry changes. The real input ingress could be delayed by WebDriver scheduling; subsequent corrective work must demonstrate true same-input acceptance and must not reclassify an idle roll as buffered.
