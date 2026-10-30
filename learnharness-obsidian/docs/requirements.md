# Requirements derived from the supplied plan

Source: user-provided consolidated project plan dated 27 October 2026, pasted twice identically in this conversation. The original historical chat was not retrieved. This document deduplicates that plan; it does not invent quotes from the chat.

Scope extension confirmed by the user on 30 October 2026: minimum mobile floors are iOS 15 and Android 5.1; cross-device sync with Markdown representations is required; the live original-agent smoke has a US$10 total ceiling; distribution must be installable from GitHub, preferably through BRAT. This adds R15 to the earlier R01-R14 baseline.

## Required behavior and evidence

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| R01 | Import original LearnHarness learning agents and orchestration; no parallel learning engine | Imports resolve to pinned source; adapter changes isolated and reviewed |
| R02 | Pin upstream; ordinary integration leaves source unchanged | Gitlink revision plus clean submodule diff |
| R03 | Start an Obsidian learning session | Real original agent initialized through plugin command |
| R04 | Original probing and interactive questions | Scripted provider drives original prober; answer/result identity preserved |
| R05 | Transition to teaching and render original plan | Successful probe result triggers correct agent; prerequisite direction/order retained |
| R06 | Continue adaptive conversation | Multiple deterministic original-agent turns, then one synthetic original-agent smoke only after separate authorization; hard aggregate spend cap of US$10 |
| R07 | Save and resume after Obsidian restart | Native messages, pending questions, tool IDs, plan, settings, graph references and relevant context survive |
| R08 | Use Vault API for persistent vault data | Real Obsidian integration tests, failure injection, no direct filesystem dependency in mobile bundle |
| R09 | Desktop plus iOS and Android phones | Browser bundle test, desktop smoke, and physical-device reports at the selected floors: iOS 15 and Android 5.1 |
| R10 | Produce installable GitHub plugin package | Reproducible build and GitHub release assets compatible with BRAT or documented manual install; declared support, notices, and licensing review |
| R11 | Compatibility before upstream upgrades | Candidate revision build, behavior/contracts and mutation regressions, report; no auto-release |
| R12 | Independent adversarial testing | Separate worktree; unchanged suite run against realistic defects; surviving cases repaired and rechecked |
| R13 | Persistent autonomous progress | Progress and test results distinguish executed, inspected, blocked, and planned |
| R14 | Disposable demo baseline here | Working vault with navigable fictional data and setup instructions |
| R15 | Cross-device persistence represented in Markdown | Plugin-owned durable learning/session state and settings have readable Markdown representations in the Vault; a session resumes on a second device after vault sync, preserving the R07 native fields. Conflicts must not silently discard either device's edits. Credentials/secrets are excluded from Markdown. |

## Constraints and preferences

Embedded runtime and no backend are preferred, contingent on evidence. Do not silently replace them with a backend or rewrite the engine to satisfy mobile. Under R15, Markdown is the required Vault representation for plugin-owned persistent state; its encoding must round-trip the exact native agent record rather than replacing it with transcript-only prose. Credentials/secrets must remain outside Markdown. Upstream currently exposes internal modules rather than a stable public integration SDK.

Implementer owns integration/tests/fixes; adversarial tester independently derives expected behavior from source and these requirements. Syntax errors and failed imports are infrastructure failures, not useful mutation detections. Full unattended two-agent orchestration is deferred.

## Deferred

Anki; custom graph visualization; new learner mastery model; replacing original graph logic; automatic proposition/argument extraction; embeddings/consolidation; new review modes; leech handling. The demo knowledge notes illustrate possible authoring only and do not bring those features into the MVP.

## Initial delivery scope

Workspace, pinned upstream, critique, contract map and challenged initial pure-module suite, plus a usable demo vault. R03–R10, R15, and an actual revision-upgrade trial remain later milestones. A baseline is not the completed learning MVP.
