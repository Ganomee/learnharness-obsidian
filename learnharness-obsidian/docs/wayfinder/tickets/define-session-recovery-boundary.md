---
title: Define the MVP session recovery boundary
id: define-session-recovery-boundary
status: closed
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

Does the MVP promise lossless resume after an Obsidian restart on the same device, or does it also promise cross-device session synchronization and recovery from concurrent edits? R07 explicitly names restart recovery; the current storage bridge does not provide cross-device compare-and-swap.

## Resolution (30 October 2026)

The user expanded the MVP to require cross-device synchronization. All persistent plugin-owned learning/session state must have a Markdown representation in the Vault, and sessions must resume on another device after its vault sync completes. R07's native record fields remain lossless; this decision does not permit replacing original agent state with transcript-only prose.

The implementation now writes immutable Markdown snapshots under `LearnHarness/Sessions/<id>/`, including a readable transcript and a lossless canonical native-state block. Legacy JSON sessions are imported without deleting the originals. Conflicting snapshot leaves are preserved and exposed for explicit selection through the follow-up policy in [the Markdown sync ticket](define-markdown-sync-conflict-policy.md). Cross-device resume and conflict behavior still need Obsidian Sync verification. Credentials/secrets must not be serialized into Markdown.
