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

Satisfy requirements R01–R14 with evidence: preserve the pinned original LearnHarness behavior, complete the interactive Obsidian flow and Vault-backed restart recovery, verify desktop and physical mobile support, and produce a distributable plugin with compatibility and adversarial evidence.

## Notes

- Domain: integrating the pinned LearnHarness agent into an Obsidian community plugin.
- Read `AGENTS.md`, `PROJECT_STATUS.md`, `docs/requirements.md`, `docs/architecture.md`, and `docs/critique.md` before resolving tickets.
- Preserve upstream behavior and the pinned submodule. Do not create a parallel learner engine. Embedded runtime/no backend is preferred unless evidence leads to an explicit decision otherwise.
- Claims about live providers, durability, desktop, and mobile must match observed evidence. Provider runs require explicit authorization and a bounded data/request/cost envelope.
- The current `PROJECT_STATUS.md` objective is a starting point, not this destination. The requirements document defines the destination and its acceptance evidence.
- This is the local-Markdown tracker fallback because no issue tracker or repository remote was provided. See [the local tracker guide](README.md) for status and link conventions.
- The requested `domain-modeling` skill was not available in this environment. Run `/setup-matt-pocock-skills` to add the requested Wayfinder tooling and skill instructions; this map is kept reviewable locally in the meantime.

## Decisions so far

<!-- Closed decision tickets only. Each resolution lives in its ticket. -->

## Not yet specified

- Mobile runtime findings may expose platform-specific gaps or require a new decision about the embedded-runtime boundary.
- The bounded live-provider smoke may expose adapter-specific reliability gaps and further user-flow decisions.
- Distribution and licensing work depends on the distribution target selected in its ticket.
- The first upstream compatibility candidate and any follow-up gates depend on identifying a suitable candidate revision.
- Physical-device results may graduate additional acceptance decisions, especially around vault suspension and resume behavior.

## Out of scope

- Anki integration, a new mastery model, automatic proposition/argument extraction, embeddings, consolidation, new review modes, and leech handling are deferred by `docs/requirements.md`.
- Cross-device concurrent session editing and compare-and-swap guarantees are beyond R07 as written, which requires resume after Obsidian restart. Reopen this boundary only if a ticket resolution makes it necessary for the MVP.
- Full unattended multi-agent orchestration remains deferred.
