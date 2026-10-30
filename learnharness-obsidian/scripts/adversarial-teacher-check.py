"""Mutation challenge for the offline prober-to-teacher demo cycle.

Copies the tested source into an ignored .dev sandbox; never mutates the working tree.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TSX = ROOT / "node_modules/tsx/dist/cli.mjs"
if not TSX.is_file():
    raise SystemExit(f"Missing tsx CLI: {TSX}; run npm ci")

SANDBOX = Path(tempfile.mkdtemp(prefix="teacher-adversarial-", dir=ROOT / ".dev"))
shutil.copytree(ROOT / "plugin/src", SANDBOX / "plugin/src")
(SANDBOX / "plugin/tests").mkdir(parents=True)
shutil.copy2(ROOT / "plugin/tests/session-controller.test.ts", SANDBOX / "plugin/tests/session-controller.test.ts")
shutil.copytree(ROOT / "plugin/tests/fixtures", SANDBOX / "plugin/tests/fixtures")
shutil.copytree(ROOT / "upstream/learnharness", SANDBOX / "upstream/learnharness")
(SANDBOX / "scripts").mkdir()
shutil.copy2(ROOT / "scripts/build-runtime.mjs", SANDBOX / "scripts/build-runtime.mjs")
(SANDBOX / "node_modules/path-browserify").mkdir(parents=True)
shutil.copy2(ROOT / "node_modules/path-browserify/index.js", SANDBOX / "node_modules/path-browserify/index.js")

TARGET = SANDBOX / "plugin/src/adapters/demo-engine.ts"
original_bytes = TARGET.read_bytes()
original = original_bytes.decode("utf-8")
source_hash = hashlib.sha256(original_bytes).hexdigest()

def run():
    proc = subprocess.run(
        ["node", str(TSX), "--test", "plugin/tests/session-controller.test.ts"],
        cwd=SANDBOX, text=True, capture_output=True, encoding="utf-8",
    )
    return proc.returncode, proc.stdout + proc.stderr

code, output = run()
if code:
    (SANDBOX / "baseline.tap").write_text(output, encoding="utf-8")
    raise SystemExit(f"Unmutated baseline failed; see {SANDBOX}/baseline.tap\n{output}")

mutations = [
    ("prediction-tag-lost", "nodeId: 'denominator', type: 'predict'", "nodeId: 'denominator', type: 'check'"),
    ("check-node-misassigned", "nodeId: 'combined-rate', type: 'check'", "nodeId: 'denominator', type: 'check'"),
    ("teacher-explanation-omitted", "      fauxText('Use the actual counts: add the successes and add the attempts. Here that gives (1 + 9) / (2 + 10), so the combined rate is 10/12. The group with more attempts contributes more weight.'),\n", ""),
]
results = []
for name, old, new in mutations:
    if original.count(old) != 1:
        raise RuntimeError(f"Mutation target drifted: {name}; expected exactly one match")
    TARGET.write_text(original.replace(old, new), encoding="utf-8")
    try:
        code, output = run()
        detected = code != 0 and ("AssertionError" in output or "ERR_ASSERTION" in output)
        results.append({"mutation": name, "status": "detected" if detected else "survived" if code == 0 else "invalid-infrastructure-failure", "exit_code": code})
        (SANDBOX / f"{name}.tap").write_text(output, encoding="utf-8")
    finally:
        TARGET.write_bytes(original_bytes)

if hashlib.sha256(TARGET.read_bytes()).hexdigest() != source_hash:
    raise RuntimeError("Sandbox source failed restoration check")
report = {"sandbox": str(SANDBOX), "source_sha256": source_hash, "baseline": "passed", "results": results}
(SANDBOX / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if any(item["status"] != "detected" for item in results):
    raise SystemExit(1)
