---
title: Complete LearnHarness Obsidian MVP
id: complete-learnharness-mvp
status: open
tracker: local-markdown
labels:
  - wayfinder:map
---

# Complete LearnHarness Obsidian MVP

## Destination

Satisfy requirements R01–R15 with evidence: preserve the pinned original LearnHarness behavior, complete the interactive Obsidian flow, persist plugin-owned learning state and nonsecret settings as Markdown that resumes across synced devices, verify desktop and physical mobile support, and produce a GitHub-installable plugin with compatibility and adversarial evidence.

## Notes

- Domain: integrating the pinned LearnHarness agent into an Obsidian community plugin.
- Read `AGENTS.md`, `PROJECT_STATUS.md`, `docs/requirements.md`, `docs/architecture.md`, and `docs/critique.md` before resolving tickets.
- Preserve upstream behavior and the pinned submodule. Do not create a parallel learner engine. Embedded runtime/no backend is preferred unless evidence leads to an explicit decision otherwise.
- Claims about live providers, durability, desktop, and mobile must match observed evidence. Provider runs require explicit authorization and a bounded data/request/cost envelope.
- The current `PROJECT_STATUS.md` objective is a starting point, not this destination. The requirements document defines the destination and its acceptance evidence.
- This remains a local-Markdown tracker because no issue tracker is connected. The public GitHub repository exists and contains the Wayfinder map commit; the integration baseline has not yet been published. See [the local tracker guide](README.md) for status and link conventions.
- The requested `domain-modeling` skill was not available in this environment. Run `/setup-matt-pocock-skills` to add the requested Wayfinder tooling and skill instructions; this map is kept reviewable locally in the meantime.

## Decisions so far

<!-- Closed decision tickets only. Each resolution lives in its ticket. -->

- [Mobile support floor](tickets/define-mobile-support-matrix.md): iOS 15 and Android 5.1, with physical plugin validation required at those floors.
- [Restart and sync scope](tickets/define-session-recovery-boundary.md): cross-device sync is in scope; persistent learning/session state needs a Markdown representation.
- [Live smoke cost ceiling](tickets/define-live-provider-smoke-envelope.md): US$10 maximum total spend for one eventual synthetic original-agent smoke; this is not authorization to run it.
- [Distribution target](tickets/define-distribution-target.md): install from GitHub, preferably through BRAT; public Community Plugins listing is not required for the MVP.

## Not yet specified

- Mobile runtime findings may expose platform-specific gaps or require a new decision about the embedded-runtime boundary.
- The bounded live-provider smoke may expose adapter-specific reliability gaps and further user-flow decisions.
- The Markdown source-of-truth and explicit branch policy are implemented locally; cross-device Sync behavior remains to be verified in [the sync protocol ticket](tickets/define-markdown-sync-conflict-policy.md).
- Combined-work licensing and source-obligation review remains open even though the GitHub install target is selected.
- The first upstream compatibility candidate and any follow-up gates depend on identifying a suitable candidate revision.
- Physical-device results may graduate additional acceptance decisions, especially around vault suspension and resume behavior.

## Out of scope

- Anki integration, a new mastery model, automatic proposition/argument extraction, embeddings, consolidation, new review modes, and leech handling are deferred by `docs/requirements.md`.
- Public Obsidian Community Plugins listing is deferred; GitHub/BRAT installation and distribution review remain in scope.
- Credentials/secrets are not to be stored in Markdown or synchronized as Vault content.
- Full unattended multi-agent orchestration remains deferred.
