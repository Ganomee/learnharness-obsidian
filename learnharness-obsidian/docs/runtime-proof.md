# Original-agent embedded runtime proof

## What executes

`plugin/src/runtime-proof.ts` exports `runRuntimeProof(): Promise<JSON-serializable report>`. It imports the pinned original `createProberAgent`, original `probe` question tool (through its normal registry), original `runPiTurn`, `persistTurn`, grading, native answer constructors, pending-question detection, and model-facing conversion. It injects pi-ai's original deterministic faux provider. No external request or credential is involved.

The first fake response authors an invalid correct-answer value. Original validation returns a retryable error. The second fake response contains the original `send_to_user` plus `probe` tools in one batch. Original `finishTurn` stops after the valid question despite the ordinary tool result, a case single-question `terminate` would not establish. A Claude-shaped **fake model ID**, not a live Claude provider, enables upstream's existing output tool gate.

Original wire settlement removes system request chrome, then original `persistTurn` stamps IDs, retains errored tool results, and omits the synthetic valid-question placeholder. Original grading builds a correct answer; original `newAnswerResult` appends the actual learner answer with the same call ID. A JSON round trip simulates serialized reconstruction, a fresh original agent resumes, the provider receives the paired answer, and another original settlement preserves it. The fake synchronous store is in memory; this is not disk durability or Vault API testing.

## Browser platform boundary

`scripts/build-runtime.mjs` exports `runtimeBuildOptions(options)` and `buildRuntime(options)`. Callers may override `entryPoints`, `outfile`, `format` (including Obsidian CJS), `external: ['obsidian']`, or normal esbuild options. Default output is browser-target ESM at `plugin/dist/runtime-proof.mjs`; `npm run build:runtime` also writes the dependency metafile. Test-only `nativePlatform: true` keeps native filesystem/path modules for prompt parity.

These adaptations are explicit and isolated in the bundler, leaving the submodule unchanged:

| Seam | Adaptation | Refusal/limit |
| --- | --- | --- |
| `src/agent/models.ts` | Exact upstream package identity metadata, nested frozen objects; injected engine required | Automatic/live provider resolution throws. Provider catalogs and subscription bridges are excluded. |
| `config.ts` root expression | Replace exactly one repository-root expression with virtual `/learnharness`, or actual upstream root for native parity build | Build fails if the expression changes; original remaining config is retained. |
| `node:path` | `path-browserify` | Virtual paths only in proof; no home-directory traversal. |
| `node:fs` | Embed unmodified Markdown assets under their original relative paths; original discovery and composition functions still execute | Reads/listing restricted to embedded asset tree; known absent override files remain absent; unknown operations throw. No prompt discovery algorithm is copied. |
| `node:fs/promises`, `node:os` | Explicit throwing functions | Learner filesystem tools disabled through original generic filter; accidental invocation fails. |
| `node:crypto` | Throwing graph/extraction functions | Neither graph mutation nor extraction is implemented by the proof. Browser Web Crypto supplies native message IDs. |
| Environment | Compile-time empty `process.env` and browser platform | Prompt overrides, filesystem provider-event recording and environment credentials are unavailable. Original recorder takes its disabled path; its filesystem writes are also unsupported. This is not an environment-aware production build. |

The complete retained dependency closure is inspectable in the generated esbuild metafile. It includes the original agent/core/tool/turn modules, pi-agent-core, pi-ai faux/core utilities and TypeBox. Broad original imports still retain unsupported filesystem tool definitions; their registry entries are disabled, and underlying platform facilities refuse access. Unrecognized Node builtins fail the browser build rather than receiving permissive mocks. `Buffer` references in dormant original filesystem helpers do not establish those tools as supported.

## Verification

Run `npm test` and `npm run build:runtime` after `npm ci --ignore-scripts`.

`plugin/tests/runtime-proof.test.ts` builds an IIFE and executes it in a Node VM supplied browser-standard globals, with no `process`, `Buffer`, `require`, or `fetch`. It checks the actual native transcript and answer identity rather than trusting only a report flag. A second test compares browser prompt text byte-for-byte and segment order against original composition/discovery reading native source files. A third invokes unsupported filesystem/home/crypto/provider facilities and verifies explicit failures.

Passing this gate establishes one original prober interaction in a browser-target bundle, including a meaningful retry and resume. It does not establish complete probe-to-teacher orchestration, real provider support, Obsidian persistence, prompt overrides, graph/extraction facilities, or physical mobile compatibility. The root plugin can invoke the same export to verify this slice inside Obsidian.

Agent B's runtime challenge found that changing `persistTurn` to omit the final message survived the initial runtime assertions: the learner answer remained intact while the resumed reply vanished. A regression now verifies the known scripted reply appears exactly once, follows the actual learner answer, remains the last native record message, and survives an additional JSON round trip. Independent mutation outcomes are recorded in the adversarial report.

## Dependency audit

The initial development dependency audit reported two moderate findings through the pinned `obsidian@1.8.7` development package's `moment` dependency. Obsidian is external to the plugin bundle. No forced dependency update was applied as part of this runtime gate; review SDK version separately before distribution.
