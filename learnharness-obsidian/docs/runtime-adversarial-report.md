# Independent runtime challenge

Date: 2026-10-27. Agent B, isolated `agent/adversarial` worktree.
Pinned upstream: `3dc88472eea41eed0d5e5f29c2f16f8d063c415b`.

## Independent contract review

Reviewed original `teacher-agent.ts`, `tools.ts`, `tool-execute.ts`,
`native-messages.ts`, `pending.ts`, `turn-service.ts`, `prompt-segments.ts`,
`models.ts`, provider event logger, and filesystem tool imports.

Required behavior was derived before reviewing Agent A's proof:

- Invalid question authoring returns an error and retries within the turn.
- A valid question stops even in a mixed batch containing another tool.
- Original prober question tools are named `probe`/`recall`, not just `quiz`.
- Synthetic clean question results must not be persisted; real learner
  answers are native tool results paired with the call ID.
- Original settlement must remove request-only system chrome.
- JSON reconstruction must retain learner answers and completed replies.
- The browser prompt asset seam must preserve original composed text/order.
- Unsupported platform operations must fail closed, rather than report
  empty successful data. Injecting an engine does not itself prune imports.

Runtime blockers confirmed: filesystem prompt discovery at module import,
Node config/path/environment access, filesystem-backed learner tools,
provider logging, and eager provider-model imports. The proof handles these
with explicit build seams. It imports original learning factories, tool
validation, grading, native conversion, wire settlement, and persistence.
The original models module is replaced only with matching identity metadata
and an engine factory that throws unless a caller injects the fake engine.
This is a bounded proof seam, not a production provider implementation.

## Initial mutation challenge

Agent A runtime commit: `6e3c461`. Unchanged suite:
`plugin/tests/runtime-proof.test.ts`, 3 tests passing.
SHA256: `aa99e05d79053e85eba31cda9ffffa038f47efc2480dc3548eb2578a3c66d7c6`.

Each mutant was applied alone to a fresh copied source/build sandbox with
the same unmodified test suite. Actual upstream and installed dependencies
were not changed. Imports/syntax errors do not count as detection.

| Mutation | Intended violation | Initial result |
| --- | --- | --- |
| errored-question-stops | Stop on validation error instead of retrying | Detected by runtime contract guard |
| mixed-question-does-not-stop | Remove original finishTurn hook | Detected by runtime contract guard |
| placeholder-persisted | Save synthetic question result as a real answer | Detected by runtime contract guard |
| last-turn-message-dropped | Slice off final message during turn persistence | Survived all 3 tests |
| browser-prompt-corrupted | Add text to embedded source prompt assets | Detected by native/browser text assertion |
| unsupported-filesystem-silent | Return empty success for unknown filesystem operations | Detected by missing-exception assertion |

Initial result: **5/6 selected mutations detected**. The survivor changes
`turnMessages.slice(baseCount)` to `turnMessages.slice(baseCount, -1)`.
The first turn loses only an already-filtered placeholder, but the resumed
turn silently loses its final assistant reply. Existing tests established
answer preservation without checking that completed reply. Agent A received
the reproducible defect for a regression and independent re-verification.

Initial artifacts:
`C:\Users\Ganomee\AppData\Local\Temp\lh-runtime-adversarial-8s_jkb5d`.
These local logs are reproducible using the script below.

## Regression and independent re-verification

Agent A added `6596761`, an assertion that the exact scripted resumed
assistant reply persists once, remains the final message, and follows the
actual learner answer after another JSON roundtrip. Agent B cherry-picked
the regression and reran all six mutants with the enhanced suite unchanged.

Correct original source: **3/3 runtime tests pass**. **6/6 selected mutants
are now detected** by semantic contract guards or assertions. The previous
survivor fails the intended assertion: `completed resumed reply persists
exactly once`, `actual: 0`, `expected: 1`. No syntax/import failures counted.
Actual upstream `git status --porcelain` was empty after verification.

Enhanced suite SHA256:
`7b9f0bbd835b0489b26b2f2ff06c7a4cdc88a4ce8422aaa48e0cf156082e3b7d`.
Verification artifacts:
`C:\Users\Ganomee\AppData\Local\Temp\lh-runtime-adversarial-9zn1odqt`.
This closes the demonstrated gap, not all possible persistence defects.

## Reproduce

After `npm ci`, run:

```powershell
python scripts/adversarial-runtime-check.py
```

An optional installed-package directory can be passed as the first argument.
The script copies sources, runtime tests, fixtures, and build script into an
OS temporary directory; dependencies are linked for package resolution only.
It hashes the suite, verifies a passing baseline, changes one source anchor
per mutant, restores it, and records TAP logs plus `results.json`.
Exit 1 means survivors; exit 2 means invalid infrastructure failure.

## Obsidian shell review

Independently inspected root shell and reran its seven mocked Vault tests:
all seven passed. A substring marker gap found during review was corrected
to one exact frontmatter identity, shared with installation checks. Tests
reject suffixed, prose-only, and duplicate markers. Folder creation, report
creation, and read failures suppress success/open behavior; read-back
mismatch also fails. Unload/concurrent-run behavior is tested. This is
mocked call-order evidence, not proof of the actual Obsidian runtime.

## Limits

Browser VM excludes `process`, `Buffer`, and `require`, and the built bundle
has no remaining external imports. That establishes only this scripted
prober path and explicit supported seams. It does not prove live provider
transport, full probe-to-teacher orchestration, asynchronous durable session
storage, graph/background tools, prompt override support, mobile UI, or a
physical iOS/Android runtime. Native/browser prompt parity is checked for
the prober configuration. No real API requests or credentials are involved
in this deterministic suite. Selected mutation rates are not exhaustive
correctness guarantees.
