# Wayfinder local Markdown tracker

This folder is the temporary tracker for the MVP map while no issue tracker is connected.

## Files and links

- A map lives in this folder and has `labels: [wayfinder:map]`.
- Open decision tickets live in `tickets/` and have `status: open`, a relative `parent` link to their map, and a `blocked_by` list of relative ticket links.
- Keep ticket titles in links so a reader can identify the destination without an external issue ID.
- After a decision is resolved, record its outcome and evidence in the ticket, change its status, and add a short link under the map's “Decisions so far”.

## Working the map

Start from the map, then address the open decision tickets before implementation work. Re-evaluate the map after each decision and add newly exposed decisions as tickets. Keep research findings evidence-based and record source links or repository paths in the ticket. This folder does not provide automatic assignment, dependency enforcement, notifications, or ticket queries; use the links and status fields to navigate it.

## Current map

- [Complete LearnHarness Obsidian MVP](complete-learnharness-mvp.md)
- [Next steps toward the complete MVP](next-steps.md)
