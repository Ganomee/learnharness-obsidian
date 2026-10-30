---
title: Define the live-provider smoke envelope
id: define-live-provider-smoke-envelope
status: open
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

What user disclosure, permitted lesson data, request/token ceiling, and spend ceiling must a live original-agent smoke test satisfy for R06? The current adapter has no end-to-end live-session evidence, and a credential is not currently available in this environment.

Recommended direction: use synthetic lesson content only; disclose the provider, data sent, and possible cost before the run; set a hard request/token ceiling and an explicit maximum spend; never send personal vault notes or credentials. Resolve the exact caps before asking for a credential or running the smoke test.
