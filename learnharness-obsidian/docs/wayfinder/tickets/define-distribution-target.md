---
title: Define the MVP distribution target
id: define-distribution-target
status: closed
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

What does “produce a distributable community plugin” mean for this MVP: a reproducible installable bundle with complete source/license notices, or a public Obsidian Community Plugins submission? Which licensing review must be complete before that target is accepted?

## Resolution (30 October 2026)

The user wants an installable GitHub distribution, preferably through BRAT, or otherwise manual installation from GitHub. A public Obsidian Community Plugins listing is not required for this MVP. The chosen release still needs reproducible `main.js`, `manifest.json`, and optional `styles.css` assets with aligned release/manifest versions, source notices, and a completed licensing review. Community listing remains a separate future target.

BRAT/release mechanics are researched in the [official BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md) and [Obsidian release documentation](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). The upstream is AGPL-3.0-only; combined-work distribution terms remain a release gate, not a resolved legal conclusion.
