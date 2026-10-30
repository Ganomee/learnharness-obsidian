# LearnHarness Obsidian integration

Reuse pinned upstream learning behavior; do not rewrite prompts, grading, plans, or graph semantics.
Never edit upstream/learnharness during ordinary integration. Its AGENTS.md applies within that submodule.
Only test vault writes against test-vault or temporary directories, never personal vaults.
Clearly distinguish demo fixtures, imported upstream behavior, integration tests, and verified platform results.
Requirements and upstream source jointly define contracts; current adapter code is not the oracle.
Implementer and adversarial tester use separate Git worktrees. Tester must run unchanged tests against realistic behavioral mutations; never count syntax/import failures as detected mutations.
Do not claim complete agent execution, real Vault API behavior, mobile compatibility, or upstream-update validation without evidence.
Keep progress, limitations, and reproduction commands in docs. Do not commit credentials or runtime personal data.
