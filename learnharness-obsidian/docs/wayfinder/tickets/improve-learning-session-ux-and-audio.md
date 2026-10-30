---
title: Make the adaptive lesson path visible and voice input diagnosable
id: improve-learning-session-ux-and-audio
status: in_progress
parent: ../complete-learnharness-mvp.md
blocked_by: []
---

# Make the adaptive lesson path visible and voice input diagnosable

## Source review

Compared the Obsidian view with the pinned original lesson flow in `upstream/learnharness`: `phases.ts`, `contracts/plan.ts`, `question-dock.tsx`, `answered-card.tsx`, `plan-window.tsx`, `plan-block.tsx`, and `docs/teaching-methodology.md`. The original phase state comes from native transcript events; plan status reflects where the teacher has moved, not proof of learner mastery. Questions keep reasoning/confidence with the answer, and only tagged checks receive right/wrong feedback.

The old Obsidian UI showed demo-only milestones, plain transcript answers, raw math delimiters, and fixed plan styling. The old microphone path always chose the system device and exposed a generic capture failure.

## Acceptance checklist

- [x] Derive the adaptive three-phase progression from original transcript events, separate from scripted demo milestones.
- [x] Show answered probe count, graded check counts, and teacher-derived current/visited/upcoming plan status. Explain that visited is not a mastery score.
- [x] Render Obsidian Markdown/math in questions, options, and teacher replies. Show compact verdict/correct-choice/learner-reasoning/confidence feedback for graded checks; leave open responses ungraded.
- [x] Keep the pending question and response controls together; retain reasoning, confidence, dictation, and answer submission.
- [x] Enumerate input devices after permission, allow explicit input selection, and report device, permission, API, and busy-device errors with actionable details.
- [x] Cover progress, feedback, microphone selection, failure, and capture cleanup with targeted unit tests.
- [x] Run integration tests, build/pin guard, vault validation, harness install/launch, and inspect the rebuilt plugin in Obsidian.
- [x] Stop the false “teacher connected” UI claim; a stored key means ready, not connected.
- [ ] Verify automatic listening and live transcription with an actual Windows/RDP microphone and Deepgram credentials.

## Evidence — 30 October 2026

- Original flow walkthrough is recorded above. New progress derives from original `phaseAt3Lh`, `derivePlanStatusesLh`, and tagged quiz events.
- Obsidian 1.14.5 desktop UI was reloaded after install. The adaptive session showed step 1/3 and 0/3 probe answers; the active question, answer choices, and bra-ket/math notation rendered correctly. The capture UI reported: “No microphone input is available to Obsidian. Check the Windows/RDP microphone input device and retry.” No input device was available on this host, so acoustic detection/transcription was not verified.
- Opened the saved offline lesson in Obsidian and inspected a completed response: wrong and correct choices were distinct, reasoning stayed collapsible, and confidence remained visible. The scripted offline lesson displayed 4/4 milestones.
- `npm.cmd test`: 76/76 passing. `npm.cmd run build`: pass with pinned upstream guard. `npm.cmd run validate:vault`: 255 notes pass. `npm.cmd run harness:obsidian`: build, install, launch, and harness status pass.
- First launch of the isolated profile opens Obsidian's vault selector; selecting the marked `test-vault` opens the workspace. No “Vault not found” dialog appeared after removing the URI launch argument.

## Limits

No live DeepSeek or Deepgram request was made; a prior $10 ceiling was not authorization to run a provider smoke. No microphone endpoint was present to test actual speech. Physical mobile behavior, the RDP audio-redirection setting, and cross-device sync remain separate verification gates.
