"""Read-only source/pack contracts for the Iris publication transaction."""
import hashlib
import json
import re
import shutil
if __package__:
    from .iris_publish_process import capture
else:
    from iris_publish_process import capture
import tarfile
from pathlib import Path, PurePosixPath

MAX_FILE = 64 * 1024 * 1024
MAX_FILES = 16000
MAX_SOURCE = 1024 * 1024 * 1024
VERSION = re.compile(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\Z")
NAME = re.compile(r"@iris-ui-kit/[a-z][a-z0-9-]*\Z")


def bounded_json(path, limit=2 * 1024 * 1024):
    path = Path(path)
    if not path.is_file() or path.stat().st_size > limit:
        raise ValueError(f"Invalid or oversized JSON: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def bounded_bytes(path, limit=MAX_FILE):
    with Path(path).open("rb") as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError("File byte budget exceeded")
    return data


def git(root, *args):
    return capture(["git", "-C", str(root), *args], root)


def snapshot(root):
    """Hash tracked AND untracked source; reject links and unsafe archive paths."""
    root = Path(root).resolve(strict=True)
    raw = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
    paths = sorted(set(raw.decode("utf-8").strip("\0").split("\0")))
    if not paths or len(paths) > MAX_FILES:
        raise ValueError("Source file-count budget invalid")
    files, total = {}, 0
    for name in paths:
        relative = PurePosixPath(name)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Unsafe source path")
        path = root / name
        if path.is_symlink() or not path.is_file() or path.resolve().is_relative_to(root) is False:
            raise ValueError(f"Source path is missing, linked, or nonregular: {name}")
        size = path.stat().st_size
        total += size
        if size > MAX_FILE or total > MAX_SOURCE:
            raise ValueError("Source byte budget exceeded")
        files[name] = hashlib.sha256(bounded_bytes(path)).hexdigest()
    encoded = json.dumps(files, sort_keys=True, separators=(",", ":")).encode()
    return {"head": git(root, "rev-parse", "HEAD").decode().strip(),
            "status": git(root, "status", "--porcelain=v1", "-uall").decode(),
            "files": files, "sha256": hashlib.sha256(encoded).hexdigest()}


def copy_source(root, stage, baseline):
    for name in baseline["files"]:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        content = bounded_bytes(root / name)
        if hashlib.sha256(content).hexdigest() != baseline["files"][name]:
            raise ValueError("Source changed before copying")
        target.write_bytes(content)
        shutil.copystat(root / name, target)
    copied = {name: hashlib.sha256(bounded_bytes(stage / name)).hexdigest()
              for name in baseline["files"]}
    if copied != baseline["files"] or snapshot(root) != baseline:
        raise ValueError("Source changed while copying; refusing an incoherent stage")


def graph(root):
    packages = {}
    for path in sorted((Path(root) / "packages").glob("*/package.json")):
        data = bounded_json(path)
        if data.get("private") is True:
            continue
        name, version = data.get("name", ""), data.get("version", "")
        if (not isinstance(name, str) or not isinstance(version, str)
                or not NAME.fullmatch(name) or not VERSION.fullmatch(version) or name in packages):
            raise ValueError("Invalid/duplicate publishable package name or version")
        packages[name] = {"version": version, "directory": str(path.parent.relative_to(root))}
    if not packages or len(packages) > 128:
        raise ValueError("Publishable graph is empty or oversized")
    return packages


def safe_member(member):
    path = PurePosixPath(member.name)
    if path.is_absolute() or ".." in path.parts or path.parts[:1] != ("package",):
        raise ValueError("Unsafe tarball member path")
    if not (member.isfile() or member.isdir()) or member.size > MAX_FILE:
        raise ValueError("Linked, nonregular or oversized tarball member")


def read_pack(path, expected, license_text):
    """Inspect without extraction; pin every workspace production dependency."""
    if path.stat().st_size > MAX_FILE:
        raise ValueError("Tarball byte budget exceeded")
    with tarfile.open(path, "r:gz") as archive:
        names, total = set(), 0
        for index, member in enumerate(archive):
            safe_member(member)
            total += member.size
            if index >= MAX_FILES or total > MAX_SOURCE or member.name in names:
                raise ValueError("Tarball size/count/duplicate-member contract failed")
            names.add(member.name)
        stream = archive.extractfile("package/package.json")
        raw = stream.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("Packed manifest budget exceeded")
        data = json.loads(raw)
        license_stream = archive.extractfile("package/LICENSE")
        if license_stream.read(len(license_text) + 1) != license_text or data.get("license") != "MIT":
            raise ValueError("MIT license mismatch")
    if data.get("name") not in expected or data.get("version") != expected[data["name"]]["version"]:
        raise ValueError("Packed name/version differs from the frozen graph")
    validate_dependencies(data, expected)
    integrity = "sha512-" + __import__("base64").b64encode(hashlib.sha512(bounded_bytes(path)).digest()).decode()
    return {"name": data["name"], "version": data["version"], "integrity": integrity,
            "dependencies": data.get("dependencies", {}),
            "optionalDependencies": data.get("optionalDependencies", {}),
            "path": str(path)}


def validate_dependencies(data, expected):
    for section in ("dependencies", "optionalDependencies", "peerDependencies", "devDependencies"):
        deps = data.get(section, {})
        if not isinstance(deps, dict):
            raise ValueError(f"Invalid dependency section: {section}")
        for name, spec in deps.items():
            if not isinstance(spec, str) or spec.startswith(("workspace:", "file:", "link:")):
                raise ValueError(f"Nonportable dependency: {section}:{name}")
            if name.startswith("@iris-ui-kit/") and section in ("dependencies", "optionalDependencies"):
                if name not in expected or spec != expected[name]["version"]:
                    raise ValueError(f"Incomplete/mismatched production graph: {name}")


def publication_order(packs):
    pending, result = dict(packs), []
    while pending:
        ready = [name for name, pack in sorted(pending.items())
                 if not (set(pack["dependencies"]) | set(pack["optionalDependencies"])) & pending.keys()]
        if not ready:
            raise ValueError("Cyclic production dependency graph")
        for name in ready:
            result.append(pending.pop(name))
    return result
