---
type: development-guide
---
# Run the original-agent proof

The desktop development plugin is installed and enabled in this disposable vault.

1. Open the command palette with Ctrl/Cmd+P.
2. Select **LearnHarness Lab: Run offline runtime proof**.
3. The original LearnHarness prober executes against a scripted fake provider. No external requests or keys are used.
4. The plugin saves a diagnostic report under `95 Runtime proofs`, reads it back through the Vault API and opens it.

## What this proves

Original question validation retries bad input, a valid question pauses the mixed-tool turn, temporary placeholders stay out of the saved native transcript, and a scripted learner answer survives serialization and original-agent reconstruction.

The independent tester found that dropping the final resumed reply initially escaped the tests. A regression now detects it; all six selected runtime mutations are caught. This is evidence for those checks, not exhaustive correctness.

## What comes next

Interactive questions, full probing-to-teaching orchestration, live provider support inside Obsidian, durable session recovery and physical mobile verification. The diagnostic note is not itself a resumable learning session.

[[95 Runtime proofs/2026-10-27T17-06-38-025Z-d968e16b|Open the verified desktop result]] · [[Home]]
