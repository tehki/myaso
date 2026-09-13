# Retention Policy

myaso.io adopts the Coding Agent Policy v1.3 retention model.

- `EPHEMERAL`: project-scoped transient content defaults to a maximum 10-second post-use retention.
- `OPERATIONAL_METADATA`: metadata-only records default to 30 days and must not contain message/file/prompt/response bodies, secrets, raw media, or equivalent payload.
- `DURABLE_PROJECT_ARTIFACT`: intentionally persistent reviewed source, documentation, tests, specifications, approved configuration, and similar artifacts.
- `SECURITY_INCIDENT_HOLD`: narrow, owned, access-controlled, justified, and expiring/removable evidence only.

Deletion must be automatic where the runtime stores transient data. Deletion failure is a security/privacy event. Encryption does not authorize longer retention.

Any longer transient retention requires an explicit value/class, documented purpose, owner, minimum duration, access controls, and applicable legal/privacy/contract review.
