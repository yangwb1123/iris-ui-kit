#!/usr/bin/env python3
"""Whole-graph Iris pack/publication. Never versions, commits, or upgrades apps."""
import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import signal
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

if __package__:
    from .iris_publish_contract import copy_source, git, graph, publication_order, read_pack, snapshot
    from .iris_publish_process import capture, run_command
    from .iris_publish_registry import (check_ci, check_provenance_context, install_registry_graph,
                                       publish_one, registry_preflight)
else:
    from iris_publish_contract import copy_source, git, graph, publication_order, read_pack, snapshot
    from iris_publish_process import capture, run_command
    from iris_publish_registry import (check_ci, check_provenance_context, install_registry_graph,
                                      publish_one, registry_preflight)


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="qualify and pack a private stage only")
    mode.add_argument("--publish", action="store_true", help="publish ONLY from qualified, enabled exact-SHA CI")
    parser.add_argument("--iris-ui-dir", type=Path, default=Path(os.environ.get("IRIS_UI_DIR", str(Path.home() / "workspace/job/iris-ui"))))
    parser.add_argument("--output-dir", type=Path, required=True, help="new evidence/artifact directory outside source")
    parser.add_argument("--expected-head", help="required immutable source SHA for publication")
    parser.add_argument("--expected-source-sha256", help="required reviewed source manifest digest")
    parser.add_argument("--ci-run-id", help="successful main-push CI run for precisely that SHA")
    return parser.parse_args(argv)


@contextmanager
def release_lock(root):
    common = Path(git(root, "rev-parse", "--git-common-dir").decode().strip())
    common = common if common.is_absolute() else root / common
    with (common / "abr-iris-publish.lock").open("a+b") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ValueError("Another publisher owns the release lock; no forced unlock") from exc
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def validate_request(args, baseline):
    if args.publish:
        if baseline["status"] or args.expected_head != baseline["head"]:
            raise ValueError("Publication requires a clean, exactly approved source HEAD")
        if args.expected_source_sha256 != baseline["sha256"]:
            raise ValueError("Reviewed source manifest digest missing or changed")
        check_provenance_context(baseline["head"])
        return check_ci(args.iris_ui_dir, args.ci_run_id, baseline["head"])
    return {"status": "not_required_for_candidate_pack", "release_qualification": "missing"}


def required_command(stage, output, name, argv, timeout):
    code = run_command(argv, stage, output / (name + ".log"), timeout)
    if code:
        raise ValueError(f"Mandatory command failed ({code}): {name}")


def stage_source(root, stage, baseline, output):
    required_command(root, output, "clone", ["git", "clone", "--no-checkout", "--depth=1", "--no-local",
                                             root.as_uri(), str(stage)], 120)
    copy_source(root, stage, baseline)
    # Populate only the private clone's index. No source checkout/restoration,
    # hook execution, commits, version writes, or change to the original index.
    required_command(stage, output, "stage-index", ["git", "-c", "core.hooksPath=/dev/null",
                                                   "reset", "--mixed", baseline["head"]], 30)


def unchanged_stage(stage, baseline):
    for name, digest in baseline["files"].items():
        path = stage / name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Qualification unexpectedly changed source: {name}")


def qualify_and_pack(root, stage, output, baseline):
    stage_source(root, stage, baseline, output)
    expected = graph(stage)
    required_command(stage, output, "frozen-install", ["pnpm", "install", "--frozen-lockfile"], 300)
    required_command(stage, output, "release-verify", ["pnpm", "release:verify"], 7200)
    unchanged_stage(stage, baseline)
    pack_dir = output / "packs"
    pack_dir.mkdir()
    packs = {}
    license_text = (stage / "LICENSE").read_bytes()
    for name, package in expected.items():
        before = set(pack_dir.glob("*.tgz"))
        required_command(stage, output, "pack-" + name.split("/")[-1],
                         ["pnpm", "--dir", package["directory"], "pack", "--pack-destination", str(pack_dir)], 120)
        added = set(pack_dir.glob("*.tgz")) - before
        if len(added) != 1:
            raise ValueError("Pack did not produce exactly one owned tarball")
        packed = read_pack(added.pop(), expected, license_text)
        if packed["name"] != name:
            raise ValueError("Pack identity mismatch")
        packs[name] = packed
    unchanged_stage(stage, baseline)
    return publication_order(packs)


