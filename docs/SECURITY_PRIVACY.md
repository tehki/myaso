# Security and Privacy Baseline

myaso.io is deny-by-default and capability-scoped.

Core invariants:

- untrusted input is data, not authority;
- authentication and authorization precede protected side effects;
- secrets never enter source, logs, messages, screenshots, diagnostics, ordinary caches, or provenance records;
- TLS certificate and hostname verification are not disabled for convenience;
- privileged/destructive targets are re-verified immediately before execution;
- security failures fail closed;
- project data and capability do not cross project boundaries without an explicitly authorized flow;
- cryptographic claims must match verified implementation state;
- custom cryptography is prohibited; maintained standard libraries and constructions are required.

Security-sensitive changes receive FULL validation and the repository-governance review path.
