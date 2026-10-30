# Local distribution inventory

Reviewed 27 October 2026 from the current `plugin/dist/plugin-metafile.json` bundle input graph and `package-lock.json`. This is a factual inventory for release review, not a licensing conclusion.

## Pinned upstream

LearnHarness 0.3.8 by Amos Blomqvist is pinned at `3dc88472eea41eed0d5e5f29c2f16f8d063c415b`. Its package metadata declares `AGPL-3.0-only`. The development bundle and test-vault installer include the upstream `LICENSE` plus [`plugin/NOTICE.md`](../plugin/NOTICE.md); installed and built files had matching SHA-256 hashes.

## npm packages in the plugin bundle

The current esbuild metafile graph contains these npm packages. Identifiers below come from the corresponding lockfile package metadata.

| Package | Version | Declared license |
| --- | --- | --- |
| `@earendil-works/pi-agent-core` | 1.4.0 | MIT |
| `@earendil-works/pi-ai` | 1.4.0 | MIT |
| `@earendil-works/pi-telemetry` | 1.4.0 | MIT |
| `openai` | 7.19.0 | Apache-2.0 |
| `partial-json` | 0.1.7 | MIT |
| `path-browserify` | 1.0.1 | MIT |
| `typebox` | 1.3.27 | MIT |

The installed package folders for the three `@earendil-works` packages contain no standalone license text, although their package metadata declares MIT. Their shared monorepo's root MIT license is included in the plugin's third-party licenses folder, along with the four other bundled package license texts. The MIT text and each package's version/license metadata match the official [Pi v1.4.0 release snapshot](https://github.com/earendil-works/pi/tree/v1.4.0), whose tag resolves to commit `4a080252f06caf63a525d7873c5d94d3c23887e0`; the release [license text](https://raw.githubusercontent.com/earendil-works/pi/v1.4.0/LICENSE) is included. npm's package metadata has no `gitHead`, so this does not cryptographically attest the published tarballs to that tag. Each build checks the notice's package names, versions and declared licenses against the bundle graph, lockfile and installed package manifests, and verifies that each referenced license file exists. The notice text and obligation completeness still need human review after dependency/source changes. This does not establish all combined-work licensing or source obligations. Review integration code terms and complete upstream source obligations before publishing.

## Unavailable live-provider check

At this review, no `DEEPSEEK_API_KEY` is available in the process environment or local `.env` file. No live original-agent provider session was attempted in this continuation. The earlier one-request connectivity result remains connectivity-only evidence.
