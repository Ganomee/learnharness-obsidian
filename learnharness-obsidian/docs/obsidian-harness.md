# Obsidian visual and functional harness

This harness treats the marked `test-vault` as a disposable integration target. It combines deterministic TypeScript tests, the existing browser graph harness, and a real Obsidian run that can be operated through Windows computer control.

## Prepare and launch

From this directory:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/obsidian-harness.ps1 -Mode all
```

The script builds the plugin, installs it only into the marked test vault, writes `.dev/obsidian-harness/run-manifest.json`, launches Obsidian with the isolated `.dev/obsidian-profile`, and prints a machine-readable status summary.

The manifest lists the commands, selectors, and scenarios intended for remote UI operation. The plugin exposes stable `data-lh-testid` and `data-lh-action` attributes so UI automation does not need to depend on translated labels or fragile coordinates.

## Real-Obsidian scenario matrix

1. Open `LearnHarness Lab: Open learning workspace`.
2. Confirm the offline landing state exposes the learning mode selector, saved-session selector, start action, and ready status.
3. Start the scripted demo.
4. Verify the four milestones: probe, teacher plan, prediction, and transfer check.
5. Answer each question through the visible controls and verify the transcript and revision status update.
6. Finish the lesson and verify the completion state.
7. Close/reopen the view or restart the isolated profile and select the saved session.
8. Confirm transcript, plan, progress, and pending question state are restored.
9. Open `LearnHarness Lab: Open global knowledge graph`.
10. Verify canvas visibility, search, filters, link-mode buttons, color groups, hover explanations, note opening, and narrow-window layout.
11. Run `LearnHarness Lab: Run offline runtime proof`.
12. Verify a report appears in `95 Runtime proofs` and that the report is opened only after Vault read-back succeeds.

## Automated layers

- `npm.cmd test`: contract, runtime, session, graph, adapter, and UI-model tests.
- `npm.cmd run visual:graph`: browser-level production graph view harness with screenshots and interaction assertions.
- `npm.cmd run build`: plugin bundle and distribution guards.
- `npm.cmd run validate:vault`: deterministic vault structure checks.
- `powershell -File scripts/obsidian-harness.ps1 -Mode status`: persisted artifact summary after a real Obsidian run.

The computer-operated layer is intentionally separate from the deterministic tests: it checks the actual Obsidian window, layout, focus, scrolling, command routing, view lifecycle, and Vault-backed behavior. It must run only against the disposable marked vault.

## Remote operation boundary

The harness is safe to drive remotely because it uses an isolated Obsidian profile and a disposable vault. Do not point it at a personal vault. Provider-backed DeepSeek scenarios remain opt-in and are excluded from the default harness because they can transmit lesson content and incur API charges.