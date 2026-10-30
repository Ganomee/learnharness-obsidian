# LearnHarness × Obsidian

A development preview for integrating original LearnHarness learning behavior into Obsidian. The plugin now has an interactive learning view, an offline scripted exercise through the original prober and teacher, an optional bounded DeepSeek Flash adapter, and Vault-backed session snapshots. A full teaching curriculum, production readiness, and physical mobile support are not complete or verified. The demo notes also work independently with core Obsidian features.

## Open the baseline

In Obsidian choose **Open folder as vault** and select `G:\AIStuff\learnharness-obsidian\test-vault`, then open `Home`. Follow its five-minute demo. No community plugins or provider keys are needed.

The vault was also opened and checked in an isolated development profile. To reopen that profile, run `powershell -File scripts/open-vault.ps1` from this folder. It uses the installed Obsidian executable with GPU disabled and keeps profile data in ignored `.dev/`, separate from your usual profile.

The 18 fictional baseline notes demonstrate a goal, probe question, manual answer, prerequisite plan, embedded claims, reasoning, and reflection. The canvas links the workflow. Templates and Daily notes are configured. A separate runtime guide and an actual desktop proof report document the executed integration slice. Demo proposition notes preview deferred knowledge features; they are not an implemented graph adapter.

## Run the development plugin

```powershell
npm.cmd run build
npm.cmd run install:dev
```

The installer targets only this repository's marked `test-vault`. After loading the plugin in Obsidian, run **LearnHarness Lab: Run offline runtime proof** from the command palette. It uses the original prober, tools, turn settlement and native answer helpers with pi-ai's deterministic faux provider. It writes a diagnostic note under `95 Runtime proofs` through the Vault API and reads it back before announcing success. No key or provider request is involved. The user enabled the local plugin in this development vault; trust prompts must be handled by the user on other fresh installations.

The interactive preview opens with **LearnHarness Lab: Open learning workspace** or the graduation-cap ribbon button. Its scripted demo is offline and exercises the original prober, teacher plan, prediction, explanation and tagged check. DeepSeek Flash mode accepts any learning goal, probes current understanding, builds a prerequisite-ordered teacher plan, then changes instruction and follow-up questions in response to your answers. Enter a key for the current view only. Pending answers can be spoken with **Speak answer** where the host browser supports speech recognition; review the transcript before submitting. Browser speech recognition may use an external speech service. At pending questions, **Let AI learner answer** adds one bounded request that sends the lesson goal, current question/options and a configurable synthetic learner profile without the answer key; the original LearnHarness teacher then evaluates the simulated answer. Both roles use DeepSeek Flash. Sessions are stored as immutable Markdown snapshots under `LearnHarness/Sessions/<session-id>/`; each snapshot contains a readable transcript and a fenced canonical block preserving the native record. Divergent synced branches are kept and require explicit selection. The shared session ledger reserves worst-case cost before provider requests and is also stored in Markdown. Provider actions remain subject to the current reviewed pricing policy; do not use multiple unsynced devices for provider calls. The **Open global knowledge graph** command opens one Obsidian-style vault-wide 3D graph with prerequisite ancestry, stable topic lanes, search, tag/attachment/orphan filters, color groups, arrows, local graph depth, force controls, white classic links, colored learning derivations and reasoning text on hover. The separate synthesis explorer and generated index hub were removed; graph exploration needs no provider key. Physical mobile support remains unverified.

## Install from GitHub

The public repository is `Ganomee/learnharness-obsidian`. The intended release path is a semantic-version tag matching `plugin/manifest.json`; the GitHub Actions workflow builds a BRAT-compatible release with `main.js`, `manifest.json`, and `styles.css`, plus notices and a manual-install ZIP. A release has not been published yet. Until the source and combined-work license obligations are reviewed, treat this as a development project and do not install an unreviewed release into a personal vault.

After a reviewed release exists, BRAT can track `Ganomee/learnharness-obsidian`. Manual installation uses the release's plugin assets in `.obsidian/plugins/learnharness-lab/`. Fresh vault installations still require the user to trust and enable the plugin in Obsidian.

The plugin bundle includes upstream LearnHarness components and prompt assets. See [NOTICE](plugin/NOTICE.md), the included upstream `LICENSE`, and [third-party notices and license texts](plugin/THIRD_PARTY_NOTICES.md). Distribution terms for integration code and the combined work still need review before release.

See [runtime proof](docs/runtime-proof.md), [independent runtime challenge](docs/runtime-adversarial-report.md), [development provider](docs/development-provider.md) and [progress](docs/progress.md). The in-plugin DeepSeek adapter is new development work and has not yet been verified end to end. A separate one-request DeepSeek Flash connectivity check succeeded; that check did not exercise the plugin adapter.

## Reproduce checks

```powershell
git submodule update --init
npm.cmd ci --ignore-scripts
npm.cmd test
npm.cmd run build
npm.cmd run check:upstream
npm.cmd run validate:vault
python scripts/adversarial-check.py
python scripts/adversarial-runtime-check.py
python scripts/adversarial-teacher-check.py
python scripts/adversarial-session-check.py
```

Python 3 and Node.js are needed for these development checks. `scripts/create-baseline.py` created the demo once and refuses overwrites; it is not a reset command. Do not run mutation tests against a personal vault or the original submodule.

## Workspace

- `upstream/learnharness`: pinned Git submodule, original code unchanged.
- `plugin/tests`: pure upstream contracts, original-agent browser proof, and mocked Vault shell tests.
- `plugin/src`: original-agent proof, interactive preview, session controller, Vault snapshot store and provider adapters; see the central status for current platform and provider gates.
- `test-vault`: disposable, functioning Obsidian notes and configuration.
- `docs`: requirements, critique, architecture, contracts, progress and test evidence.
- `scripts`: pin guard, vault validator and adversarial reproduction, including teacher-cycle and session-durability challenges.

Separate Git worktrees: `../lh-implementer` (`agent/implementer`) and `../lh-adversarial` (`agent/adversarial`). See [agent workflow](docs/agent-workflow.md).

Start with [project status](PROJECT_STATUS.md), [critique](docs/critique.md), and [requirements](docs/requirements.md). `PROJECT_STATUS.md` is the central progress record. No credentials or personal vault contents are included. Live provider checks are separate opt-in commands; normal tests and the desktop proof remain offline.
