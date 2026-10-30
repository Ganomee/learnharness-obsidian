# Development provider

User preference: use the provided DeepSeek API key and a cheap model during development. Deterministic contracts stay offline.

On 27 October 2026, the official [pricing table](https://api-docs.deepseek.com/quick_start/pricing/) lists `deepseek-flash` as the cheaper current option. Development connectivity uses that model, explicitly disables thinking per the [thinking-mode guide](https://api-docs.deepseek.com/guides/thinking_mode/), caps output at 128 tokens, sends one synthetic arithmetic prompt and never retries automatically.

One actual connectivity request succeeded: 21 input tokens, 1 output token, requested/returned model `deepseek-flash`, answer matched `4`. This establishes provider/key connectivity only. It is not an original LearnHarness live-provider test and does not establish Obsidian transport, CORS or mobile behavior.

The supplied key file remains outside the repository. The shell read it into a child-process environment for this one request; the key was not printed, copied into a note, embedded in a bundle, or saved in project configuration. The sanitized result is in ignored `.dev/deepseek-smoke.json`.

The learner-facing Obsidian flow uses the original LearnHarness prober and teacher for adaptive sessions; the synthetic AI learner is not shown in that flow. It remains a separately tested adapter, not evidence of a user-and-teacher live session.

## Speech-to-text provider

The teacher text model and microphone transcription are separate provider roles. **Teacher · DeepSeek text model** creates adaptive questions, explanations, and answer evaluations. **Speech to text · Deepgram** converts spoken goals, answers, and reasoning into editable text. Each role has its own selected Obsidian SecretStorage entry; settings persist only the secret IDs, while session Markdown contains neither key. The current implementation supports DeepSeek for teacher generation and Deepgram for transcription; adding another provider means implementing that role's adapter.

With a Deepgram key, local voice activity detection starts when a teacher question is open. Audio remains in the local audio pipeline until speech is detected, then speech frames go to Deepgram's live transcription WebSocket. Interim text is shown as a draft and finalized text is inserted into the answer/reasoning field. The teacher receives the submitted text only after the learner presses **Submit answer**. The initial goal uses an explicit **Enable live goal dictation** action. Pausing or leaving the view stops microphone capture; raw audio is not written to the vault. Microphone and live-provider operation have not yet been verified end to end in Obsidian.

Deepgram's pricing page currently lists a promotional Nova-3 multilingual streaming rate of about US$0.0058 per audio minute (about US$0.35 per hour); standard rates and promotions can change. See [Deepgram pricing](https://deepgram.com/pricing). No Deepgram or DeepSeek request was made while wiring the key and implementing this adapter.

For a future bounded connectivity check, provide `DEEPSEEK_API_KEY` in the process environment and run `npm run smoke:deepseek`. Alternatively copy `.env.example` to ignored `.env` and use `node --env-file=.env scripts/deepseek-smoke.mjs`. Never commit keys. In Obsidian, select a key once in **Settings → Community plugins → LearnHarness Lab**. Obsidian SecretStorage holds the secret; plugin settings keep only its reference, and session Markdown never contains the key. The plugin's offline proof cannot initiate provider requests. This checkout currently has only `.env.example`, not a real `.env` file or process-level key.
