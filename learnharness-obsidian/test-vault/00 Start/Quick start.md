---
type: guide
tags: [learnharness, quick-start]
---
# Start learning with LearnHarness

The main path is a live, adaptive conversation with the original LearnHarness prober and teacher. A separate fixed offline walkthrough is available for checking the Obsidian interface without a provider.

## Start a live adaptive lesson

1. In Obsidian, choose **LearnHarness Lab: Open learning workspace** from the command palette, or click the graduation-cap ribbon icon.
2. In **Settings → Community plugins → LearnHarness Lab**, connect two separate services: **Teacher · DeepSeek text model** creates questions and evaluates answers, while **Speech to text · Deepgram** transcribes microphone input. Select or create each key in Obsidian SecretStorage. The teacher key is required for an adaptive lesson; the Deepgram key is optional, and typing still works without it. Neither key is written into session Markdown.
3. In the workspace, choose **New session · choose teacher**. The default is **Adaptive LearnHarness teacher · DeepSeek**. Describe the topic, what you currently think, what feels unclear, and what you want to be able to do. Use **Speak your goal** if you prefer to talk.
4. The original LearnHarness prober starts by asking about your understanding. The original teacher uses your answers and reasoning to plan and adapt the next questions, explanations, and tasks. With Deepgram configured, opening a question starts local microphone voice detection automatically. The compact mic status shows when it is listening, finds your voice, transcribes, pauses or fails. Normal speech pauses keep the same connection. Speak naturally; the interim draft updates live and finalized words appear in the answer or reasoning field. You can pause, edit, and submit; submission waits briefly for the last transcript, and the teacher receives it only when you submit. To dictate the initial goal, press **Start voice** first.
5. Prediction prompts and checks help you retrieve and apply the idea. For a check after an explanation, open the question when you are ready. The teacher processes your answer and adjusts the lesson from the evidence.
6. Choose a saved session to resume it, including after restarting Obsidian. Session content and recovery state are stored as Markdown in this vault.

The live teacher sends learning-session content to DeepSeek when you start and continue a lesson. Deepgram receives voice audio only while local voice detection identifies speech; raw audio is not saved in the vault. Current Deepgram Nova-3 multilingual promotional pricing is about US$0.35 per audio hour, billed by audio duration; rates can change. See [Deepgram pricing](https://deepgram.com/pricing). Microphone access is requested by Obsidian, and you can always pause it or type instead. Without a Deepgram key, the existing host speech-recognition option may be available.

## Try the fixed offline walkthrough

1. In the workspace, change **Learning mode** to **Fixed scripted demo · offline**.
2. Start **Why averaging two rates can mislead**.
3. Answer the probe, review the plan, make a prediction, read the explanation, then try the transfer check.

This walkthrough is a fixed interface example. It does not adapt the lesson to your answers and does not use an AI learner roleplay.

## Explore the notes

1. Open [[20 Sessions/DEMO-001 - Why averages can mislead]]. This hand-written example is separate from interactive session records.
2. Open [[30 Plans/DEMO-001 - Plan]] and follow its prerequisites.
3. Read the linked proposition notes, then reveal the worked example in the session note.
4. Complete [[60 Reviews/DEMO - Session reflection]]. This records evidence, not an automatic mastery score.
5. Create a note in `20 Sessions`, insert the **Learning session** template, and fill in your topic. It is a manual note until an agent session creates its own Vault record.

Use **Daily notes: Open today's daily note** for a dated learning log. Every hand-written example is marked `DEMO` or `demo: true`.

## Explore the global graph

1. Run **LearnHarness Lab: Open global knowledge graph** from the command palette or click the git-fork ribbon icon.
2. Search notes and paths; toggle tags, attachments, orphans, arrows, and animation; create color groups; tune node/link appearance and force settings.
3. Drag to rotate in 3D, Shift-drag to pan, scroll to zoom, and hover a link to read its reasoning step. Click a note to center its Local Graph, adjust the depth, and choose **Back to global graph** to return.
4. Choose **3D depth levels** for stacked derivation planes or **Free 3D force layout**. White links show ordinary Obsidian links; teal sequence edges and purple derivation edges show LearnHarness relationships.

This is one LearnHarness global graph view with Obsidian-style controls, 3D depth layers and graph-specific reasoning hovers. Obsidian's built-in Global Graph remains a separate core view and cannot display LearnHarness custom edge text.

[[Home]]
