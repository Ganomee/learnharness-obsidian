# Independent adversarial review

The subsequent embedded original-agent proof has a separate
[runtime adversarial report](runtime-adversarial-report.md), including a
second independently discovered persistence gap and its verified regression.

Date: 2026-10-27. Agent B, isolated `agent/adversarial` worktree.
Upstream pin: `3dc88472eea41eed0d5e5f29c2f16f8d063c415b`.

## Scope and method

Expectations were independently read from original `src/core/plan-tree.ts`,
`src/core/phases.ts`, `src/server/pi/call-ids.ts`, and project requirements.
Agent A's implementation was not treated as the correctness definition.
Agent A's unchanged suite was copied byte-for-byte into an OS temporary
directory together with original upstream `src`. Each mutation changed one
behavior in that copy; the pinned submodule was never modified.
Each mutant was independently restored before applying the next mutation.
Only assertion failures count as detection; syntax/import errors do not.

## Initial challenge

Baseline Agent A commit: `cea83ce` (cherry-picked as `a37ad8b` here).
All 9 tests passed against original source.
Test SHA256: `2797fc79b3dd5716101282062feefed60cf000ac728f6d2c55285656d29926f5`.

| Mutation | Behavioral violation | Result |
| --- | --- | --- |
| reversed-prerequisite | Store edge target as prerequisite and reverse edge direction | Detected by assertions |
| failed-probe-advances | Treat errored `probe_done` result as successful completion | Detected by assertions |
| settled-tool-result-unpaired | Preserve old result ID after remapping its call ID | Detected by assertions |
| empty-node-starts-teaching | Treat empty `nodeId` as valid teaching-node tag | Survived all 9 tests |

Initial detection: 3 of 4 selected mutations; one real coverage gap.
The survivor changes `.nodeId.length > 0` to `.nodeId.length >= 0` in the
shared `taggedNodeId` predicate. Both view/native phase folds would then
incorrectly transition from planning to teaching for an empty node tag.
The upstream contract requires a nonempty string; this is a boundary-value
behavior regression, not a syntax defect. It was sent to Agent A for a
regression test and independent re-verification.

Initial run evidence was saved at
`C:\Users\Ganomee\AppData\Local\Temp\lh-adversarial-ttkath9p`.
This temporary path is local evidence, not a portable artifact; use the
checked-in script below to regenerate the results.

## Regression and independent re-verification

Agent A added regression commit `6274dd6`: empty node identity must leave
the phase at planning for both quiz and explain, in view/native folds and
timeline, and must not move the teaching divider. Agent B cherry-picked the
commit and reran the same four mutations with the enhanced suite unchanged.

Correct pinned source: **10/10 tests pass**. All **4/4 selected mutants are
now detected by assertion failures**, including the previous survivor. Its
new failure is the intended one: `actual: 'teach', expected: 'plan'` in
`empty node identity cannot start teaching or move its divider`.
No import/syntax failure was counted. Upstream `git status --porcelain`
remained empty after the runs.

Enhanced suite SHA256:
`36882a30071bfd259ea3875a9242e1e2db169926a8e578e1fc0f9369dbb56961`.
Verification artifacts were saved at
`C:\Users\Ganomee\AppData\Local\Temp\lh-adversarial-qegcvgmf`.
This closes the demonstrated gap; it does not imply exhaustive coverage.

## Reproduce

From the integration repository after `npm ci`:

```powershell
python scripts/adversarial-check.py
```

Or pass an installed tsx CLI explicitly:

```powershell
python scripts/adversarial-check.py G:/AIStuff/learnharness-obsidian/node_modules/tsx/dist/cli.mjs
```

The script prints the temporary sandbox path, suite hash, and each result,
and saves TAP logs and `results.json` there. Exit 1 means surviving mutants;
exit 2 means invalid infrastructure failure. The reproduction script refuses
to run if source anchors drift rather than silently applying a wrong mutation.

## Runtime risks independently confirmed

- `teacher-agent.ts` composes prompts at module load. Its dependency
  `agent/prompt-segments.ts` imports `node:fs` and `node:path` and reads source
  assets synchronously. A mobile bundle needs a proven asset-loading seam.
- `config.ts` imports Node path/URL APIs and reads `process.env`.
- `models.ts` imports all provider catalogs plus ChatGPT/subscription bridges.
  A mock-engine test alone does not establish browser-safe import closure.
- Upstream `ChatStore` methods are synchronous; Obsidian Vault writes are
  asynchronous. The port signature cannot simply be implemented by returning
  promises without changing caller behavior. Hydration and durable flush
  ordering need an explicit tested boundary.
- Plan-tree comments retain references to removed mutation operations. The
  actual public exports are `emptyTree`, `createTree`, and `PlanTreeError`;
  comments alone cannot establish supported integration APIs.

## Limits

This challenge covers selected pure upstream contracts, not a complete agent
execution or an Obsidian adapter. It does not prove Vault API durability,
concurrent writes, power-loss recovery, live provider handling, UI behavior,
mobile compatibility, or an upstream upgrade. Detection rates measure these
chosen mutations only and are not proof of complete correctness.
