# Development provider

User preference: use the provided DeepSeek API key and a cheap model during development. Deterministic contracts stay offline.

On 27 October 2026, the official [pricing table](https://api-docs.deepseek.com/quick_start/pricing/) lists `deepseek-flash` as the cheaper current option. Development connectivity uses that model, explicitly disables thinking per the [thinking-mode guide](https://api-docs.deepseek.com/guides/thinking_mode/), caps output at 128 tokens, sends one synthetic arithmetic prompt and never retries automatically.

One actual connectivity request succeeded: 21 input tokens, 1 output token, requested/returned model `deepseek-flash`, answer matched `4`. This establishes provider/key connectivity only. It is not an original LearnHarness live-provider test and does not establish Obsidian transport, CORS or mobile behavior.

The supplied key file remains outside the repository. The shell read it into a child-process environment for this one request; the key was not printed, copied into a note, embedded in a bundle, or saved in project configuration. The sanitized result is in ignored `.dev/deepseek-smoke.json`.

The interactive preview also supports a synthetic AI learner. Set a learner profile in the view, start a DeepSeek session as the original teacher, and use **Let AI learner answer** on a pending question. This makes one extra DeepSeek Flash request with a 512-token cap and no retries. Its prompt includes the lesson goal, current question/context/options and learner profile; it excludes the committed answer and teacher explanation. The returned choice is validated against the options before being passed to the original LearnHarness answer and grading helpers. The live two-role flow has not yet been run; no provider key is currently configured in the development environment.

For future runs, provide `DEEPSEEK_API_KEY` in the process environment and run `npm run smoke:deepseek`. Alternatively copy `.env.example` to ignored `.env` and use `node --env-file=.env scripts/deepseek-smoke.mjs`. Never commit keys. The plugin's offline proof contains no credential loading and cannot initiate provider requests.
