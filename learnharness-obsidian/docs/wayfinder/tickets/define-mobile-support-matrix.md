---
title: Define the MVP mobile support matrix
id: define-mobile-support-matrix
status: closed
parent: ../complete-learnharness-mvp.md
blocked_by: []
labels:
  - wayfinder:grilling
---

## Question

Which mobile platforms, OS-version range, and device form factors are part of the MVP support promise, and what physical-device evidence is sufficient for each? R09 requires desktop plus mobile including iOS, but does not name supported OS versions or a device matrix.

## Resolution (30 October 2026)

The user set the MVP floors to **iOS 15** and **Android 5.1**, on iOS and Android phones. These are the lower bounds to target, not permission to claim compatibility without testing. Before declaring support, run the plugin's learning, persistence, and restart flows on physical devices at both floors and record device, OS, Obsidian version, and results. If a floor cannot be validated, keep that platform's support claim blocked and report the gap.

## Current platform facts

As checked 30 October 2026, Obsidian's public mobile changelog says its minimum iOS version increased to iOS 15 for Obsidian 1.13 Mobile. Obsidian's Android help page says Android 5.1 and above. These are host-app minimums, not verified LearnHarness plugin compatibility floors; this project must set its own tested support range. Obsidian's documented iOS Web Inspector workflow requires iOS 16.4+ and macOS, which is a debugging requirement rather than the app's minimum. Its developer documentation also warns that JavaScript regex lookbehind is only supported on iOS 16.4+.

Sources: [Obsidian 1.13 Mobile changelog](https://obsidian.md/changelog/2026-07-30-mobile-v1.13.4/), [Obsidian for Android](https://obsidian.md/help/android), [Obsidian mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development).

Physical-device evidence remains an acceptance task in R09. Obsidian's iOS inspector requires iOS 16.4+ and macOS; use another supported debugging path or a suitable device without raising the declared floor silently.

The plugin manifest now allows mobile installation so the selected platforms can be exercised. This is an installability setting only; no compatibility claim is made until the physical floor runs pass. The code still depends on upstream browser APIs such as `crypto.randomUUID` and `structuredClone`; verify those on the selected host versions as part of the device runs.
