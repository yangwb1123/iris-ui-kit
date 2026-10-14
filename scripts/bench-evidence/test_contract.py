"""Protocol tests, not performance measurements or CI qualification."""
import copy
import json
import math
import os
import signal
import subprocess
import sys
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import collect
from contract import CASES, VARIANTS, expected_cases, plan, read_report, summarize, validate_report


def report(variant="current", duration=1.0):
    return {"schema": 1, "variant": variant, "completed": True, "cases": [
        {"id": key, "file": file, "name": name, "hz": 1000 / duration,
         "mean_ms": duration, "sample_count": 10, "samples_ms": [duration] * 10, "rme": 0}
        for key, (file, name) in expected_cases(variant).items()
    ]}


class ContractTests(unittest.TestCase):
    def test_fixed_balanced_plan(self):
        rows = plan(6)
        self.assertEqual(len(rows), 24)
        self.assertEqual([r["variant"] for r in rows[:4]], list(VARIANTS))
        self.assertEqual([r["variant"] for r in rows[4:8]], list(reversed(VARIANTS)))
        for variant in VARIANTS:
            self.assertEqual(sum(r["variant"] == variant for r in rows), 6)
        for invalid in [0, 7, True, 1.5, "6"]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                plan(invalid)

    def test_controls_are_only_the_original_unique_query_case(self):
        self.assertEqual(len(CASES), 6)
        self.assertEqual(set(expected_cases("native-control")), {"query"})
        self.assertEqual(set(expected_cases("fetcher-control")), {"query"})
        with self.assertRaises(ValueError):
            expected_cases("unknown")

    def test_valid_native_report(self):
        for variant in VARIANTS:
            value = report(variant)
            self.assertEqual(validate_report(value, variant), value)

    def test_report_identity_completeness_and_unknown_fields(self):
        changes = [lambda x: x.update(schema=2), lambda x: x.update(schema=True),
                   lambda x: x.update(variant="historical"), lambda x: x.update(completed=False),
                   lambda x: x.update(cases=[]), lambda x: x.update(extra="ignored?"),
                   lambda x: x["cases"].pop(), lambda x: x["cases"].append(copy.deepcopy(x["cases"][0])),
                   lambda x: x["cases"][0].update(file="../foreign.bench.ts"),
                   lambda x: x["cases"][0].update(name="lookalike"),
                   lambda x: x["cases"][0].update(extra=1)]
        for change in changes:
            value = report()
            change(value)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_report(value, "current")

    def test_invalid_measurements_never_become_zero_or_pass(self):
        for field in ["hz", "mean_ms", "sample_count", "rme"]:
            for bad in [True, "1", None, math.nan, math.inf, -1]:
                value = report()
                value["cases"][0][field] = bad
                with self.subTest(field=field, bad=bad), self.assertRaises(ValueError):
                    validate_report(value, "current")
        changes = [dict(hz=0), dict(mean_ms=0), dict(sample_count=11), dict(samples_ms=[]),
                   dict(samples_ms=[1] * 9 + [math.nan]), dict(samples_ms=[1] * 9 + [0]),
                   dict(hz=900), dict(mean_ms=2), dict(sample_count=10.5)]
        for change in changes:
            value = report()
            value["cases"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_report(value, "current")

    def test_bounded_regular_json_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            good = root / "good.json"
            good.write_text(json.dumps(report()))
            self.assertEqual(read_report(good), report())
            for content in ['{"schema":1,"schema":2}', '{"hz":NaN}', '[]', '{bad']:
                bad = root / "bad.json"
                bad.write_text(content)
                with self.subTest(content=content), self.assertRaises(ValueError):
                    read_report(bad)
            linked = root / "link"
            linked.symlink_to(good)
            with self.assertRaises(ValueError):
                read_report(linked)
            oversized = root / "oversized"
            with oversized.open("wb") as stream:
                stream.truncate(8 * 1024 * 1024 + 1)
            with self.assertRaises(ValueError):
                read_report(oversized)
            fifo = root / "fifo"
            os.mkfifo(fifo)
            with self.assertRaises(ValueError):
                read_report(fifo)

    def test_all_cohorts_required_and_no_acceptance_or_new_baseline(self):
        records = [{**row, "report": report(row["variant"], 1 + row["round"])} for row in plan(6)]
        result = summarize(records, 6)
        self.assertEqual(result["collection_status"], "complete")
        self.assertFalse(result["performance_accepted"])
        self.assertFalse(result["release_authorized"])
        self.assertEqual(result["medians_of_native_run_hz"]["query"]["current"], (1000 / 3 + 250) / 2)
        self.assertNotIn("new_baseline", result)
        for incomplete in [records[:-1], records + [records[0]], records[1:] + [records[1]]]:
            with self.assertRaises(ValueError):
                summarize(incomplete, 6)
        invalid = copy.deepcopy(records)
        invalid[0]["report"]["completed"] = False
        with self.assertRaises(ValueError):
            summarize(invalid, 6)


class OwnedStartupTests(unittest.TestCase):
    def check_failure_cleanup(self, interrupt):
        import iris_publish_process as owner
        real_popen = subprocess.Popen
        owned = []

        def start(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            owned.append(child)
            if interrupt:
                signal.raise_signal(signal.SIGALRM)
            return child

        def expired(_number, _frame):
            raise TimeoutError("injected absolute deadline at successful creation")

        previous = signal.signal(signal.SIGALRM, expired)
        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(owner.subprocess, "Popen", side_effect=start):
                command = [sys.executable, "-c", "import time; time.sleep(30)"]
                if interrupt:
                    with self.assertRaises(TimeoutError):
                        owner.run_command(command, directory, Path(directory) / "child.log", 2)
                else:
                    with patch.object(owner.threading.Thread, "start", side_effect=RuntimeError("reader start failed")):
                        with self.assertRaisesRegex(RuntimeError, "reader start failed"):
                            owner.run_command(command, directory, Path(directory) / "child.log", 2)
                self.assertEqual(len(owned), 1)
                self.assertIsNotNone(owned[0].poll(), "owned child leaked outside startup cleanup")
                self.assertIs(signal.getsignal(signal.SIGALRM), expired)
        finally:
            signal.signal(signal.SIGALRM, previous)
            for child in owned:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait(timeout=2)
                if child.stdout:
                    child.stdout.close()

    def test_reader_start_failure_reaps_owned_child(self):
        self.check_failure_cleanup(False)

    def test_alarm_after_popen_before_caller_assignment_reaps_owned_child(self):
        self.check_failure_cleanup(True)


class CollectorTests(unittest.TestCase):
    def test_output_existing_link_nested_and_ancestor_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "source"
            source.mkdir()
            output = collect.checked_output_path(base / "new", (source,))
            self.assertEqual(output, base / "new")
            linked = base / "link"
            linked.symlink_to(base / "missing")
            for bad in [source, source / "nested", linked, base, base / "missing-parent/out"]:
                with self.subTest(bad=bad), self.assertRaises(ValueError):
                    collect.checked_output_path(bad, (source,))

    def test_config_only_filters_cases_and_keeps_native_sampling_defaults(self):
        for variant in VARIANTS:
            text = collect.config_text(Path("/stage"), Path("/harness/vitest"), variant, Path("/cache"))
            config = json.loads(text.split("const config = ", 1)[1].split(";\n", 1)[0])
            self.assertEqual(config["test"]["maxWorkers"], 1)
            self.assertFalse(config["test"]["fileParallelism"])
            self.assertTrue(config["test"]["benchmark"]["includeSamples"])
            for forbidden in ["iterations", "warmupTime", "warmupIterations", "time", "setupFiles", "globalSetup"]:
                self.assertNotIn(forbidden, config["test"])
                self.assertNotIn(forbidden, config["test"]["benchmark"])
            self.assertEqual("config.plugins" in text, variant.endswith("-control"))
            if variant.endswith("-control"):
                self.assertIn("source === './query-cache'", text)
                self.assertIn("/stage/packages/core/src/resilience.bench.ts", text)

    def test_absolute_alarm_includes_setup_not_only_benchmark_children(self):
        argv = ["collect.py", "--reference-dir", "/unused", "--expected-head", "a" * 40,
                "--output-dir", "/unused", "--seconds", "1"]
        with patch("sys.argv", argv), patch.object(collect, "collect", side_effect=lambda _args: time.sleep(10)):
            self.assertEqual(collect.main(), 1)
        self.assertEqual(collect.signal.getitimer(collect.signal.ITIMER_REAL)[0], 0)

    def test_nonzero_child_cannot_publish_even_a_plausible_report(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ):
            output = Path(directory)
            with patch.object(collect, "run_command", return_value=1), patch.object(collect, "read_report") as read:
                with self.assertRaisesRegex(ValueError, "child failed"):
                    collect.run_cohort({"round": 0, "variant": "current"}, output,
                                       {"current": output / "stage"}, output / "vitest", collect.Budget(5))
                read.assert_not_called()
            self.assertFalse((output / "00-current.verified.json").exists())
            self.assertTrue((output / "00-current.intent.json").is_file())

    def test_create_only_metadata_and_nonfinite_output(self):
        from contract import save_new
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.json"
            save_new(path, {"original": True})
            with self.assertRaises(FileExistsError):
                save_new(path, {"overwrite": True})
            self.assertEqual(json.loads(path.read_text()), {"original": True})
            with self.assertRaises(ValueError):
                save_new(Path(directory) / "invalid.json", {"value": math.nan})


if __name__ == "__main__":
    unittest.main()
