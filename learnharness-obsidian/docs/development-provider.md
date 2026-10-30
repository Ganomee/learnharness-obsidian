# Development provider

User preference: use the provided DeepSeek API key and a cheap model during development. Deterministic contracts stay offline.

On 27 October 2026, the official [pricing table](https://api-docs.deepseek.com/quick_start/pricing/) lists `deepseek-flash` as the cheaper current option. Development connectivity uses that model, explicitly disables thinking per the [thinking-mode guide](https://api-docs.deepseek.com/guides/thinking_mode/), caps output at 128 tokens, sends one synthetic arithmetic prompt and never retries automatically.

One actual connectivity request succeeded: 21 input tokens, 1 output token, requested/returned model `deepseek-flash`, answer matched `4`. This establishes provider/key connectivity only. It is not an original LearnHarness live-provider test and does not establish Obsidian transport, CORS or mobile behavior.

The supplied key file remains outside the repository. The shell read it into a child-process environment for this one request; the key was not printed, copied into a note, embedded in a bundle, or saved in project configuration. The sanitized result is in ignored `.dev/deepseek-smoke.json`.

The learner-facing Obsidian flow uses the original LearnHarness prober and teacher for adaptive sessions; the synthetic AI learner is not shown in that flow. It remains a separately tested adapter, not evidence of a user-and-teacher live session.

For a future bounded connectivity check, provide `DEEPSEEK_API_KEY` in the process environment and run `npm run smoke:deepseek`. Alternatively copy `.env.example` to ignored `.env` and use `node --env-file=.env scripts/deepseek-smoke.mjs`. Never commit keys. In Obsidian, select a key once in **Settings → Community plugins → LearnHarness Lab**. Obsidian SecretStorage holds the secret; plugin settings keep only its reference, and session Markdown never contains the key. The plugin's offline proof cannot initiate provider requests. This checkout currently has only `.env.example`, not a real `.env` file or process-level key.
