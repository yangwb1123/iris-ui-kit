"""Current registry evidence and immutable successful-main-CI qualification."""
import json
import os
import re
import base64
import hashlib
from urllib.parse import quote

if __package__:
    from .iris_publish_process import capture, run_command
else:
    from iris_publish_process import capture, run_command

REPOSITORY = "yangwb1123/iris-ui-kit"
REGISTRY = "https://registry.npmjs.org"


def check_ci(root, run_id, head):
    if not re.fullmatch(r"[1-9]\d{0,19}", str(run_id)):
        raise ValueError("An explicit CI run ID is required for publication")
    prefix = f"repos/{REPOSITORY}/actions"
    data = json.loads(capture(["gh", "api", f"{prefix}/runs/{run_id}"], root))
    expected = {"head_sha": head, "head_branch": "main", "event": "push",
                "status": "completed", "conclusion": "success", "name": "CI"}
    if any(data.get(key) != value for key, value in expected.items()):
        raise ValueError("CI is missing, failed, PR-triggered or for a different source")
    if data.get("repository", {}).get("full_name") != REPOSITORY:
        raise ValueError("CI repository mismatch")
    workflow_id = data.get("workflow_id")
    if not isinstance(workflow_id, int) or workflow_id <= 0:
        raise ValueError("CI workflow identity missing")
    workflow = json.loads(capture(["gh", "api", f"{prefix}/workflows/{workflow_id}"], root))
    if workflow.get("path") != ".github/workflows/ci.yml":
        raise ValueError("Unrecognized CI workflow")
    return {"id": str(run_id), **expected, "repository": REPOSITORY}


