# Progress · 27 October 2026

## Completed baseline

- Derived requirements from user-supplied consolidated plan; deduplicated its repeated copy. Historical chat itself was not accessed.
- Inspected LearnHarness 0.3.8 and pinned revision `3dc88472eea41eed0d5e5f29c2f16f8d063c415b` as an unchanged submodule.
- Documented source-grounded critique, architecture boundaries and initial contract map.
- Created separate implementer/adversarial Git worktrees and ran a real independent challenge/regression/re-verification cycle.
- Imported original upstream pure modules into 10 passing deterministic contract tests.
- Independent first mutation pass detected 3/4 defects. Added empty-node-identity regression; independent enhanced pass detects 4/4. Integrator reran all four successfully.
- Original upstream phases/call-ID test subset passes 17 tests. Full upstream suite not installed/run.
- Created 18 demo notes, a canvas, native templates, daily-note setup, bookmarks and light/dark-compatible CSS. Validator passes JSON, IDs, links, headings and canvas references.
- Opened the real vault in an isolated Obsidian profile and verified Home, session navigation, embedded claims and canvas. See test results for runtime details.
- Added pin/hash guard and documented upgrade workflow. No candidate revision upgrade was performed.

## Completed embedded runtime milestone

- Built the original prober factory, original question tools, original turn runner/settlement, native persistence filtering, grading and answer construction into a browser-target bundle.
- Kept original prompt loading/discovery with embedded unmodified Markdown assets. Browser composition matches native-source composition byte-for-byte and in segment order.
- Verified invalid question retry, valid mixed-tool question stopping, pending state, placeholder filtering, answer identity and final reply preservation through JSON serialization and fresh-agent reconstruction.
- Added seven shell tests covering sandbox refusal, report write/read-back failures, runtime failures, duplicate invocation and unload-before-write. Total integration suite: 20 passing tests (10 pure contracts, 3 browser runtime, 7 shell).
- Independent runtime adversary detected 5/6 selected mutations initially. A dropped-final-reply survivor led to a regression; independent re-verification and integrator rerun detect all 6/6. Original 4/4 mutation checks still pass.
- Built and installed a desktop development plugin. User handled Obsidian's vault-trust prompt. Actual command ran inside desktop Obsidian, wrote/read back/opened a diagnostic report through the real Vault API. Evidence is checked in under `test-vault/95 Runtime proofs`.
- Completed one user-authorized DeepSeek Flash connectivity request with thinking disabled and 128-token output cap: 21 input tokens and 1 output token. Credential stayed outside the project and was not logged or embedded. This is separate from original-agent runtime testing.

## Interactive preview milestone

The interactive workspace now opens with a clearly scoped offline lesson on weighted rates. Its lesson card states outcomes, duration and scripted-provider limits; an in-session four-step indicator is derived from the original saved tool transcript, and a completed transfer check ends at a completion card with links to the worked vault notes and a new session. The original teacher's native plan graph now renders as a directed prerequisite DAG with an accessible list fallback. The Home and Quick start pages explain how to enter the workspace, complete the lesson and resume sessions. `npm.cmd test` passes 39/39 and build/install pass. The computer-use helper failed to initialize, so the updated UI was not opened in Obsidian during this continuation.

An opt-in synthetic AI learner role is now wired alongside the original DeepSeek-backed LearnHarness teacher. Each learner answer is a separate 512-token, no-retry request with only the goal, current question/options and user-defined learner profile; the original answer key/explanation is withheld. Choices are validated before using original answer/grading helpers. New mocked adapter tests exercise payload privacy, parsing, invalid-choice rejection and provider-error redaction. The live two-role simulation remains unverified because no API credential is available.

To seed a usable example knowledge base without presenting it as an API result, an assistant-authored synthetic learner/teacher role-play was added as `DEMO-002`. It records the equal-group-weighting misconception, conceptual clarification, limits, and a transfer check. New notes distinguish the average-of-groups target from the pooled-attempt target and derive the transfer calculation. The index and an Obsidian Canvas concept graph link those claims and derivations. Vault validation passes at 26 notes; graph connections remain hand-authored and are not extracted by the plugin.

Latest checks after adding AI learner role wiring and the knowledge-base seed: `npm.cmd test` 41/41, `npm.cmd run build`, `npm.cmd run install:dev`, `npm.cmd run validate:vault` (26 notes), and `git diff --check` passed. These are automated/local checks; no provider call or app UI operation succeeded in this turn.

The graph now has a dedicated Obsidian explorer command. It reads proposition and argument note frontmatter, derives premise → reasoning-chain → conclusion arrows, and displays a rotatable/zoomable 3D canvas with click selection and note navigation. The graph works locally without AI or an API key. An optional collapsed DeepSeek action can synthesize selected nodes and connected argument notes into a reviewable `80 Inbox` draft. This preserves the graph's proposition/chain distinction but does not implement the pinned upstream extractor/auditor/merger pipeline. The pinned upstream renderer is itself 2D; this PoC adds a 3D view. Added derivation tests; current suite is 43/43 and build, install, 26-note validation and diff checks pass. No UI or live provider call has been run.

