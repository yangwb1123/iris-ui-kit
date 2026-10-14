"""Bounded diagnostic evidence protocol; never approves performance or a baseline."""
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import statistics

BASELINE_HEAD = "8b694b9e242d6db033b5320e0b843fbebb391318"
VARIANTS = ("historical", "current", "native-control", "fetcher-control")
CASES = {
    "validation": ("src/form.bench.ts", "validate 10 fields × 1k iterations"),
    "array": ("src/form.bench.ts", "insert + remove 1k rows"),
    "swap": ("src/form.bench.ts", "500 swaps (reorder simulation)"),
    "query": ("src/resilience.bench.ts", "10k unique fetches (no cache hits)"),
    "construction": ("src/scale.bench.ts", "construct + initial sync load"),
    "notifications": ("src/scale.bench.ts", "post 1000 notifications"),
}
MAX_REPORT = 8 * 1024 * 1024
MAX_SAMPLES = 250_000


def expected_cases(variant):
    if variant not in VARIANTS:
        raise ValueError("Unknown variant")
    return {"query": CASES["query"]} if variant.endswith("-control") else dict(CASES)


def plan(pairs):
    if type(pairs) is not int or not 1 <= pairs <= 6:
        raise ValueError("Cohort count must be an integer in 1..6")
    return [{"round": index, "variant": variant} for index in range(pairs)
            for variant in (VARIANTS if index % 2 == 0 else tuple(reversed(VARIANTS)))]


def exact_keys(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError("Unexpected or missing evidence fields")


def numeric(value, *, zero=False):
    try:
        valid = type(value) in (int, float) and math.isfinite(value) and (value >= 0 if zero else value > 0)
    except (OverflowError, TypeError):
        valid = False
    if not valid:
        raise ValueError("Invalid numeric measurement")


def validate_case(row, expected):
    exact_keys(row, ("id", "file", "name", "hz", "mean_ms", "sample_count", "samples_ms", "rme"))
    if not isinstance(row["id"], str) or row["id"] not in expected:
        raise ValueError("Unexpected benchmark identity")
    if (row["file"], row["name"]) != expected[row["id"]]:
        raise ValueError("Benchmark identity does not match the declared workload")
    for key in ("hz", "mean_ms", "sample_count"):
        numeric(row[key])
    numeric(row["rme"], zero=True)
    count, samples = row["sample_count"], row["samples_ms"]
    if type(count) is not int or not 2 <= count <= MAX_SAMPLES:
        raise ValueError("Invalid sample count")
    if not isinstance(samples, list) or len(samples) != count:
        raise ValueError("Missing native samples")
    for value in samples:
        numeric(value)
    mean = statistics.fmean(samples)
    if not math.isclose(mean, row["mean_ms"], rel_tol=1e-7, abs_tol=1e-12):
        raise ValueError("Native mean disagrees with retained samples")
    if not math.isclose(row["hz"], 1000 / mean, rel_tol=1e-7):
        raise ValueError("Native throughput disagrees with retained samples")


def validate_report(value, variant):
    exact_keys(value, ("schema", "variant", "completed", "cases"))
    if type(value["schema"]) is not int or value["schema"] != 1:
        raise ValueError("Unknown evidence schema")
    if value["variant"] != variant or value["completed"] is not True:
        raise ValueError("Incomplete or mismatched benchmark execution")
    expected = expected_cases(variant)
    rows = value["cases"]
    if not isinstance(rows, list) or len(rows) != len(expected):
        raise ValueError("Missing or extra benchmark cases")
    seen, count = set(), 0
    for row in rows:
        validate_case(row, expected)
        if row["id"] in seen:
            raise ValueError("Duplicate benchmark case")
        seen.add(row["id"])
        count += row["sample_count"]
    if seen != set(expected) or count > MAX_SAMPLES:
        raise ValueError("Incomplete evidence or sample budget exceeded")
    return value


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def _constant(_value):
    raise ValueError("Nonfinite JSON constant")


def read_report(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    except OSError as error:
        raise ValueError("Evidence must be a regular, unlinked file") from error
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_REPORT:
            raise ValueError("Invalid evidence file or byte budget")
        raw = stream.read(MAX_REPORT + 1)
        if len(raw) > MAX_REPORT:
            raise ValueError("Evidence byte budget exceeded")
    value = json.loads(raw, object_pairs_hook=_object, parse_constant=_constant)
    if not isinstance(value, dict):
        raise ValueError("Evidence root must be an object")
    return value


def save_new(path, value):
    """Create-only atomic evidence; an interrupted partial is retained, never reused."""
    path = Path(path)
    payload = (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode()
    if len(payload) > MAX_REPORT:
        raise ValueError("Evidence byte budget exceeded")
    partial = path.with_name(path.name + ".partial")
    with partial.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    os.link(partial, path)  # EEXIST is refusal, never overwrite another result
    partial.unlink()
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def summarize(records, pairs):
    expected_plan = plan(pairs)
    if len(records) != len(expected_plan):
        raise ValueError("Incomplete cohort plan")
    values = {key: {} for key in CASES}
    for record, expected in zip(records, expected_plan):
        exact_keys(record, ("round", "variant", "report"))
        if type(record["round"]) is not int or {k: record[k] for k in expected} != expected:
            raise ValueError("Missing, duplicate, reordered or replayed cohort")
        report = validate_report(record["report"], record["variant"])
        for row in report["cases"]:
            values[row["id"]].setdefault(record["variant"], []).append(row["hz"])
    medians = {key: {variant: statistics.median(samples) for variant, samples in variants.items()}
               for key, variants in values.items()}
    return {"collection_status": "complete", "performance_accepted": False,
            "release_authorized": False, "source_semantics_equivalent": False,
            "cohorts_per_variant": pairs, "medians_of_native_run_hz": medians,
            "current_over_historical": {key: row["current"] / row["historical"] for key, row in medians.items()},
            "limits": ["Selected six original callbacks, not the original whole regression gate",
                       "Native samples are callback durations, not individual request latencies",
                       "Historical and diagnostic-control semantics differ; no production fallback",
                       "Host/Actions environment claims need external verification; no automatic calibration"]}


def digest(path):
    with Path(path).open("rb") as stream:
        raw = stream.read(64 * 1024 * 1024 + 1)
        if len(raw) > 64 * 1024 * 1024:
            raise ValueError("Fingerprint byte budget exceeded")
        return hashlib.sha256(raw).hexdigest()
