# myaso.io Policy Adoption

**Repository:** `tehki/myaso`  
**Adopted policy stack:** Coding Agent Constitution v1.3 / Policy v1.3 / Repository Governance v1.2 / Development Principles v1.6

## Precedence

The project uses the governing order defined by the Constitution and handbook:

1. applicable law / contractual obligation / authorized incident hold;
2. `CODING_AGENT_CONSTITUTION_v1.3.md`;
3. `CODING_AGENT_POLICY_v1.3.yaml`;
4. `REPOSITORY_GOVERNANCE_v1.2.yaml` for repository controls;
5. `CODING_AGENT_DEVELOPMENT_PRINCIPLES_SYSTEM_PROMPT_v1.6.md`;
6. myaso.io project-specific conventions and implementation details.

Lower layers may be stricter but must not silently weaken higher layers.

## Source provenance

The following user-provided source artifacts were processed for this adoption:

| Artifact | SHA-256 | Adoption |
|---|---|---|
| `CODING_AGENT_CONSTITUTION_v1.3.md` | `c76d3f9b921abdf750f338c73303b0cd1cb31fd998142f635a1a971925f12b5c` | adopted unchanged |
| `CODING_AGENT_DEVELOPMENT_PRINCIPLES_SYSTEM_PROMPT_v1.6.md` | `12314b7fc9a4cbb5e93d907ed5c613f29c4895f610356285cc88da52898bcb76` | adopted unchanged |
| `CODING_AGENT_POLICY_v1.3.yaml` | `0cba8b4f68c570f2830720b2c1285ea132ab563978fa3ad2c22e152ac76379ca` | adopted unchanged |
| `REPOSITORY_GOVERNANCE_v1.2.yaml` source profile | `ec221545c8a7a5e203bf081238faf8b8d0e151087a3c20011255b8bc74ee4859` | adapted to `tehki/myaso` repository paths and identity without weakening its applicable controls |

The repository-governance attachment explicitly identifies itself as a repository-specific profile and requires path/control review before cross-repository copying. The myaso.io copy therefore preserves the control model while replacing source-repository-only paths with myaso.io policy, CI, governance, and documentation paths.

## Activation state

This repository contains governance-as-code for the required `main` controls. Provider-side branch protection/ruleset enforcement remains a separate control-plane fact and must be independently verified before it is described as active.

## Development operating model

myaso.io follows the v1.6 fast execution kernel and the project method in `docs/DEVELOPMENT_METHOD.md`. The goal is faster safe delivery through less rediscovery, fewer duplicate validations, bounded authorization reuse, coherent work units, and explicit merge/runtime boundaries—not by removing controls.
