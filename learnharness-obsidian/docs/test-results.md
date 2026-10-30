# Test results · 27 October 2026

Pinned LearnHarness: `3dc88472eea41eed0d5e5f29c2f16f8d063c415b`.

| Check | Executed result | Limits |
| --- | --- | --- |
| `npm.cmd test` | 20/20 passing | 10 pure contracts, 3 browser runtime tests, 7 mocked Vault shell tests; not the full learning MVP |
| `npm.cmd run build` | Desktop CJS plugin builds; only `obsidian` external | Explicit unsupported platform facilities; manifest remains desktop-only |
| `node node_modules/tsx/dist/cli.mjs --test upstream/learnharness/tests/phases.test.ts upstream/learnharness/tests/call-ids.test.ts` | 17/17 passing | Only these two original test files |
| `python scripts/adversarial-check.py` | Correct source passes; 4/4 selected mutants assertion-detected | Narrow mutation set, not exhaustive |
| `python scripts/adversarial-runtime-check.py` | Correct runtime suite passes; 6/6 selected mutants behavior-detected after regression | Initial 5/6 survivor was dropped final resumed reply; see independent report |
| `npm.cmd run check:upstream` | Pin, clean checkout and source hashes match | Not semantic upgrade validation |
| `npm.cmd run validate:vault` | Baseline plus runtime guide/report; JSON, IDs, links, headings and canvas references pass | Structural checks, not mobile runtime evidence |
| Desktop vault smoke | Opened `test-vault` in real Obsidian; Home properties/callout/table/backlinks rendered; followed session link; embedded claims resolved; six-card canvas rendered | Native core vault, not a plugin test |
| Actual desktop plugin command | Original prober proof completed; report created, read back and opened through Vault API | In-memory session fixture; report persistence is not session durability |
| DeepSeek Flash connectivity | One real request, 21 input + 1 output tokens, thinking disabled, expected answer matched | Provider connectivity only; no original-agent live test |

The first launch using the existing Obsidian profile did not produce a usable window. Only the processes started by this task were stopped. A separate ignored profile under `.dev/obsidian-profile` with `--disable-gpu` successfully opened the vault. That profile runs installed Obsidian **v1.8.9**, observed in both chooser and vault title. The user's usual profile has a downloaded update but was not upgraded or reconfigured. This workaround establishes the vault smoke result, not a diagnosis of the ordinary profile's startup issue.

Independent review details, exact mutations, test hashes and initial survivor are in [adversarial-report.md](adversarial-report.md). Integrator's rerun saved TAP and JSON in `C:/Users/Ganomee/AppData/Local/Temp/lh-adversarial-up_aw9p8`; temporary evidence can be regenerated with the checked-in script.

Agent A also attempted the original `plan-tree.test.ts`, whose import reaches an uninstalled `typebox` dependency. That import failure is not a behavioral defect or a passing upstream test. Original pure plan construction is covered by the integration's contract slice.

Runtime mutation integrator rerun evidence: `C:/Users/Ganomee/AppData/Local/Temp/lh-runtime-adversarial-3qyqku9_`. Initial-contract rerun: `C:/Users/Ganomee/AppData/Local/Temp/lh-adversarial-2kr9ripu`. Scripts regenerate these temporary artifacts.

The browser VM has no `process`, `Buffer`, `require` or `fetch`. Prompt text/segment order are compared against original native-file composition. Unsupported file, OS, graph-crypto and automatic provider facilities throw. Original submodule remains clean. Browser-target ESM and desktop Obsidian CJS builds both execute the proof slice.

Actual desktop evidence: `test-vault/95 Runtime proofs/2026-10-27T17-06-38-025Z-d968e16b.md` was created by the running plugin command and visibly opened. User handled the security trust prompt. The vault window initially reported v1.8.9; the isolated profile later automatically loaded its downloaded v1.14.5 app package (profile log), while the window title continued reporting v1.8.9. No claim of testing two independently controlled app versions is made.

Still not executed: full upstream suite/typecheck, physical mobile-device tests, original-agent live-provider run, actual upstream revision upgrade. The separate Flash connectivity request does not establish those gates. Controller/storage durability contracts and recovery are exercised by local tests and the desktop recovery smoke, but they are not crash-atomic or cross-device compare-and-swap.

## Interactive preview continuation

| Check | Executed result | Limits |
| --- | --- | --- |
| `npm.cmd test` | 43/43 passing | Includes mocked AI learner and knowledge-graph derivation checks; not the full upstream suite |
| `npm.cmd run build` | Pass; only `obsidian` external | Does not establish physical mobile support |
| `npm.cmd run validate:vault` | 26 notes pass structural validation | Includes the synthetic role-play knowledge base and concept canvas; not a platform runtime test |
| `npm.cmd run check:upstream` | Clean pinned revision and reviewed hashes | Pin guard only; no upgrade validation |
| `python scripts/adversarial-check.py` | Baseline passes; 4/4 selected mutations detected | Narrow initial contract mutation set |
| `python scripts/adversarial-runtime-check.py` | Baseline passes; 6/6 selected mutations detected | Narrow original-agent runtime mutation set |
| Desktop UI in Obsidian v1.8.9 | Scripted original-agent exercise completed probe assessment, automatic teacher handoff, persisted plan, accepted plan, graded a tagged teacher quiz, and preserved transcript and plan on app reload | Offline provider only; background jobs/filesystem/graph tools disabled; desktop runtime only |
| Controller teacher-cycle test | Offline demo creates a tagged prediction, persists teacher explanation text, then creates and grades a tagged check | Controller contract test, not a broad integration or provider-adaptation test |
| `python scripts/adversarial-teacher-check.py` | Unmutated controller baseline passes; 3/3 targeted teacher-cycle mutations are assertion-detected | Mutations run against copied source in ignored `.dev/`; narrow set, not exhaustive |
| `python scripts/adversarial-session-check.py` | Controller and storage baselines pass; 4/4 write-ahead, stale-write, backup-recovery and final-acknowledgement mutations are detected | Mutations run against copied source in ignored `.dev/`; narrow set, not exhaustive |
| Package provenance and local install | `plugin/NOTICE.md` identifies pinned LearnHarness 0.3.8 provenance and AGPL-3.0-only; build and test-vault install both include matching `NOTICE.md` and upstream `LICENSE` hashes | Does not determine terms for integration code or dependencies, or approve distribution |
| Current plugin bundle package inventory | 7 bundled npm packages identified from esbuild metafile; notice table versions/licenses are checked against package-lock during every build; corresponding MIT/Apache-2.0 texts are packaged | Notice table must still be reviewed for obligation completeness after dependency/source changes; combined-work release review remains open |
| Desktop UI in Obsidian v1.8.9, refreshed plugin | Completed the prediction, teacher explanation and tagged check sequence; transcript and plan at revision 11 remained after app reload | Offline scripted provider; desktop only |
| Explicit recovery in desktop UI | Restored separate malformed test session from acknowledged revision 1 and retained corrupt bytes under its incident snapshot folder | Recovery falls back to the latest retained revision; does not make writes crash-atomic |

All desktop UI operations wrote only within the marked `test-vault`. Provider adapter live session, physical mobile, full upstream suite/typecheck and candidate upstream upgrade remain unverified. Detailed ongoing work is tracked in [PROJECT_STATUS.md](../PROJECT_STATUS.md).

The current process environment and local `.env` contain no DeepSeek credential, so no original-agent provider request was attempted during the latest continuation. The prior one-request smoke remains connectivity-only evidence.

A Windows GitHub Actions workflow is checked in for these baseline checks. It has not been pushed or executed on hosted CI.
