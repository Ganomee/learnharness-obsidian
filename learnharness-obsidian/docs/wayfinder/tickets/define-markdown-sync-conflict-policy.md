---
title: Define Markdown persistence and sync conflict policy
id: define-markdown-sync-conflict-policy
status: in-progress
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

What canonical Markdown schema and application-level conflict protocol will preserve the complete native LearnHarness record and all plugin-owned persistent learning state across Obsidian Sync? The user requires cross-device resume after vault sync and a Markdown representation for persistent state. The current store writes JSON envelopes/backups, checks a local integer revision, and cannot coordinate devices that were offline or changed from the same prior revision.

The native `ChatRecord` includes exact Pi messages, tool call/result IDs and metadata, plan tree, settings, usage/extraction history, and timestamps. A rendered transcript by itself is lossy. Obsidian Sync merges Markdown text by default or can create conflict copies, but those behaviors do not understand session semantics.

Obsidian's current Sync documentation says Markdown conflicts are merged with diff-match-patch by default, which can create duplicate text/formatting; users can instead create a conflicted copy, but that choice is configured separately on each device. Non-Markdown files use last-modified-wins. Community plugin configuration is synced only when the relevant vault-configuration options are enabled. Therefore a Markdown extension alone is not a semantic merge protocol, and per-device settings cannot be assumed identical.

## Implementation decision (30 October 2026)

Implement immutable, versioned Vault Markdown snapshots as the canonical persisted session state. Each snapshot has YAML metadata, a readable transcript, and a fenced JSON block containing the exact native session envelope and `ChatRecord`; the canonical block supports a lossless round-trip of tool IDs, provider metadata, settings, and native message blocks. The API key remains memory-only and is excluded from Markdown.

Each snapshot has a unique ID and a parent snapshot ID rather than overwriting a shared session file. On open, scan for leaf snapshots. One leaf resumes directly; multiple leaves are shown as conflict choices. Branch selection writes a separate Markdown resolution record and never deletes the unselected snapshot. Divergent native histories are never text-merged or silently resolved with last-writer-wins. This preserves both branches, but does not provide a distributed lock: provider requests from multiple unsynced devices can each reserve from the same pre-sync budget. Keep the authorized one-time synthetic provider smoke on one device and wait for sync before handing off that session. A future global multi-device spend guarantee would require coordination beyond the Vault.

The active workspace session ID and the synthetic learner profile are view-local and are not persisted. The complete native `ChatRecord.settings` field, when present, is included in the canonical session block. Any setting that becomes a persistent plugin preference must be added to a Markdown representation before it is persisted.

The session store now mirrors legacy JSON backups into linked Markdown history, keeps the originals, and the branch picker implements explicit selection. Cross-device behavior still needs physical Obsidian Sync verification, including conflicted-copy mode and default Markdown merge behavior.

Relevant sources: `plugin/src/storage/session-store.ts`, `plugin/src/session-controller.ts`, `plugin/src/ui/learning-view.ts`, `upstream/learnharness/src/core/contracts/chat.ts`, `docs/requirements.md` R07/R15, [Obsidian Sync conflicts](https://obsidian.md/help/sync/troubleshoot), and [Sync settings](https://obsidian.md/help/sync/settings).
