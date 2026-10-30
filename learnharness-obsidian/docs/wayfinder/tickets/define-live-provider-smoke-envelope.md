---
title: Define the live-provider smoke envelope
id: define-live-provider-smoke-envelope
status: closed
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

What user disclosure, permitted lesson data, request/token ceiling, and spend ceiling must a live original-agent smoke test satisfy for R06? The current adapter has no end-to-end live-session evidence, and a credential is not currently available in this environment.

## Resolution (30 October 2026)

The user set a **US$10 maximum total spend for one eventual synthetic original-agent smoke**. This is a budget ceiling only and is not authorization to make the provider request. Use synthetic lesson content; disclose provider, payload class, and possible cost before any run; never send personal vault notes or credentials. No provider request may be made without separate explicit authorization.

The shared adapter and session ledger now reserve conservative worst-case cost before sending each original-agent or AI-learner request, record returned usage when authoritative, and retain reservations when usage is missing. The ledger is persisted with Markdown snapshots and fails closed when the reviewed price policy differs. The engine additionally caps output at 2,048 tokens, payload size at 120,000 characters, and timeouts at 45 seconds. Offline regression coverage passes, but the adapter has not been exercised against live billing. Obsidian Vault snapshots also cannot coordinate two offline devices; conduct the one authorized smoke on one device only and wait for sync before using that session elsewhere.

Before the smoke, verify the shared ledger offline, re-check official pricing, and obtain explicit authorization and a credential. The official [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/) is model-specific and may change; as checked 30 October 2026, `deepseek-flash` lists peak uncached input at $0.30/M tokens and output at $1.20/M tokens. Re-check it before any authorized run. R06 remains blocked until the cap is verified and a credential is available.
