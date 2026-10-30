"""Mutation challenge for session durability and controller acknowledgements.

Copies tested source into an ignored .dev sandbox; never mutates the working tree.
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

SANDBOX = Path(tempfile.mkdtemp(prefix="session-adversarial-", dir=ROOT / ".dev"))
shutil.copytree(ROOT / "plugin/src", SANDBOX / "plugin/src")
(SANDBOX / "plugin/tests").mkdir(parents=True)
shutil.copy2(ROOT / "plugin/tests/session-controller.test.ts", SANDBOX / "plugin/tests/session-controller.test.ts")
shutil.copy2(ROOT / "plugin/tests/session-storage.test.ts", SANDBOX / "plugin/tests/session-storage.test.ts")
shutil.copytree(ROOT / "plugin/tests/fixtures", SANDBOX / "plugin/tests/fixtures")
shutil.copytree(ROOT / "upstream/learnharness", SANDBOX / "upstream/learnharness")
(SANDBOX / "scripts").mkdir()
shutil.copy2(ROOT / "scripts/build-runtime.mjs", SANDBOX / "scripts/build-runtime.mjs")
(SANDBOX / "node_modules/path-browserify").mkdir(parents=True)
shutil.copy2(ROOT / "node_modules/path-browserify/index.js", SANDBOX / "node_modules/path-browserify/index.js")

CONTROLLER = SANDBOX / "plugin/src/session-controller.ts"
STORE = SANDBOX / "plugin/src/storage/session-store.ts"
original_controller = CONTROLLER.read_bytes()
original_store = STORE.read_bytes()
hashes = {"controller": hashlib.sha256(original_controller).hexdigest(), "store": hashlib.sha256(original_store).hexdigest()}

def run():
    try:
        proc = subprocess.run(
            ["node", str(TSX), "--test", "plugin/tests/session-controller.test.ts", "plugin/tests/session-storage.test.ts"],
            cwd=SANDBOX, text=True, capture_output=True, encoding="utf-8", timeout=20,
        )
        return proc.returncode, proc.stdout + proc.stderr
    except subprocess.TimeoutExpired as error:
        return -2, (error.stdout or "") + (error.stderr or "") + "Mutation run timed out after 20 seconds"

code, output = run()
if code:
    (SANDBOX / "baseline.tap").write_text(output, encoding="utf-8")
    raise SystemExit(f"Unmutated baseline failed; see {SANDBOX}/baseline.tap\n{output}")

mutations = [
    ("write-ahead-skipped", CONTROLLER, "const durableInput = await this.store.save(writeAhead, previous);", "const durableInput = previous;"),
    ("stale-write-accepted", STORE, "if (JSON.stringify(current.envelope) !== JSON.stringify(normalizedPrevious)) throw new SessionConflictError('Session changed externally; reload before continuing');", "if (false) throw new SessionConflictError('Session changed externally; reload before continuing');"),
    ("previous-snapshot-omitted", STORE, "await this.appendSnapshot(normalizedNext, current.snapshotId);", "// previous snapshot omitted"),
    ("final-ack-not-awaited", CONTROLLER, "const saved = await this.store.save(settled, durable);", "const savePromise = this.store.save(settled, durable); void savePromise; const saved = settled;"),
]
results = []
for name, target, old, new in mutations:
    original_bytes = original_controller if target == CONTROLLER else original_store
    original = original_bytes.decode("utf-8")
    if original.count(old) != 1:
        raise RuntimeError(f"Mutation target drifted: {name}; expected exactly one match")
    target.write_text(original.replace(old, new), encoding="utf-8")
    try:
        code, output = run()
        reached_failed_test = "test at plugin" in output and "Error:" in output and "fail 1" in output
        detected = code != 0 and ("AssertionError" in output or "ERR_ASSERTION" in output or reached_failed_test)
        results.append({"mutation": name, "status": "detected" if detected else "survived" if code == 0 else "invalid-infrastructure-failure", "exit_code": code})
        (SANDBOX / f"{name}.tap").write_text(output, encoding="utf-8")
    finally:
        target.write_bytes(original_bytes)

if hashlib.sha256(CONTROLLER.read_bytes()).hexdigest() != hashes["controller"] or hashlib.sha256(STORE.read_bytes()).hexdigest() != hashes["store"]:
    raise RuntimeError("Sandbox source failed restoration check")
report = {"sandbox": str(SANDBOX), "source_sha256": hashes, "baseline": "passed", "results": results}
(SANDBOX / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if any(item["status"] != "detected" for item in results):
    raise SystemExit(1)
