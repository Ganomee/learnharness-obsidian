# Initial upstream contract map

Pinned source: `3dc88472eea41eed0d5e5f29c2f16f8d063c415b` (LearnHarness 0.3.8).
These tests import original upstream modules. No learning algorithm or prompt is copied.

| Boundary | Source | Observable contract | Baseline evidence |
| --- | --- | --- | --- |
| Plan construction | `src/core/plan-tree.ts` | Directed prerequisite edges, node order, version 1; no input aliasing; reject cycles, absent endpoints, duplicates, self-loops | Executed deterministic tests |
| Phase transitions | `src/core/phases.ts` | Probe completes on successful `probe_done` result; teaching begins at first node-tagged quiz or explain call after completion | Native and view fixture tests |
| Teaching presentation | `src/core/phases.ts` | Earlier plan step stays before teaching divider when both occur in one assistant message | Step-boundary test |
| Message identity | `src/server/pi/call-ids.ts` | Collisions mint unused IDs; streamed events and settled call/results agree; historical records remain untouched; retries use fresh identity epochs | Multi-event and multi-message tests |
| Agent initialization | `src/agent/teacher-agent.ts` | Original prober/teacher factories, prompt composition and injectable engine | Inspected only; not executed |
| Agent orchestration | `src/server/chat-handler.ts`, `src/server/pi/` | Complete turn lifecycle, question stopping and probe-to-teach reconstruction | Not yet tested by integration |
| Storage | `src/core/ports.ts`, `src/store/chats.ts` | Synchronous entity ports, native message preservation, future-version refusal, usage idempotency | Inspected only; Vault adapter pending |
| Runtime | Agent imports, prompt loader, config and server services | Desktop and mobile compatibility must be proved over real dependency closure | Not yet proved |

## Test provenance and limits

Expected values were derived from upstream implementation and its module comments, then aligned with the supplied requirements (preserve plans, messages, identity and phase behavior). Fixtures are protocol inputs rather than real agent-produced transcripts. Type-only imports erase at execution, so this slice needs only the workspace's `tsx`; the full upstream dependencies are not installed by this suite.

Run at repository root: `npm test`. In an isolated worktree without local dependencies: `node G:/AIStuff/learnharness-obsidian/node_modules/tsx/dist/cli.mjs --test plugin/tests/upstream-contracts.test.ts`.

Passing the original 10 tests establishes a narrow upstream behavioral baseline. Subsequent browser-original-agent and plugin-shell tests are documented in `runtime-proof.md`, `runtime-adversarial-report.md` and `test-results.md`. These extend evidence to one embedded prober interaction and actual diagnostic Vault writes; full provider support, durable session recovery and mobile verification remain pending. Mutation reports distinguish behavioral detections from infrastructure failures.

## Adversarial regression

Agent B demonstrated that changing `taggedNodeId` from `nodeId.length > 0` to `nodeId.length >= 0` survived the initial nine-test suite. An additional contract now checks empty node identity for both quiz and explain through the view fold, native fold, timeline, and teaching divider. The expected result follows upstream's explicit nonempty-string check: no teaching transition without an identified plan node. Independent mutation re-verification is recorded separately by Agent B.
