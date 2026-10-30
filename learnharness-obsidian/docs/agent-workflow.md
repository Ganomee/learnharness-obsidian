# Implementer and adversarial workflow

Created worktrees:

| Role | Branch | Folder |
| --- | --- | --- |
| Integrator | master | `G:/AIStuff/learnharness-obsidian` |
| Agent A | agent/implementer | `G:/AIStuff/lh-implementer` |
| Agent B | agent/adversarial | `G:/AIStuff/lh-adversarial` |

Each worktree has its own pinned submodule checkout. After incorporating changes from the integration branch, run `git submodule update --init`. Worktrees intentionally do not share uncommitted edits. Integrate reviewed commits through cherry-pick; never overwrite another worktree's files.

A derives contracts from requirements plus original source, implements tests and reports exact results. B independently reads source, takes A's committed suite unchanged, and mutates isolated copied source in a temporary sandbox. B records survivors and hands back the smallest reproducible behavior change. A adds a regression against correct source. B reruns the identical mutation with the new unchanged suite and records whether it now fails for the intended assertion.

Do not count compilation/import failures. Do not change tests during a mutation run. Do not mutate the pinned submodule. Avoid personal vaults, credentials and live model calls in deterministic work. Update progress after each bounded milestone. No persistent unattended agent runner is installed by this baseline.
