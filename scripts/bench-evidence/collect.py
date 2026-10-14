#!/usr/bin/env python3
"""Collect diagnostic-only, source-bound native Vitest cohorts. POSIX/Node20."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import signal
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts/release"))
from iris_publish_contract import copy_source, snapshot
from iris_publish_process import capture, run_command
from contract import BASELINE_HEAD, digest, expected_cases, plan, read_report, save_new, summarize, validate_case, validate_report


class Budget:
    def __init__(self, seconds):
        if not 1 <= seconds <= 1500:
            raise ValueError("Execution window must be in 1..1500 seconds")
        self.end = time.monotonic() + seconds

    def remaining(self, maximum=300):
        remaining = min(maximum, int(self.end - time.monotonic()))
        if remaining < 1:
            raise ValueError("Whole collection window expired; no retry")
        return remaining


def checked_output_path(path, roots):
    raw = Path(path).absolute()
    if raw.exists() or raw.is_symlink():
        raise ValueError("Evidence directory exists; retain it, never replay")
    output = raw.resolve()
    if not output.parent.is_dir():
        raise ValueError("Evidence parent must already exist")
    for root in roots:
        if output.is_relative_to(root) or root.is_relative_to(output):
            raise ValueError("Evidence must be outside, and not an ancestor of, source roots")
    return output


def preflight(args):
    reference = Path(args.reference_dir).resolve(strict=True)
    if reference.is_relative_to(ROOT) or ROOT.is_relative_to(reference):
        raise ValueError("Reference and candidate source roots must be disjoint")
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_head):
        raise ValueError("An exact expected candidate HEAD is required")
    plan(args.pairs)
    if os.name != "posix" or os.environ.get("NODE_OPTIONS"):
        raise ValueError("Only POSIX without NODE_OPTIONS injection is supported")
    if any(key.startswith("VITEST_") for key in os.environ):
        raise ValueError("Inherited Vitest overrides are not supported")
    current, old = snapshot(ROOT), snapshot(reference)
    if current["head"] != args.expected_head or old["head"] != BASELINE_HEAD or old["status"]:
        raise ValueError("Source HEAD/clean historical checkout does not match plan")
    if os.environ.get("GITHUB_ACTIONS") == "true":
        if args.pairs != 6 or current["status"] or os.environ.get("GITHUB_RUN_ATTEMPT") != "1":
            raise ValueError("Actions requires clean source, six cohorts and first attempt; no automatic retry")
    benches = sorted(p for p in current["files"] if p.startswith("packages/core/src/") and p.endswith(".bench.ts"))
    old_benches = sorted(p for p in old["files"] if p.startswith("packages/core/src/") and p.endswith(".bench.ts"))
    if not benches or benches != old_benches or any(current["files"][p] != old["files"][p] for p in benches):
        raise ValueError("Original benchmark files differ between sources")
    expected = {"packages/core/" + file for file, _ in expected_cases("current").values()}
    if not expected.issubset(benches):
        raise ValueError("Original workload files are missing")
    output = checked_output_path(args.output_dir, (ROOT, reference))
    return reference, output, current, old, benches


def environment(budget):
    script = """const os=require('node:os'); console.log(JSON.stringify({node:process.version,
      v8:process.versions.v8,platform:process.platform,arch:process.arch,
      cpus:os.cpus().slice(0,256).map(({model,speed})=>({model,speed})),
      parallelism:os.availableParallelism(),memory:os.totalmem(),loadavg:os.loadavg()}))"""
    data = json.loads(capture(["node", "-e", script], ROOT, budget.remaining(15)))
    if not re.fullmatch(r"v20\.\d+\.\d+", data["node"]):
        raise ValueError("This measurement plan requires Node20")
    vitest = (ROOT / "node_modules/vitest").resolve(strict=True)
    version = read_report(vitest / "package.json")["version"]
    if version != "4.1.11" or read_report(ROOT / "package.json")["devDependencies"]["vitest"] != version:
        raise ValueError("The installed and declared Vitest4.1.11 harness must match")
    data["vitest"] = version
    data["tinybench"] = read_report(vitest.parent / "tinybench/package.json")["version"]
    data["pnpm"] = capture(["/bin/sh", "-c", "pnpm --version"], ROOT, budget.remaining(15)).decode().strip()
    if "pnpm@" + data["pnpm"] != read_report(ROOT / "package.json")["packageManager"]:
        raise ValueError("Installed pnpm does not match the candidate lock owner")
    keys = ("GITHUB_ACTIONS", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_REPOSITORY", "GITHUB_SHA",
            "GITHUB_WORKFLOW_REF", "GITHUB_WORKFLOW_SHA", "GITHUB_EVENT_NAME", "RUNNER_OS", "RUNNER_ARCH",
            "ImageOS", "ImageVersion")
    data["environment_claims_not_attestation"] = {k: os.environ.get(k) for k in keys}
    if any(value is not None and len(value) > 2048 for value in data["environment_claims_not_attestation"].values()):
        raise ValueError("Environment metadata byte budget exceeded")
    return data, vitest


def config_text(stage, vitest, variant, cache):
    expected = expected_cases(variant)
    config = {"root": str(stage / "packages/core"), "cacheDir": str(cache),
              "resolve": {"alias": [{"find": "vitest", "replacement": str(vitest / "dist/index.js")}]},
              "test": {"pool": "forks", "isolate": True, "fileParallelism": False, "maxWorkers": 1,
                       "testNamePattern": "(?:" + "|".join(re.escape(name) for _, name in expected.values()) + ")$",
                       "benchmark": {"include": sorted({file for file, _ in expected.values()}),
                                     "includeSamples": True, "reporters": ["default", str(HERE / "reporter.mjs")]}}}
    # Only the original resilience benchmark import is substituted for explicit diagnostic controls.
    importer = str(stage / "packages/core/src/resilience.bench.ts")
    plugin = ""
    if variant.endswith("-control"):
        plugin = f"""config.plugins = [{{ name: 'explicit-query-diagnostic-control', enforce: 'pre',
          resolveId(source, importer) {{
            if (source === './query-cache' && importer === {json.dumps(importer)})
              return {json.dumps(str(HERE / 'controls.mjs'))};
          }} }}];"""
    return ("const config = " + json.dumps(config) + ";\n"
            + "config.resolve.alias[0].find = /^vitest$/;\n" + plugin + "\nexport default config;\n")


def run_cohort(row, output, stages, vitest, budget):
    variant = row["variant"]
    label = f"{row['round']:02d}-{variant}"
    source = stages["historical" if variant == "historical" else "current"]
    config = output / (label + ".config.mjs")
    with config.open("x") as stream:
        stream.write(config_text(source, vitest, variant, output / (label + "-cache")))
    raw = output / (label + ".samples.json")
    os.environ.update({"IRIS_BENCH_REPORT": str(raw), "IRIS_BENCH_VARIANT": variant,
                       "IRIS_BENCH_CASES": json.dumps(expected_cases(variant))})
    args = ["node", str(vitest / "vitest.mjs"), "bench", "--run", "--config", str(config)]
    save_new(output / (label + ".intent.json"), {**row, "argv": args, "config_sha256": digest(config)})
    code = run_command(args, source / "packages/core", output / (label + ".log"), budget.remaining(), 4 * 1024 * 1024)
    if code:
        raise ValueError(f"Benchmark child failed ({code}); retain partial evidence, no replay")
    report = validate_report(read_report(raw), variant)
    partial_hashes = {}
    for case in report["cases"]:
        path = raw.with_name(raw.name + "." + case["id"] + ".completed.json")
        partial = read_report(path)
        if type(partial.get("schema")) is not int or partial != {"schema": 1, "variant": variant, "collection_complete": False, "case": case}:
            raise ValueError("Completed-case evidence disagrees with final native report")
        validate_case(partial["case"], expected_cases(variant))
        partial_hashes[case["id"]] = digest(path)
    save_new(output / (label + ".verified.json"), {**row, "raw_report_sha256": digest(raw),
                                                "completed_case_hashes": partial_hashes, "exit_code": code})
    return {**row, "report": report}


def collect(args):
    budget = Budget(args.seconds)
    reference, output, current, old, benches = preflight(args)
    data, vitest = environment(budget)
    output.mkdir(mode=0o700)
    try:
        rows = plan(args.pairs)
        save_new(output / "intent.json", {"schema": 1, "diagnostic_only": True, "plan": rows,
                 "seconds": args.seconds, "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 "candidate_head": current["head"], "candidate_source_sha256": current["sha256"],
                 "reference_head": old["head"], "reference_source_sha256": old["sha256"],
                 "workloads": {p: current["files"][p] for p in benches},
                 "candidate_lock_sha256": current["files"]["pnpm-lock.yaml"], "environment": data,
                 "topology": "fresh process/cohort; serial isolated files; no pre-timing witnesses; native default sampling",
                 "retention": "includeSamples enabled; exposed vectors may be sorted by Tinybench; retained between cases",
                 "calibration_or_performance_acceptance": False})
        save_new(output / "candidate-source.json", current)
        save_new(output / "reference-source.json", old)
        stages = {"current": output / "stage-current", "historical": output / "stage-historical"}
        for name, root, source in [("current", ROOT, current), ("historical", reference, old)]:
            budget.remaining()
            stages[name].mkdir()
            copy_source(root, stages[name], source)
        records = [run_cohort(row, output, stages, vitest, budget) for row in rows]
        budget.remaining()
        if snapshot(ROOT) != current or snapshot(reference) != old:
            raise ValueError("Original source changed during collection; no complete receipt")
        # Staged source must still match too; generated ignored caches are outside the source tree.
        for name, source in [("current", current), ("historical", old)]:
            entries = list(stages[name].rglob("*"))
            files = [p for p in entries if not p.is_dir()]
            if any(p.is_symlink() for p in entries) or any(not p.is_file() for p in files):
                raise ValueError("Staged input became linked or nonregular")
            if {p.relative_to(stages[name]).as_posix() for p in files} != set(source["files"]):
                raise ValueError("Staged input inventory changed during collection")
            if any(digest(stages[name] / path) != sha for path, sha in source["files"].items()):
                raise ValueError("Staged input source changed during collection")
        summary = summarize(records, args.pairs)
        summary.update({"candidate_source_sha256": current["sha256"], "source_preserved": True,
                        "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
        save_new(output / "summary.json", summary)
        print("Evidence collection complete; NOT performance acceptance, baseline approval or release qualification")
    except BaseException as error:
        save_new(output / "failure.json", {"collection_status": "failed", "error_type": type(error).__name__,
                                         "reason": str(error)[:1000], "performance_accepted": False})
        raise


def expire(_number, _frame):
    raise TimeoutError("Absolute collection deadline reached, including setup and source verification")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-dir", required=True, help="Clean, separate baseline-commit checkout; no dependencies installed there")
    parser.add_argument("--expected-head", required=True, help="Exact candidate Git HEAD; dirty local source is separately fingerprinted")
    parser.add_argument("--output-dir", required=True, help="New directory outside both source trees")
    parser.add_argument("--pairs", type=int, default=6, help="1..6 native cohorts/variant; Actions requires six, never selects the best")
    parser.add_argument("--seconds", type=int, default=1200, help="Absolute collection window, maximum1500, no retry")
    args = parser.parse_args()
    if os.name != "posix" or not 1 <= args.seconds <= 1500:
        print("FAIL: POSIX and a 1..1500 second absolute budget are required", file=sys.stderr)
        return 1
    previous = signal.signal(signal.SIGALRM, expire)
    signal.setitimer(signal.ITIMER_REAL, args.seconds)
    try:
        collect(args)
    except Exception as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
    return 0


if __name__ == "__main__":
    sys.exit(main())
