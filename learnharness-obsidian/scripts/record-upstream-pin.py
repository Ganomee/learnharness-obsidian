"""Explicitly record a reviewed pin. Does not fetch, update, test, or release it."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[1]
upstream = root / 'upstream/learnharness'
revision = subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip()
paths = ['package.json', 'src/core/plan-tree.ts', 'src/core/phases.ts', 'src/core/ports.ts', 'src/core/native-messages.ts', 'src/server/pi/call-ids.ts', 'src/agent/teacher-agent.ts', 'src/agent/prompt-segments.ts', 'config.ts']
lock = {'repository': 'https://github.com/amosblomqvist/learnharness.git', 'revision': revision, 'packageVersion': json.loads((upstream / 'package.json').read_text())['version'], 'hashFormat': 'sha256 of canonical Git blob bytes (independent of checkout line endings)', 'sha256': {p: hashlib.sha256(subprocess.check_output(['git', '-C', str(upstream), 'show', f'HEAD:{p}'])).hexdigest() for p in paths}}
(root / 'upstream-lock.json').write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
print('Recorded pin; review diff and execute contracts before accepting changes.')
