"""Run unchanged original-agent runtime tests against isolated behavioral mutations.

Usage: python scripts/adversarial-runtime-check.py [node_modules directory]
The optional directory supplies installed packages only; source modifications
are confined to a new OS temporary sandbox. Windows junctions avoid copying
dependencies; no dependency file is modified by this script.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEPS = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "node_modules"
TSX = DEPS / "tsx/dist/cli.mjs"
TEST = ROOT / "plugin/tests/runtime-proof.test.ts"
if not TSX.is_file() or not TEST.is_file():
    raise SystemExit("Missing runtime suite or installed dependencies; run npm ci first")
SANDBOX = Path(tempfile.mkdtemp(prefix="lh-runtime-adversarial-"))
for relative in ["plugin/src", "plugin/tests/fixtures", "upstream/learnharness/src"]:
    shutil.copytree(ROOT / relative, SANDBOX / relative)
for relative in ["plugin/tests/runtime-proof.test.ts", "scripts/build-runtime.mjs", "package.json", "upstream/learnharness/package.json", "upstream/learnharness/config.ts"]:
    target = SANDBOX / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / relative, target)
if os.name == "nt":
    import _winapi
    _winapi.CreateJunction(str(DEPS), str(SANDBOX / "node_modules"))
else:
    (SANDBOX / "node_modules").symlink_to(DEPS, target_is_directory=True)
digest = hashlib.sha256(TEST.read_bytes()).hexdigest()

def run(name):
    result = subprocess.run(["node", str(TSX), "--test", "plugin/tests/runtime-proof.test.ts"], cwd=SANDBOX, capture_output=True, text=True, encoding="utf-8", timeout=60)
    output = result.stdout + result.stderr
    (SANDBOX / f"{name}.tap").write_text(output, encoding="utf-8")
    if hashlib.sha256((SANDBOX / "plugin/tests/runtime-proof.test.ts").read_bytes()).hexdigest() != digest:
        raise RuntimeError("Runtime suite was modified")
    return result.returncode, output

code, output = run("baseline")
if code:
    raise SystemExit(f"Baseline failed; mutations invalid. See {SANDBOX}/baseline.tap\n{output}")

mutations = [
    ("errored-question-stops", "upstream/learnharness/src/agent/teacher-agent.ts", "if (called.has(result.toolCallId) && result.isError) return false;", "if (called.has(result.toolCallId) && result.isError) return true;"),
    ("mixed-question-does-not-stop", "upstream/learnharness/src/agent/teacher-agent.ts", 'finishTurn: (turn) => (stopper(turn) ? { action: "end" } : undefined),', 'finishTurn: () => undefined,'),
    ("placeholder-persisted", "upstream/learnharness/src/server/turn-service.ts", "\t\t\t\tcontinue;", "\t\t\t\t// Mutant: synthetic placeholder falls through into persistence."),
    ("last-turn-message-dropped", "upstream/learnharness/src/server/turn-service.ts", "turnMessages.slice(baseCount)", "turnMessages.slice(baseCount, -1)"),
    ("browser-prompt-corrupted", "scripts/build-runtime.mjs", "fs.readFileSync(file, 'utf8')", "fs.readFileSync(file, 'utf8') + '\\nInjected prompt corruption'"),
    ("unsupported-filesystem-silent", "scripts/build-runtime.mjs", "function unsupported(p){throw new Error('Unsupported runtime proof filesystem operation: '+p)}", "function unsupported(p){return ''}"),
]
results = []
for name, relative, old, new in mutations:
    target = SANDBOX / relative
    original = target.read_text(encoding="utf-8")
    if original.count(old) != 1:
        raise RuntimeError(f"Mutation target drifted: {name}; expected exactly one match")
    target.write_text(original.replace(old, new), encoding="utf-8")
    try:
        code, output = run(name)
        # Explicit runtime contract guards are intentional semantic failures,
        # just like test assertions. Import, transform and syntax errors do not count.
        semantic_failure = "ERR_ASSERTION" in output or "Runtime proof failed:" in output
        status = "detected" if code and semantic_failure else "survived" if code == 0 else "invalid-infrastructure-failure"
        results.append({"mutation": name, "status": status, "exit_code": code})
    finally:
        target.write_text(original, encoding="utf-8")
report = {"sandbox": str(SANDBOX), "test_sha256": digest, "baseline": "passed", "results": results}
(SANDBOX / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if any(r["status"] == "invalid-infrastructure-failure" for r in results):
    raise SystemExit(2)
if any(r["status"] == "survived" for r in results):
    raise SystemExit(1)
