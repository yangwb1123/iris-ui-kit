"""Owned process groups, absolute deadlines and bounded byte diagnostics."""
from contextlib import contextmanager, ExitStack
import json
import os
import signal
import subprocess
import tempfile
import threading
import time
from pathlib import Path


def _drain(pipe, output, budget, overflow):
    written = 0
    try:
        while True:
            chunk = pipe.read(8192)
            if not chunk:
                break
            allowed = min(len(chunk), max(0, budget - written))
            output.write(chunk[:allowed])
            written += len(chunk)
            if written > budget:
                overflow.set()
                break
    except BaseException:
        overflow.set()  # mandatory diagnostic persistence failure is not success
    finally:
        pipe.close()


def _stop_owned(proc):
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait(timeout=10)


@contextmanager
def _defer_spawn_interrupts():
    """Deliver Python interrupts only after the caller owns the returned child.

    Do not block OS signal masks: child exec semantics remain unchanged. ExitStack
    restores every handler even if another interruption occurs during restoration.
    Python signal callbacks run on the main thread, not on a worker spawning a child.
    """
    pending, previous = {}, {}

    def defer(number, frame):
        pending.setdefault(number, frame)

    with ExitStack() as restore:
        if threading.current_thread() is threading.main_thread():
            for number in (signal.SIGALRM, signal.SIGINT):
                handler = signal.getsignal(number)
                if callable(handler):
                    previous[number] = handler
                    restore.callback(signal.signal, number, handler)
                    signal.signal(number, defer)
        yield
    for number, frame in pending.items():
        previous[number](number, frame)


def run_command(args, cwd, log, timeout, max_output=64 * 1024 * 1024):
    if os.name != "posix" or not 0 < timeout <= 7200 or not 0 < max_output <= 64 * 1024 * 1024:
        raise ValueError("Invalid/unsupported process budget")
    log = Path(log)
    log.parent.mkdir(parents=True, exist_ok=True)
    metadata = {"argv": args, "cwd": str(cwd), "started": time.time(), "timeout": timeout}
    env = {**os.environ, "HUSKY": "0", "CI": "1", "NEXT_TELEMETRY_DISABLED": "1", "NUXT_TELEMETRY_DISABLED": "1"}
    overflow, deadline = threading.Event(), time.monotonic() + timeout
    with log.open("wb") as output:
        proc, reader = None, None
        try:
            with _defer_spawn_interrupts():
                proc = subprocess.Popen(args, cwd=cwd, env=env, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, start_new_session=True)
            reader = threading.Thread(target=_drain, args=(proc.stdout, output, max_output, overflow), daemon=True)
            reader.start()
            while proc.poll() is None and time.monotonic() < deadline and not overflow.is_set():
                time.sleep(0.02)
            expired = time.monotonic() >= deadline
            # A successful/reaped leader may leave silent descendants holding
            # the owned session alive. Clean that group on every exit, not only
            # on timeout or when an inherited stdout pipe happens to stay open.
            _stop_owned(proc)
            reader.join(timeout=max(0, deadline - time.monotonic()))
            if reader.is_alive():
                _stop_owned(proc)
                reader.join(timeout=2)
            expired = expired or time.monotonic() >= deadline
            code = 124 if expired else (125 if overflow.is_set() or reader.is_alive() else proc.returncode)
        except BaseException:
            if proc is not None:
                _stop_owned(proc)
                if reader is not None and reader.ident is not None:
                    reader.join(timeout=2)
                elif proc.stdout is not None:
                    proc.stdout.close()
            raise
    metadata.update({"finished": time.time(), "exit": code})
    log.with_suffix(log.suffix + ".json").write_text(json.dumps(metadata, indent=2) + "\n")
    return code


def capture(args, cwd, timeout=30, limit=2 * 1024 * 1024):
    with tempfile.TemporaryDirectory(prefix="iris-publish-read-") as directory:
        log = Path(directory) / "read.log"
        code = run_command(args, cwd, log, timeout, limit)
        if code:
            raise ValueError(f"Read command failed ({code}): {args[0]}")
        return log.read_bytes()