def check_provenance_context(head):
    conditions = (
        os.environ.get("IRIS_NPM_RELEASE_ENABLED") == "true",
        os.environ.get("GITHUB_ACTIONS") == "true",
        os.environ.get("GITHUB_REPOSITORY") == REPOSITORY,
        os.environ.get("GITHUB_SHA") == head,
        bool(os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")),
        bool(os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")),
    )
    if not all(conditions):
        raise ValueError("Publication requires enabled, exact-SHA GitHub Actions provenance; no local fallback")


def registry_view(root, pack):
    name, version = pack["name"], pack["version"]
    url = f"{REGISTRY}/{quote(name, safe='@')}/{quote(version, safe='')}"
    raw = capture(["curl", "--silent", "--show-error", "--max-time", "20",
                   "--max-filesize", "2097152", "--write-out", "\n%{http_code}", url], root)
    body, status = raw.rsplit(b"\n", 1)
    if status == b"404":
        return None
    if status != b"200":
        raise ValueError(f"Registry lookup failed: HTTP {status.decode(errors='replace')}")
    data = json.loads(body)
    if not isinstance(data, dict) or data.get("name") != name or data.get("version") != version:
        raise ValueError("Registry identity mismatch")
    return data


def verify_current(pack, current):
    if current.get("dist", {}).get("integrity") != pack["integrity"]:
        raise ValueError(f"Registry integrity differs: {pack['name']}@{pack['version']}")
    for section in ("dependencies", "optionalDependencies"):
        if current.get(section, {}) != pack[section]:
            raise ValueError(f"Registry production graph differs: {pack['name']}")
    for section in ("dependencies", "optionalDependencies", "peerDependencies", "devDependencies"):
        for spec in current.get(section, {}).values():
            if not isinstance(spec, str) or spec.startswith(("workspace:", "file:", "link:")):
                raise ValueError("Registry has nonportable dependencies")


def workflow_marker(pack):
    name, version = pack["name"], pack["version"]
    if (not re.fullmatch(r"@iris-ui-kit/[a-z][a-z0-9-]*", name)
            or not re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", version)):
        raise ValueError("Invalid cross-worker publication intent identity")
    return f"refs/tags/iris-npm-intent-{name.split('/')[-1]}-{version}"


def workflow_marker_exists(root, pack):
    ref = workflow_marker(pack)
    endpoint = f"repos/{REPOSITORY}/git/matching-refs/{ref.removeprefix('refs/')}"
    rows = json.loads(capture(["gh", "api", endpoint, "--method", "GET"], root))
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Invalid retained workflow publication intent")
    return any(row.get("ref") == ref for row in rows)


def create_workflow_marker(root, pack):
    # Create-only retained Git ref survives fresh workers and different source
    # SHAs. A duplicate, timeout, malformed response or nonzero result blocks
    # the npm write. Never update/delete this marker or blindly replay its POST.
    head = os.environ.get("GITHUB_SHA", "")
    if os.environ.get("GITHUB_ACTIONS") != "true" or not re.fullmatch(r"[a-f0-9]{40}", head):
        raise ValueError("Retained workflow intent requires actual Actions source")
    ref = workflow_marker(pack)
    args = ["gh", "api", f"repos/{REPOSITORY}/git/refs", "--method", "POST",
            "-f", f"ref={ref}", "-f", f"sha={head}"]
    data = json.loads(capture(args, root))
    if (not isinstance(data, dict) or data.get("ref") != ref
            or data.get("object", {}).get("sha") != head):
        raise ValueError("Cross-worker publication intent was not confirmed")


def registry_preflight(root, packs):
    journal = publication_journal(root)
    already = set()
    for pack in packs:
        current = registry_view(root, pack)
        if current is not None:
            verify_current(pack, current)
            already.add(pack["name"])
        elif journal.get(pack["name"] + "@" + pack["version"]) == "outcome_unknown":
            raise ValueError("An earlier write remains unknown; inspect registry before any replay")
        elif workflow_marker_exists(root, pack):
            raise ValueError("An earlier workflow write intent remains unresolved; inspect registry before any replay")
    return already


def publication_journal(root, pack=None, status=None):
    if __package__:
        from .iris_publish_contract import bounded_json, git
    else:
        from iris_publish_contract import bounded_json, git
    from pathlib import Path
    common = Path(git(root, "rev-parse", "--git-common-dir").decode().strip())
    common = common if common.is_absolute() else root / common
    path = common / "abr-iris-publications.json"
    data = bounded_json(path) if path.exists() else {}
    if any(value not in ("outcome_unknown", "registry_verified") for value in data.values()):
        raise ValueError("Invalid durable publication journal")
    if pack is not None:
        data[pack["name"] + "@" + pack["version"]] = status
        temporary = path.with_suffix(".tmp")
        encoded = json.dumps(data, sort_keys=True).encode()
        if len(encoded) > 2 * 1024 * 1024:
            raise ValueError("Publication journal byte budget exceeded")
        with temporary.open("wb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
        descriptor = os.open(common, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    return data


def publish_one(root, pack, output):
    if __package__:
        from .iris_publish_contract import bounded_bytes
    else:
        from iris_publish_contract import bounded_bytes
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(bounded_bytes(pack["path"])).digest()).decode()
    if integrity != pack["integrity"]:
        raise ValueError("Approved publication artifact changed")
    log = output / (pack["name"].split("/")[-1] + ".publish.log")
    publication_journal(root, pack, "outcome_unknown")  # durable intent BEFORE the external write
    create_workflow_marker(root, pack)  # create-only, retained across worker replacement
    code = run_command(["npm", "publish", pack["path"], "--access=public", "--tag=latest",
                        "--provenance", f"--registry={REGISTRY}"], root, log, 120)
    # ALWAYS reconcile actual registry state, including nonzero/timeout outcomes.
    # A missing/unreadable result after a write is UNKNOWN, never auto-replayed.
    current = registry_view(root, pack)
    if current is None:
        raise ValueError(f"Publication outcome unknown (command exit {code}); inspect before retry: {pack['name']}")
    verify_current(pack, current)
    publication_journal(root, pack, "registry_verified")
    return {"name": pack["name"], "version": pack["version"], "command_exit": code,
            "status": "registry_verified", "integrity": pack["integrity"]}


def install_registry_graph(root, packs, output):
    consumer = output / "registry-consumer"
    consumer.mkdir()
    deps = {pack["name"]: pack["version"] for pack in packs}
    (consumer / "package.json").write_text(json.dumps({"name": "iris-registry-consumer",
        "version": "0.0.0", "private": True, "dependencies": deps}, indent=2) + "\n")
    code = run_command(["npm", "install", "--no-audit", "--no-fund", f"--registry={REGISTRY}"],
                       consumer, output / "registry-install.log", 300)
    if code:
        raise ValueError("Actual registry consumer installation failed")
    for name, version in deps.items():
        path = consumer / "node_modules" / name / "package.json"
        if path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("Installed package manifest exceeds budget")
        if json.loads(path.read_text()).get("version") != version:
            raise ValueError("Installed registry graph differs from the released graph")
    return {"status": "installed", "packages": len(deps),
            "scope": "registry installation/version proof, not browser/application acceptance"}
