# Five-minute demo

This vault includes an offline example lesson, an open-topic DeepSeek teacher mode, and a separate set of hand-authored notes. The offline lesson is scripted; choose DeepSeek Flash to set any learning goal and let the original LearnHarness prober and teacher adapt the course to your answers.

## Try the interactive lesson

1. In Obsidian, choose **LearnHarness Lab: Open learning workspace** from the command palette, or click the graduation-cap ribbon icon.
2. Start **Why averaging two rates can mislead**. The preview runs the original LearnHarness prober and teacher with a deterministic local demo provider.
3. Answer the starting probe and include your reasoning. Review the saved two-step plan, make a prediction, read the teacher explanation, then answer the transfer check.
4. Watch the four-step progress indicator. The completion panel confirms the transcript, answers, confidence and plan are saved in this vault. Use **Open the lesson notes** for the linked reference or **Start another session** to begin again.
5. Reopen **Saved sessions** to resume a prior session. Session records and prior recovery snapshots are stored in this vault under `LearnHarness/`.

## Simulate both roles with DeepSeek

1. Choose **DeepSeek Flash · paid API** in the learning workspace and enter your key in the password field. It stays in memory only and clears when the view closes.
2. Set the **AI learner profile** to a synthetic student's current knowledge and likely misconception. Do not include personal student data.
3. Start a goal. DeepSeek Flash runs the original LearnHarness prober and teacher. When a question appears, choose **Let AI learner answer · 1 request**; a separate bounded request generates the student's answer, then the original teacher processes and grades it.
4. The synthetic learner request is limited to 512 output tokens with no retry. It receives the goal, current question/options and profile, but not the answer key or teacher explanation. The teacher request also sends the session to DeepSeek. Both roles use the same provider/model.
5. For your own session, answer a question by voice with **Speak answer** when the Obsidian browser supports speech recognition. It transcribes into the answer or reasoning field, may select a clearly matched choice, and keeps the words visible for review before submission. Speech recognition uses the browser's speech service and may send audio to that service; only its text transcript is sent to DeepSeek with your submitted learning session.

## Explore the notes

1. Open [[20 Sessions/DEMO-001 - Why averages can mislead]]. This is a hand-authored example, separate from the interactive session.
2. Open [[30 Plans/DEMO-001 - Plan]] and follow its prerequisites.
3. Read the linked proposition notes, then reveal the worked example in the session note.
4. Complete [[60 Reviews/DEMO - Session reflection]]. This records evidence, not an automatic mastery score.
5. Create a note in `20 Sessions`, insert the **Learning session** template, and fill in your topic. It is a manual note until an agent session creates its own Vault record.

Use **Daily notes: Open today's daily note** for a dated learning log. Every hand-authored example is marked `DEMO` or `demo: true`.

## Explore the global graph

1. Run **LearnHarness Lab: Open global knowledge graph** from the command palette or click the git-fork ribbon icon.
2. Search notes and paths; toggle tags, attachments, orphans, arrows, and animation; create color groups; tune node/link appearance and force settings.
3. Drag to rotate in 3D, Shift-drag to pan, scroll to zoom, and hover a link to read its reasoning step. Click a note to center its Local Graph, adjust the depth, and choose **Back to global graph** to return.
4. Choose **3D depth levels** for stacked derivation planes or **Free 3D force layout**. White links show ordinary Obsidian links; teal sequence edges and purple derivation edges show LearnHarness relationships.

This is one LearnHarness global graph view with Obsidian-style controls, 3D depth layers and graph-specific reasoning hovers. Obsidian's built-in Global Graph remains a separate core view and cannot display LearnHarness custom edge text.

[[Home]]
