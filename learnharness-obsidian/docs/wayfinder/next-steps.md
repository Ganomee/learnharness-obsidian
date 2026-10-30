# Next steps toward the complete MVP

This is an execution plan derived from [`docs/requirements.md`](../requirements.md), the latest [`PROJECT_STATUS.md`](../PROJECT_STATUS.md), and [`docs/test-results.md`](../test-results.md). “Verified” below means the evidence listed in those files exists; each gate still needs a fresh evidence review before it is treated as release-ready.

## Initial evidence audit

This is a read-only classification of the current records, not a new test run or an independent re-review of every artifact.

| Requirement | Current evidence state | Next action |
| --- | --- | --- |
| R01 original engine integration | Partial: pinned-source contract/runtime proofs and imported original-agent flow are recorded. | Recheck import boundary and adapter-only changes when doing the final evidence pass. |
| R02 pinned upstream | Verified as a current pin guard: clean upstream source and reviewed hashes are reported. | Preserve the pin; this does not establish upgrade compatibility. |
| R03 start a session | Desktop Obsidian evidence reports the original prober initialized through the plugin. | Reproduce in the final release candidate. |
| R04 original probing | Desktop scripted flow records original probe questions, assessment, and handoff. | Confirm answer/result identity in final evidence bundle. |
| R05 teaching transition and plan | Desktop evidence records original teacher handoff, plan, and tagged quiz flow. | Confirm the full acceptance evidence and prerequisite ordering in final run. |
| R06 adaptive conversation | Existing offline scripted multi-turn flow is recorded; no live original-agent session is evidenced. Shared reservations persist in Markdown and the budget has offline unit/integration coverage. Unsynced devices cannot share atomic reservations. | Keep the one eventual smoke on one device, recheck pricing, and obtain separate authorization and a credential before any provider request. |
| R07 restart recovery | Transcript, answers, and plan survived desktop app reload; session mutation checks and malformed-snapshot recovery are recorded. | Preserve every named native field in the new Markdown representation and prove same-device restart after the storage redesign. |
| R08 Vault persistence | Vault API storage and desktop read-back are recorded; automated mocked shell/failure checks exist. | Close the reproducible real-Obsidian persistence/failure-injection and explicit mobile-bundle evidence gaps. |
| R09 desktop and mobile | Desktop/browser evidence exists; physical iOS/Android report is absent. Manifest now permits mobile installation but proves no compatibility. | User set floors at iOS 15 and Android 5.1; run physical plugin checks at both floors before declaring support. |
| R10 distributable plugin | Build/package and notices for upstream plus seven npm packages are recorded; combined-work licensing/distribution review remains open. Manifest now permits mobile installation, without a support claim. | User selected GitHub installation, preferably BRAT. Review the release workflow and finish source/license obligations before publishing assets. |
| R11 upgrade compatibility | No explicit candidate revision trial is recorded. | Select and assess a candidate using the documented manual procedure. |
| R12 adversarial testing | Historical independent worktree reports show selected contract mutants 4/4 and runtime mutants 6/6 detected after repairs; the sets are explicitly non-exhaustive. | After a reviewed integration baseline exists, run a fresh independent challenge against the unchanged current suite. |
| R13 persistent progress evidence | Project status, test results, runtime proofs, and adversarial reports exist. | Keep the status distinctions current through each remaining gate. |
| R14 disposable demo baseline | Fictional seeded vault, setup instructions, and structural validation are recorded. | Confirm clean reproduction and disposable reset path before final acceptance. |
| R15 Markdown cross-device persistence | Immutable Markdown snapshots now preserve readable transcript plus canonical native record; divergence is surfaced for explicit branch selection. Cross-device resume and actual Sync conflict behavior are not evidenced. | Verify migration and branch resolution, then test sequential resume and conflicts after real Obsidian Sync. |

## 0. Establish a reviewable repository baseline — complete

