# Third-party notices

The bundled npm package inventory is taken from the plugin build metafile. Versions and declared licenses come from `package-lock.json` and installed package metadata.

| Package | Version | Declared license | License text |
| --- | --- | --- | --- |
| `@earendil-works/pi-agent-core` | 1.4.0 | MIT | `THIRD_PARTY_LICENSES/earendil-works-pi-MIT.txt` |
| `@earendil-works/pi-ai` | 1.4.0 | MIT | `THIRD_PARTY_LICENSES/earendil-works-pi-MIT.txt` |
| `@earendil-works/pi-telemetry` | 1.4.0 | MIT | `THIRD_PARTY_LICENSES/earendil-works-pi-MIT.txt` |
| `openai` | 7.19.0 | Apache-2.0 | `THIRD_PARTY_LICENSES/openai-Apache-2.0.txt` |
| `partial-json` | 0.1.7 | MIT | `THIRD_PARTY_LICENSES/partial-json-MIT.txt` |
| `path-browserify` | 1.0.1 | MIT | `THIRD_PARTY_LICENSES/path-browserify-MIT.txt` |
| `typebox` | 1.3.27 | MIT | `THIRD_PARTY_LICENSES/typebox-MIT.txt` |

The three `@earendil-works` packages declare Mario Zechner as author and use the `earendil-works/pi` monorepo. Their published package folders omit license text. The included MIT text was checked against the monorepo's `v1.4.0` release snapshot (commit `4a080252f06caf63a525d7873c5d94d3c23887e0`), which contains all three packages at version 1.4.0 and the same MIT license. npm's package metadata does not publish a `gitHead`, so the match between the published tarballs and that tag is supported by matching version/repository metadata, not a recorded npm-to-Git commit attestation. The upstream LearnHarness license and provenance are provided separately in `LICENSE` and `NOTICE.md`.

This file records package provenance and bundled license texts. It is not a conclusion about the licensing of the combined plugin or a determination that every source-distribution obligation has been met.
