---
title: Define the MVP session recovery boundary
id: define-session-recovery-boundary
status: open
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

Does the MVP promise lossless resume after an Obsidian restart on the same device, or does it also promise cross-device session synchronization and recovery from concurrent edits? R07 explicitly names restart recovery; the current storage bridge does not provide cross-device compare-and-swap.

Recommended direction: require lossless same-device restart recovery for all native session state named in R07, and document concurrent multi-device writes as unsupported. Define crash/write-failure recovery separately from sync unless evidence shows the MVP cannot meet its restart promise without that broader guarantee.
