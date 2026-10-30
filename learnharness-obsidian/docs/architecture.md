# Architecture baseline

## Boundaries

`Obsidian UI → compatibility adapter → original agent/orchestration`.
`original storage contracts → durability bridge → Obsidian Vault API`.

The original storage ports are synchronous. The session controller gives each original turn a private synchronous in-memory view, then brackets it with asynchronous Vault writes: persist input and acknowledge before agent execution, then persist and acknowledge the settled native record. The store now writes immutable Markdown snapshots with a readable transcript and fenced canonical native-state block. Local optimistic parent checks catch changes seen by the current Vault; immutable leaves preserve concurrent branches for explicit resolution. The store cannot coordinate devices that are offline from each other.

Upstream is a pinned Git submodule. Only integration code lives in `plugin/src`. No copied prompt, learner model, graph consolidation, or agent orchestration belongs there. Build-time asset substitutions must retain original prompt ordering and bytes and receive dedicated equivalence tests.

## Persistence design selected for MVP (implementation in progress)

The user requires plugin-owned persistent learning state and nonsecret settings to have a Vault Markdown representation and synchronize across devices (R15). The original `ChatRecord` stays lossless; a rendered transcript alone cannot reconstruct native tool calls, IDs/results, plan data, settings, and metadata. Immutable versioned Markdown snapshots contain a readable transcript and a fenced canonical native-state block. A unique snapshot ID and parent ID allow branch detection when devices continue from stale states. Preserve every branch and require explicit user resolution; never text-merge or silently choose last-writer-wins for divergent native records. The local implementation is present; sync behavior is not yet verified. Credentials remain outside the Vault.

Obsidian Sync's Markdown merge is text-based and may create duplicate text/formatting; its conflict-copy option is configured per device. The plugin therefore needs its own session-level branch handling. Knowledge graph semantics remain based on original graph identities, assertions and evidence rather than being rebuilt from backlinks. Markdown knowledge authoring beyond the plugin's own state remains deferred.

## Platform gate

Browser bundle now has no external runtime dependencies; the Obsidian CJS build externalizes only `obsidian`. The established runtime proof covers original prober creation, faux provider streaming, tools, validation retry, question stopping, prompt parity and serialized reconstruction. The session/UI path passed the local integration suite and desktop Obsidian offline probe → original teacher plan → tagged question, including reload recovery. Background jobs, filesystem tools and graph services are disabled because their host adapters are absent. The DeepSeek adapter has no live original-agent session evidence; the user set a US$10 total ceiling for one eventual synthetic run, which is not run authorization. Cancellation cannot retract a request already delivered to a provider.

The user selected iOS 15 and Android 5.1 as support floors. The manifest now allows mobile installation so those floors can be exercised, but physical plugin runs are still required before claiming compatibility. The target distribution is an installable GitHub release, preferably through BRAT; the public Community Plugins directory is deferred, while licensing review remains required.

## Current vault

Core notes, links, transclusions, templates, daily notes and canvas remain usable independently. The development plugin adds a manual offline proof command. A DeepSeek key was used only by a separate bounded CLI connectivity test, never by the plugin. Hand-authored examples and actual diagnostic evidence are visibly distinguished.
