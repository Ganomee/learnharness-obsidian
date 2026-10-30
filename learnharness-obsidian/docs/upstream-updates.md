# Upstream update procedure

This is a documented manual workflow with automated pin/behavior checks. No actual candidate upgrade or release has been verified yet.

1. Begin from a clean integration branch; record the currently reviewed pin and test results.
2. Create an isolated update branch/worktree; initialize its submodule. Fetch the original repository there and check out an explicit candidate commit (never floating `main` in a release).
3. Review upstream diffs in agent factories, prompts, tool schemas, native records, ports and dependency tree. Inventory added tools and UI/runtime requirements. Preserve the original upstream tree.
4. Run unchanged contract tests first. Run adversarial regressions. Record semantic changes and failures; do not weaken expectations merely to pass.
5. Run plugin build, real fake-provider agent integration, Vault recovery tests, desktop and physical-mobile checks once implemented. Their current absence blocks accepting a candidate as production-compatible.
6. Only after review, run `python scripts/record-upstream-pin.py` to record the candidate hashes. Review the lock and submodule diff, run `npm run check:upstream`, and attach a compatibility report.
7. Merge only an explicitly reviewed update. Passing a build or hash guard does not authorize release.

The pin guard deliberately fails if a candidate revision differs. Updating its lock is bookkeeping, not a compatibility test. Do not edit original upstream source to make an upgrade pass.
