"""Check JSON, unique note IDs, wiki links, heading references, and canvas targets."""
from pathlib import Path
import json
import re

vault = Path(__file__).resolve().parents[1] / 'test-vault'
errors, ids = [], {}
notes = list(vault.rglob('*.md'))
for config in (vault / '.obsidian').glob('*.json'):
    json.loads(config.read_text(encoding='utf-8'))
for note in notes:
    text = note.read_text(encoding='utf-8')
    match = re.search(r'^id: (.+)$', text, re.M)
    if match:
        identity = match[1]
        if identity in ids:
            errors.append(f'Duplicate id: {identity}')
        ids[identity] = note
    for link in re.findall(r'\[\[([^\]]+)\]\]', text):
        target = link.split('|')[0]
        file, _, heading = target.partition('#')
        path = vault / file
        if path.suffix not in ('.md', '.canvas'):
            path = vault / (file + '.md')
        if not path.is_file():
            errors.append(f'{note.name}: missing {target}')
        elif heading and not re.search(r'^#+ ' + re.escape(heading) + r'\s*$', path.read_text(encoding='utf-8'), re.M):
            errors.append(f'{note.name}: missing heading {target}')
for canvas in vault.glob('*.canvas'):
    data = json.loads(canvas.read_text(encoding='utf-8'))
    node_ids = {node['id'] for node in data['nodes']}
    for node in data['nodes']:
        if node['type'] == 'file' and not (vault / node['file']).is_file():
            errors.append(f'Missing canvas file: {node["file"]}')
    for edge in data['edges']:
        if edge['fromNode'] not in node_ids or edge['toNode'] not in node_ids:
            errors.append(f'Missing canvas endpoint: {edge["id"]}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(notes)} notes; JSON, IDs, wiki links, headings, canvas targets')
