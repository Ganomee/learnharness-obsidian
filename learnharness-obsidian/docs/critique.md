# Critique grounded in the pinned source

Inspected revision: `3dc88472eea41eed0d5e5f29c2f16f8d063c415b`, package version 0.3.8. These are engineering findings about this checkout, not promises about future upstream versions.

## Preserve the central separation

Keeping learning behavior upstream and putting Obsidian behind a narrow boundary is the right foundation for avoiding a second engine. Pinning, explicit contracts, worktree isolation and testing silent failures are useful controls. The plan correctly refuses to treat passing generated tests as sufficient evidence.

## Move runtime feasibility ahead of a large test investment

`src/agent/teacher-agent.ts` exports `createProberAgent`, `createTeacherAgent` and injectable engine options, which are promising seams. But it also composes prompts at module load. `src/agent/prompt-segments.ts` imports `node:fs` and `node:path`, and `config.ts` uses Node paths, URLs, `process.env` and source-relative assets. Provider model wiring also reaches subscription/ChatGPT bridges. Bundling the Next/Electron application wholesale is not a mobile strategy.

Run a small browser-target import/bundle experiment and mock-provider agent/tool execution before building a substantial UI. It should use original prompt bytes and original factories, not a scripted replacement agent. If safe build-time prompt loading and platform substitutions cannot stay thin and semantically equivalent, explicitly revisit an upstream-supported seam or backend option. Neither is implemented here.

## Resolve synchronous storage versus asynchronous Vault operations

`src/core/ports.ts` has synchronous entity methods; `src/store/chats.ts` uses synchronous filesystem reads/writes. Obsidian Vault operations are asynchronous. A drop-in method substitution is therefore insufficient. An initialized in-memory store plus ordered durable writes is a candidate, but would require a readiness barrier, explicit flush/commit boundary, failure propagation, cancellation and shutdown semantics. It is not an approved or proven adapter yet.

Do not report a successful turn until its required records have durable acknowledgements. Contract tests should cover interrupted writes, concurrent turns, out-of-order completion, restart mid-question, future-version refusal, and duplicate events. Mobile suspension and multiple-device edits need explicit policies before claiming recovery guarantees.

## Separate knowledge authoring from authoritative runtime state

Markdown alone does not automatically preserve ordered native messages, structured tool arguments/results, pending interactions, usage records, checkpoints and graph ledgers. Start by preserving native session state exactly and derive readable Markdown views. Do not support edits in both representations without a conflict/round-trip policy. The demo vault intentionally contains no purported native resumable record.

## Narrow the phrase “complete basic learning experience”

Question rendering, reasoning/confidence fields, invalid-input retries, streaming, cancellation and plan changes need a tool inventory tied to a revision. Original optional research/artifact/background tools may introduce further platform requirements. Mark each tool supported, intentionally disabled with visible behavior, or blocking. Unknown tools must not silently disappear. Preserve original graph semantics without implementing the deferred knowledge redesign.

## Strengthen evidence beyond mutation percentages

The initial suite targets a small pure-module slice, not all contracts. Mutation detections demonstrate specific checks; they do not prove learning fidelity or persistence. Keep a contract-to-test coverage table, surviving-defect artifacts, real runtime tests, and platform reports. Test inputs and mutation patches must remain inspectable. Upstream source comments can drift: actual exports and behavior decide observed contracts.

## Make the roadmap gates concrete

1. Pin and inspect original source; map reachable dependencies and tool protocol.
2. Challenge a narrow deterministic contract slice (this baseline).
3. Prove original agent + original tool under a fake provider in a browser-compatible plugin build.
4. Prove Vault persistence/recovery before exposing adaptive sessions as reliable.
5. Build the focused UI; verify desktop, then physical iOS/Android targets.
6. Trial a real revision upgrade with semantic checks, not just source hashes/build success.

The upstream package declares `AGPL-3.0-only`; retain license/attribution material and resolve the integration's distribution packaging before publishing. Provider credentials, request disclosures and cost controls also need a defined user flow before any live model execution.