- The implementation baseline was staged as six focused commits and pushed to `origin/main`; latest published commit is `b3dcaa1` (`Package GitHub releases with licensing notices`).
- Root `.gitmodules` and the gitlink are configured at `learnharness-obsidian/upstream/learnharness`; `git submodule status` recognizes pinned revision `3dc8847`.
- The `lh-adversarial` and `lh-implementer` role snapshots were left untracked and excluded from the public baseline. A local Obsidian-generated `test-vault/.obsidian/core-plugins.json` is also untracked.
- Previous baseline verification before the latest UI work passed 60/60 integration tests, build, upstream pin check, 159-note vault validation, and the four selected adversarial suites. The 30 October adaptive-UX/audio implementation now has separate 76/76, build, vault, harness, and desktop-observation evidence in [`docs/test-results.md`](../test-results.md). Physical microphone, provider, and mobile checks remain open.

## 1. Record the accepted product decisions

The user has now selected:

- iOS 15 and Android 5.1 as mobile support floors, with physical validation at each floor.
- Cross-device session sync, with all persistent plugin-owned learning state represented in Vault Markdown.
- US$10 total spend maximum for one synthetic live smoke, requiring separate authorization before execution.
- GitHub installation, preferably with BRAT; a public Community Plugins listing is outside this MVP.

The Markdown schema/conflict decision is implemented locally and tracked in [the Markdown sync ticket](tickets/define-markdown-sync-conflict-policy.md). Distribution legal review, mobile evidence, and provider cap verification remain gates.

## 2. Reconcile existing evidence against each requirement

Build an R01–R15 evidence checklist from the acceptance column in [`docs/requirements.md`](../requirements.md). Carry forward the existing desktop scripted prober-to-teacher flow and restart evidence for R03–R07, while preserving their stated limits. In particular, check whether current checks demonstrate every R07 native-state field and R08's real Obsidian Vault behavior/failure injection; do not infer coverage from a successful demo alone. Record each item as verified, partial, blocked, or not started in the project status/evidence docs.

## 3. Complete the platform and live-session evidence

- R15/R07: verify migration of legacy JSON/backup history, preserve native records/settings across restart, and test sequential device handoff and conflicts without silently discarding a branch.
- R09: adaptive progress, Markdown question rendering, offline answer feedback, and the Windows/RDP no-device diagnostic have desktop evidence. Perform physical Windows/RDP microphone validation, then physical iOS 15 and Android 5.1 plugin runs. Record device, OS, Obsidian version, exact flows, and failures. Enable/claim mobile only after the floors pass.
- R06: offline tests cover shared worst-case reservations across provider paths, usage settlement and fail-closed policy checks. Before a live run, recheck pricing and obtain separate authorization and credential availability. Never put credentials or personal vault notes in the repo.
- R08: close gaps with reproducible real-Obsidian Vault API persistence/failure evidence and an explicit mobile bundle check.

## 4. Prove upgrade and adversarial gates

- R11: select an explicit upstream candidate revision, then follow [`docs/upstream-updates.md`](../upstream-updates.md): inspect semantic changes, run unchanged contracts and mutation regressions, attach a report, and do not auto-release. No candidate trial is currently evidenced.
- R12: use a genuinely isolated worktree/checkout and independent defect review. Run the unchanged suite against realistic defects, repair surviving cases on the integration side, then recheck. This needs usable Git history and a clean separation of roles.

## 5. Finish packaging and evidence handoff

- R10: produce a reproducible GitHub release with BRAT-compatible assets/versions or documented manual install; complete declared support, source notices, and licensing review. Public listing remains deferred.
- R13: update progress and test-result records with executed, inspected, blocked, and planned status after each gate.
- R14: preserve the disposable fictional demo vault and setup instructions as a separate baseline acceptance check; synthetic fixtures are not learner/provider evidence.

## Current blockers and boundaries

- The public implementation baseline is complete, but combined-work licensing review and a tagged GitHub/BRAT release are still open.
- The shared LearnHarness workspace contains no real `.env` or process `DEEPSEEK_API_KEY`; only `.env.example` is present. No provider credential was loaded into the plugin. The new SecretStorage setting needs verification, and a live session still needs a credential plus separate authorization.
- Budget behavior has offline test evidence but no live-billing evidence and cannot coordinate simultaneous use from unsynced devices.
- Physical mobile floor tests, verification of the shared provider spend cap, real Markdown session migration/sync/conflict behavior, an actual upstream candidate upgrade, and final combined-work licensing review remain open.
- The current preview is a useful starting point, not evidence that R01–R15 are all complete.