def publish_graph(root, packs, output, receipt, persist):
    already = registry_preflight(root, packs)  # reject ANY conflicting version before the first write
    username = capture(["npm", "whoami", "--registry=https://registry.npmjs.org"], root, limit=4096).decode().strip()
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,128}", username):
        raise ValueError("Npm publication identity missing/invalid")
    receipt["npm_identity"] = username
    for pack in packs:
        if pack["name"] in already:
            row = {"name": pack["name"], "version": pack["version"], "status": "already_registry_verified"}
        else:
            row = {"name": pack["name"], "version": pack["version"], "status": "outcome_unknown"}
            receipt["publications"].append(row)
            if receipt["published"] is not True:
                receipt["published"] = None
            persist()  # save intent before a possibly irreversible external write
            row.update(publish_one(root, pack, output))
            receipt["published"] = True
            persist()
            continue
        receipt["publications"].append(row)
        persist()  # mandatory durable write, not an optional observation
    receipt["consumer"] = install_registry_graph(root, packs, output)


def save_receipt(output, receipt):
    temporary = output / "receipt.tmp"
    with temporary.open("w", encoding="utf-8") as stream:
        json.dump(receipt, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(output / "receipt.json")


def execute(args):
    root, output = args.iris_ui_dir.resolve(strict=True), args.output_dir.resolve()
    if output.is_relative_to(root) or root.is_relative_to(output):
        raise ValueError("Evidence directory must be separate from source")
    args.iris_ui_dir = root
    baseline = snapshot(root)
    ci = validate_request(args, baseline)  # refuse unauthorized/missing qualification before any write
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    receipt = {"schema_version": 1, "result": "failed", "published": False, "publication_complete": False,
               "action": "publication" if args.publish else "candidate_pack",
               "source_head": baseline["head"], "source_sha256": baseline["sha256"],
               "ci": ci, "publications": [], "application_upgrade": "not_requested"}
    persist = lambda: save_receipt(output, receipt)
    persist()
    try:
        with release_lock(root), tempfile.TemporaryDirectory(prefix="iris-publish-stage-") as directory:
            stage = Path(directory) / "source"
            packs = qualify_and_pack(root, stage, output, baseline)
            if snapshot(root) != baseline:
                raise ValueError("Original source changed during qualification")
            receipt["packs"] = packs
            persist()
            if args.publish:
                publish_graph(root, packs, output, receipt, persist)
            receipt["result"] = "passed"
            receipt["publication_complete"] = bool(args.publish)
    except BaseException as exc:
        receipt["error"] = str(exc)[:4096] or type(exc).__name__
        # Keep verified/partially published artifact evidence. Rejected packs
        # before a graph was accepted must never look like deliverables.
        if "packs" not in receipt:
            shutil.rmtree(output / "packs", ignore_errors=True)
        raise
    finally:
        receipt["source_preserved"] = snapshot(root) == baseline
        if not receipt["source_preserved"]:
            receipt["result"] = "failed"
        persist()
    return receipt


def main(argv=None):
    args = arguments(argv)
    signal.signal(signal.SIGTERM, lambda _sig, _frame: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        receipt = execute(args)
    except (Exception, KeyboardInterrupt) as exc:
        print(f"FAIL: {str(exc)[:4096] or type(exc).__name__}", file=sys.stderr)
        return 1
    print(json.dumps({key: receipt[key] for key in ("result", "action", "published", "source_preserved")}))
    return 0 if receipt["result"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
