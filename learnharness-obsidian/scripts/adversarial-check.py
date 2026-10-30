"""Challenge the unchanged baseline contract suite in a temporary copied sandbox.

Usage: python scripts/adversarial-check.py [absolute path to tsx CLI]
Never modifies the actual upstream checkout. Saves complete TAP output under
the OS temp directory; prints that location for review.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TSX = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "node_modules/tsx/dist/cli.mjs"
if not TSX.is_file():
    raise SystemExit(f"Missing tsx CLI: {TSX}; run npm ci or pass an absolute CLI path")
TESTS = ROOT / "plugin/tests/upstream-contracts.test.ts"
if not TESTS.is_file():
    raise SystemExit(f"Missing baseline contract suite: {TESTS}")
SANDBOX = Path(tempfile.mkdtemp(prefix="lh-adversarial-"))
shutil.copytree(ROOT / "upstream/learnharness/src", SANDBOX / "upstream/learnharness/src")
(SANDBOX / "plugin/tests").mkdir(parents=True)
shutil.copy2(TESTS, SANDBOX / "plugin/tests/upstream-contracts.test.ts")
(SANDBOX / "package.json").write_text('{"type":"module"}', encoding="utf-8")
baseline_hash = hashlib.sha256(TESTS.read_bytes()).hexdigest()

def run(name):
    proc = subprocess.run(["node", str(TSX), "--test", "plugin/tests/upstream-contracts.test.ts"], cwd=SANDBOX, text=True, capture_output=True, encoding="utf-8")
    output = proc.stdout + proc.stderr
    (SANDBOX / f"{name}.tap").write_text(output, encoding="utf-8")
    if hashlib.sha256((SANDBOX / "plugin/tests/upstream-contracts.test.ts").read_bytes()).hexdigest() != baseline_hash:
        raise RuntimeError("Test suite changed during mutation run")
    return proc.returncode, output

code, output = run("baseline")
if code:
    raise SystemExit(f"Baseline failed; mutations invalid. See {SANDBOX}/baseline.tap\n{output}")

mutations = [
    ("reversed-prerequisite", "src/core/plan-tree.ts", "accepted.push({ from: e.from, to: e.to });", "accepted.push({ from: e.to, to: e.from });"),
    ("failed-probe-advances", "src/core/phases.ts", "!result.isError", "true"),
    ("settled-tool-result-unpaired", "src/server/pi/call-ids.ts", "return { ...(m as object), toolCallId: scope.get(orig)! };", "return m;"),
    ("empty-node-starts-teaching", "src/core/phases.ts", ".nodeId.length > 0", ".nodeId.length >= 0"),
]
results = []
for name, relative, old, new in mutations:
    target = SANDBOX / "upstream/learnharness" / relative
    original = target.read_text(encoding="utf-8")
    if original.count(old) != 1:
        raise RuntimeError(f"Mutation target drifted: {name}; expected exactly one match")
    target.write_text(original.replace(old, new), encoding="utf-8")
    try:
        code, output = run(name)
        # A nonzero exit is only useful if the test runner reached assertions.
        assertion_failure = "ERR_ASSERTION" in output or "AssertionError" in output
        status = "detected" if code and assertion_failure else "survived" if code == 0 else "invalid-infrastructure-failure"
        results.append({"mutation": name, "status": status, "exit_code": code})
    finally:
        target.write_text(original, encoding="utf-8")
report = {"sandbox": str(SANDBOX), "test_sha256": baseline_hash, "baseline": "passed", "results": results}
(SANDBOX / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if any(r["status"] == "invalid-infrastructure-failure" for r in results):
    raise SystemExit(2)
if any(r["status"] == "survived" for r in results):
    raise SystemExit(1)
