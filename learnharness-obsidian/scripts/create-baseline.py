"""Create the checked-in, fictional demo vault. Refuses to overwrite existing files."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
VAULT = ROOT / 'test-vault'

notes = {
'Home.md': '''---
type: dashboard
tags: [learnharness, demo]
---
# LearnHarness · Learning lab

> [!info] Working vault · integration under development
> These are fictional, editable examples. No AI provider, adaptive agent, or automatic scheduling is connected. Your existing personal vault is untouched.

## Start here
1. Open [[00 Start/Quick start]] and try the five-minute demo.
2. Follow [[20 Sessions/DEMO-001 - Why averages can mislead]]: question → answer → plan → explanation.
3. Record a new session using [[90 Templates/Learning session]].

## Your learning desk
| Area | Open |
| --- | --- |
| Goals | [[10 Goals/Understand weighted averages]] |
| Current session | [[20 Sessions/DEMO-001 - Why averages can mislead]] |
| Learning plan | [[30 Plans/DEMO-001 - Plan]] |
| Knowledge | [[40 Knowledge/Knowledge index]] |
| Reflection | [[60 Reviews/DEMO - Session reflection]] |
| Project state | [[00 Start/Project status]] |

## Inbox
- [ ] Complete the example question before opening its answer.
- [ ] Create a session for a topic you actually want to understand.
- [ ] Compare your reasoning before and after studying.

## Find your way
Use Ctrl/Cmd+O to open notes, search to find text, backlinks to trace evidence, and Graph view to explore links. Templates, Daily notes, Canvas, and Bookmarks are core Obsidian features enabled for this vault.

[[Learning map.canvas|Open the learning map]] · [[00 Start/Working agreement]] · [[00 Start/Requirements]]
''',
'00 Start/Quick start.md': '''# Five-minute demo

This baseline works with core Obsidian features; it needs no community plugin or API key.

1. Open [[20 Sessions/DEMO-001 - Why averages can mislead]]. Read the goal and write your answer under **Your attempt**, without opening the answer callout.
2. Open [[30 Plans/DEMO-001 - Plan]]. Follow the prerequisites in order.
3. Read the two proposition notes linked from the plan. Return to the question and reveal the worked example.
4. Complete [[60 Reviews/DEMO - Session reflection]]. This records evidence, not an automatic mastery score.
5. Create a new note in `20 Sessions`, run **Templates: Insert template**, and choose **Learning session**. Fill in your topic and goal. This is a manual session until the agent integration passes its gates.

Use **Daily notes: Open today's daily note** for a dated learning log. All demo notes have a DEMO label or `demo: true`. Do not confuse the worked example with an actual LearnHarness-generated session.

[[Home]]
''',
'00 Start/Project status.md': '''# Project status

## Available now
- A standalone Obsidian vault with internal links, templates, daily notes, canvas, and example learning material.
- A pinned, unmodified LearnHarness submodule in the parent development workspace.
- A repository for contracts and independently challenged tests.

## Not implemented
- An Obsidian LearnHarness plugin, real probing/teaching, provider configuration, automatic plan creation, or session recovery.
- Mobile runtime verification and real upstream upgrade validation.
- Anki, consolidation, or graph extraction.

The examples demonstrate navigation and data organization. They do not demonstrate the agent runtime. See `../docs/progress.md` from the repository (outside the vault) for verified engineering results.

[[00 Start/Requirements]] · [[00 Start/Working agreement]] · [[Home]]
''',
'00 Start/Requirements.md': '''# Requirements baseline

Source: the project plan supplied by the user on 27 October 2026. The original chat was not retrieved; this is a requirements summary, not a transcript.

LearnHarness owns learning behavior. Obsidian supplies the interface and knowledge environment. Import original modules through a thin compatibility adapter, pin the upstream revision, and preserve the upstream tree.

The eventual MVP must start a session, probe understanding, render questions and answers, transition to teaching, display the original plan, adapt through conversation, and resume after restart. It must ship as an Obsidian plugin with desktop and physical-mobile evidence.

Contracts come before the chat UI. An independent tester challenges unchanged tests with realistic behavioral mutations. Markdown knowledge views must not discard native session/tool state.

The current vault is the first baseline deliverable. Anki, new graph semantics, custom mastery scores, and advanced consolidation remain deferred.

[[00 Start/Project status]] · [[Home]]
''',
'00 Start/Working agreement.md': '''---
id: learnharness-disposable-vault
type: development-sandbox
---
# Working agreement

- This vault is disposable demo data. Use it for integration tests, never your personal notes.
- Upstream learning logic remains upstream. Demo explanations are hand-authored fixtures, not an alternative engine.
- Preserve session IDs, ordered native messages, tool-call/result IDs, and plan dependencies when adding persistence.
- Keep native session state lossless. Markdown transcripts will be derived views until a reversible representation is proven.
- Do not put provider keys in notes or Git. Provider setup and credential storage remain a later design gate.
- Mark generated content and human evidence separately. Never infer understanding from a page visit or checkbox.
- No background requests or API charges are enabled in this baseline.

[[Home]]
''',
'10 Goals/Understand weighted averages.md': '''---
id: demo-goal-weighted-averages
type: learning-goal
demo: true
status: active
---
# Understand weighted averages

Explain when an average of averages fails, calculate a combined rate using group sizes, and justify the weights in a new example.

## Success evidence
- [ ] Predict a combined rate before calculating.
- [ ] Explain why the larger group contributes more.
- [ ] Solve an unfamiliar example without a formula prompt.

Session: [[20 Sessions/DEMO-001 - Why averages can mislead]]
Plan: [[30 Plans/DEMO-001 - Plan]]
''',
'20 Sessions/DEMO-001 - Why averages can mislead.md': '''---
id: demo-session-001
type: learning-session
demo: true
status: manual-example
goal: "[[10 Goals/Understand weighted averages]]"
---
# DEMO-001 · Why averages can mislead

> [!warning] Hand-authored demo
> This illustrates the intended experience. It is not an executed LearnHarness session or a resumable native session record.

## Goal
[[10 Goals/Understand weighted averages]]

## Probe question
Group A has 1 success out of 2 attempts (50%). Group B has 9 successes out of 10 attempts (90%). Is the overall success rate 70%? Explain your reasoning.

### Your attempt
Write your prediction, reasoning, uncertainty, and confidence here before revealing the example.

> [!example]- Reveal the worked example
> There are 10 successes among 12 attempts, so the combined rate is 10/12 = 83⅓%. Averaging 50% and 90% gives equal weight to unequal groups. The weights should be 2/12 and 10/12. The result is closer to 90% because the larger group supplies more attempts.

## Example probe evidence
Fictional learner: “I averaged the two percentages because there are two groups.” This suggests investigating the denominator before introducing the general formula. It does not establish a mastery rating.

## Plan
[[30 Plans/DEMO-001 - Plan]]

## Teaching notes
![[40 Knowledge/P001 - A rate has a denominator#Claim]]

![[40 Knowledge/P002 - Combined rates require group weights#Claim]]

Reasoning: [[50 Arguments/A001 - Deriving a combined rate]]

## Transfer question
A group has 3 successes in 5 attempts and another has 7 in 15. What is the combined rate? Why?

> [!example]- Check after attempting
> (3 + 7) / (5 + 15) = 50%. Each attempt has equal weight; each group does not.

## Reflection
[[60 Reviews/DEMO - Session reflection]]
''',
'30 Plans/DEMO-001 - Plan.md': '''---
id: demo-plan-001
type: learning-plan
demo: true
---
# DEMO-001 · Plan

This is a hand-authored reading order, not a serialized LearnHarness plan.

| Step | Prerequisite | Activity | Evidence |
| --- | --- | --- | --- |
| 1. Identify the denominator | None | [[40 Knowledge/P001 - A rate has a denominator]] | Name numerator and denominator |
| 2. Combine counts | Step 1 | [[50 Arguments/A001 - Deriving a combined rate]] | Explain why counts add |
| 3. Recover weighted form | Steps 1 and 2 | [[40 Knowledge/P002 - Combined rates require group weights]] | Justify weights |
| 4. Transfer | Step 3 | [[20 Sessions/DEMO-001 - Why averages can mislead#Transfer question]] | Solve without prompting |

Completion checkboxes are planning aids, not automatic evidence of understanding.

[[10 Goals/Understand weighted averages]] · [[Home]]
''',
'40 Knowledge/Knowledge index.md': '''# Knowledge index

These proposition/argument examples preview the deferred knowledge design. They are not wired into LearnHarness graph extraction.

- [[40 Knowledge/P001 - A rate has a denominator]]
- [[40 Knowledge/P002 - Combined rates require group weights]]
- [[50 Arguments/A001 - Deriving a combined rate]]

The session embeds claims instead of repeating their text. Backlinks lead to the original example and reasoning.

[[Home]]
''',
'40 Knowledge/P001 - A rate has a denominator.md': '''---
id: demo-p001
type: proposition
demo: true
source: "[[20 Sessions/DEMO-001 - Why averages can mislead]]"
---
# A rate has a denominator

## Claim
A success rate is the number of successes divided by the number of attempts; the denominator determines how many observations the rate represents.

## Example
50% can mean 1/2 or 500/1000. Equal rates can summarize very different amounts of data.

## Connections
Supports [[40 Knowledge/P002 - Combined rates require group weights]] through [[50 Arguments/A001 - Deriving a combined rate]].
''',
'40 Knowledge/P002 - Combined rates require group weights.md': '''---
id: demo-p002
type: proposition
demo: true
source: "[[20 Sessions/DEMO-001 - Why averages can mislead]]"
---
# Combined rates require group weights

## Claim
For disjoint groups measured on the same basis, the combined success rate is total successes divided by total attempts, equivalently the weighted average of group rates using attempt counts as weights.

## Conditions
Groups must not double-count attempts. Rates must measure the same outcome. Total attempts must be positive.

## Reasoning
[[50 Arguments/A001 - Deriving a combined rate]]
Prerequisite: [[40 Knowledge/P001 - A rate has a denominator]].
''',
'50 Arguments/A001 - Deriving a combined rate.md': '''---
id: demo-a001
type: argument
demo: true
premise_ids: [demo-p001]
conclusion_ids: [demo-p002]
---
# Deriving a combined rate

Premise: [[40 Knowledge/P001 - A rate has a denominator]]
Conclusion: [[40 Knowledge/P002 - Combined rates require group weights]]

For disjoint groups, successes and attempts each add. If group i has nᵢ attempts and rate rᵢ, its successes are nᵢrᵢ. The combined rate is therefore Σ(nᵢrᵢ)/Σnᵢ. This equals Σ(wᵢrᵢ) for wᵢ = nᵢ/Σnᵢ.

This explains why averaging group rates directly only works generally when group sizes are equal.

Source context: [[20 Sessions/DEMO-001 - Why averages can mislead]]
''',
'60 Reviews/DEMO - Session reflection.md': '''---
id: demo-review-001
type: reflection
demo: true
---
# Session reflection

Session: [[20 Sessions/DEMO-001 - Why averages can mislead]]

## Before
What did you predict? What reasoning made that prediction plausible?

## After
Explain the role of the denominator without looking at the notes.

## Transfer evidence
Record your attempt at the transfer question, including any hints used.

## Next session
What remains uncertain? Pick a date manually; no scheduler is running.

[[Home]]
''',
'70 Daily/2026-10-27.md': '''---
type: daily-log
demo: true
---
# 2026-10-27 · Learning lab baseline

- Created a disposable workspace for LearnHarness integration.
- Demo topic: [[10 Goals/Understand weighted averages]].
- Next engineering gate: contracts challenged independently, then a real agent/tool interaction in an embedded runtime.

[[Home]]
''',
'80 Inbox/Capture.md': '''# Capture

Put questions or source ideas here. Move an item into a learning goal when you can state what understanding would look like.

- [ ] My next learning question:

[[Home]]
''',
'90 Templates/Learning session.md': '''---
type: learning-session
status: draft
created: "{{date}} {{time}}"
---
# {{title}}

## Goal
What do I want to explain or do by the end?

## Starting understanding
My prediction, reasoning, uncertainty, and confidence:

## Questions and answers
Record the question, my original answer, and feedback separately.

## Plan
List prerequisites and link a plan note.

## Learning notes
Link claims and their sources. Preserve conditions and uncertainty.

## Transfer evidence
A new example, my answer, and hints used:

## Next step

[[Home]]
''',
'90 Templates/Daily learning log.md': '''---
type: daily-log
created: "{{date}}"
---
# {{date}}

## Learning intention

## Sessions

## Evidence and open questions

## Next step

[[Home]]
''',
'90 Templates/Proposition.md': '''---
type: proposition
status: draft
created: "{{date}}"
---
# {{title}}

## Claim

## Conditions and counterexamples

## Source and evidence

## Connections

[[40 Knowledge/Knowledge index]]
'''
}

def write(relative, text):
    path = VAULT / relative
    if path.exists():
        raise SystemExit(f'Refusing to overwrite {path}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')

for relative, content in notes.items():
    write(relative, content)

configs = {
'app.json': {'alwaysUpdateLinks': True, 'newFileLocation': 'folder', 'newFileFolderPath': '80 Inbox', 'attachmentFolderPath': '99 Attachments'},
'appearance.json': {'accentColor': '#59b6ab', 'enabledCssSnippets': ['learning-lab']},
'core-plugins.json': ['file-explorer', 'global-search', 'switcher', 'graph', 'backlink', 'outgoing-link', 'tag-pane', 'properties', 'page-preview', 'daily-notes', 'templates', 'note-composer', 'command-palette', 'bookmarks', 'outline', 'word-count', 'file-recovery', 'canvas'],
'templates.json': {'folder': '90 Templates', 'dateFormat': 'YYYY-MM-DD', 'timeFormat': 'HH:mm'},
'daily-notes.json': {'folder': '70 Daily', 'template': '90 Templates/Daily learning log', 'format': 'YYYY-MM-DD'},
'bookmarks.json': {'items': [{'type':'file', 'ctime':1793059200000, 'path':'Home.md', 'title':'Learning desk'}, {'type':'file','ctime':1793059200000,'path':'00 Start/Quick start.md','title':'Five-minute demo'}]},
'community-plugins.json': []
}
for name, value in configs.items():
    write('.obsidian/' + name, json.dumps(value, indent=2) + '\n')
write('.obsidian/snippets/learning-lab.css', '''/* Uses Obsidian theme variables; works in light and dark modes. */
.markdown-preview-view { --h1-color: var(--text-accent); --h2-color: var(--text-normal); }
.markdown-preview-view .callout { border-radius: 10px; }
.markdown-preview-view table { width: 100%; }
.markdown-preview-view h1 { letter-spacing: -0.025em; }
''')
canvas = {'nodes': [], 'edges': []}
paths = ['10 Goals/Understand weighted averages.md','20 Sessions/DEMO-001 - Why averages can mislead.md','30 Plans/DEMO-001 - Plan.md','40 Knowledge/P001 - A rate has a denominator.md','40 Knowledge/P002 - Combined rates require group weights.md','60 Reviews/DEMO - Session reflection.md']
for i, path in enumerate(paths):
    canvas['nodes'].append({'id':f'n{i}', 'type':'file', 'file':path,'x':(i % 3)*460,'y':(i // 3)*340,'width':410,'height':270,'color':str(i % 6 + 1)})
for i, (a,b) in enumerate([(0,1),(1,2),(2,3),(3,4),(4,5),(5,1)]):
    canvas['edges'].append({'id':f'e{i}','fromNode':f'n{a}','fromSide':'right','toNode':f'n{b}','toSide':'left'})
write('Learning map.canvas', json.dumps(canvas, indent=2) + '\n')
(VAULT / '99 Attachments').mkdir(exist_ok=True)
print(f'Created {len(notes)} notes and a canvas in {VAULT}')