## 2026-10-28 graph consolidation

The earlier separate 3D/synthesis explorer was removed. One LearnHarness **Global graph** view now presents the vault-wide note graph in an Obsidian-style 3D canvas, with derivation-depth planes, search, tag/attachment/orphan filters, color groups, white classic links/backlinks, colored sequence and derivation edges, arrows, text fade, node/link styling, force controls, animate, rotate/pan/zoom, note context actions, Local Graph focus/depth, and reasoning tooltips on hover. The generated statistics index hub was removed; the concept and dialogue notes remain directly connected. Synthesis and its provider request UI were removed. The Obsidian core Graph view remains separate because its canvas does not accept custom edge labels from plugins; the combined feature set is in the single LearnHarness global-style view. See current state in `PROJECT_STATUS.md`.

Uncommitted integration work now adds a mobile-oriented Obsidian learning view, a session controller around the original prober/turn settlement, a versioned Vault JSON session store with acknowledged snapshots and explicit recovery for malformed JSON, a scripted demo adapter, and a bounded DeepSeek Flash adapter using Obsidian's native HTTP request API. The UI renders original pending questions and submits answers through original parsing/grading helpers. No upstream files were changed.

The adapter writes each user input durably before starting the agent, records settled native messages after a turn, and keeps immutable prior snapshots for recovery. These are Vault API snapshots with read-back acknowledgement; they are not a crash-atomic transaction or cross-device compare-and-swap. Provider cancellation stops local waiting but cannot guarantee cancellation of an already-sent remote request.

Continuation verification: `npm.cmd test` passed 39/39; build, vault validation, upstream pin guard and mutation scripts passed (4/4 contract, 6/6 runtime, 3/3 teacher-cycle and 4/4 session-durability mutants detected). Desktop Obsidian v1.8.9 ran the offline UI through the original prober, assessment, automatic handoff, original teacher plan, prediction, teacher explanation, tagged check and grading; the transcript, plan and answers survived app reload. A separate deliberately malformed temporary test session was restored from its previous snapshot, and the damaged bytes were preserved in an incident file. Only the marked `test-vault` was written.

Successful `probe_done` now adds the original handoff marker, acknowledges it in Vault storage, then constructs the pinned original teacher. Original `plan_init` persists `PlanTree` on the native record; teacher quiz calls require and preserve `nodeId`. The scripted demo and controller test cover a prediction, explanatory teacher text, then a tagged check, without a network request. The desktop UI smoke predates this extended cycle and covered a single tagged quiz.

The new provider adapter has not run a live original-agent session. The plugin remains desktop-only: physical mobile compatibility is unverified. Vault snapshots are acknowledged by read-back but are not crash-atomic or cross-device CAS. Background research, filesystem access, jobs and graph services remain disabled without their host adapters. The current plan presentation is a readable ordered list, not the pinned persistent DAG window. See the central [project status](../PROJECT_STATUS.md) for the active queue.

Mobile source review found no direct Node.js/Electron imports, `process.platform` or `FileSystemAdapter` use in the preview. Session storage uses Obsidian Vault methods and provider transport uses Obsidian `requestUrl`; the view also includes a narrow-screen CSS breakpoint. Obsidian's [mobile development guidance](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development) confirms Node and Electron APIs are unavailable on mobile. Touch ergonomics, older mobile Web Crypto support, actual mobile Vault persistence and view restoration still need physical-device validation, so the manifest remains desktop-only.

## Next bounded milestone

Review mobile APIs and validate on physical devices before enabling mobile installation. Test the optional provider adapter only with a bounded, authorized original-agent run. Complete attribution and distribution review against the pinned source. Keep the central [project status](../PROJECT_STATUS.md) current as work advances.

## Unresolved gates

1. Live provider transport, prompt overrides, filesystem tools, graph/extraction and jobs need separate platform contracts. The DeepSeek adapter has not run a live original-agent session.
2. Vault writes are acknowledged by read-back and protected by prior snapshots, but are not crash-atomic or cross-device CAS.
3. Native session serialization versus editable Markdown views; authoritative representation and conflict handling.
4. Real desktop plugin behavior, physical mobile execution, packaging and upstream license/attribution review.
5. A real upstream candidate upgrade and compatibility report.

No background agent runner or cloud changes were introduced. One capped paid provider connectivity request ran with the user's authorization. Automated contracts and the Obsidian proof remain offline. Physical mobile support, full upstream typecheck/test suite and a candidate revision upgrade remain unverified.
