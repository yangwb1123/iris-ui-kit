import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Real stdlib/process/file checks plus explicitly mocked registry policy.
// This never supplies publication credentials or writes to a registry.
const code = String.raw`
import base64, hashlib, io, json, os, pathlib, subprocess, tarfile, tempfile, time, unittest
from unittest.mock import patch
from scripts.release import iris_publish as publisher
from scripts.release import iris_publish_registry as registry
from scripts.release import iris_publish_process as process
from scripts.release import iris_publish_contract as contract

class Contract(unittest.TestCase):
    def test_legacy_bypasses_are_rejected(self):
        for flag in ['--skip-gates', '--package=vue', '--version=0.3.0', '--commit']:
            with self.subTest(flag=flag), self.assertRaises(SystemExit) as exc:
                publisher.arguments(['--dry-run', '--output-dir', '/tmp/fixture-only', flag])
            self.assertEqual(exc.exception.code, 2)

    def test_publication_needs_actual_ci_and_provenance(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaises(ValueError):
            registry.check_provenance_context('a' * 40)
        with patch.object(registry, 'capture', return_value=b'{}'), self.assertRaises(ValueError):
            registry.check_ci(pathlib.Path('.'), '123', 'a' * 40)

    def test_registry_conflicting_integrity_blocks(self):
        pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0', 'integrity':'sha512-approved'}
        with self.assertRaises(ValueError):
            registry.verify_current(pack, {'dist':{'integrity':'sha512-conflicting'}})

    def test_unknown_intent_precedes_write_and_blocks_new_invocation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            subprocess.run(['git','init','-q',str(root)], check=True)
            artifact = root / 'fixture.tgz'
            artifact.write_bytes(b'fixture')
            pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0', 'path':str(artifact),
                    'integrity':'sha512-' + base64.b64encode(hashlib.sha512(b'fixture').digest()).decode()}
            writes = []
            def write(*args):
                self.assertEqual(registry.publication_journal(root)[pack['name']+'@'+pack['version']], 'outcome_unknown')
                writes.append(args)
                return 124
            with patch.object(registry, 'run_command', side_effect=write), patch.object(registry, 'registry_view', return_value=None), patch.object(registry.time, 'sleep'), patch.object(registry, 'create_workflow_marker'):
                with self.assertRaisesRegex(ValueError, 'unknown'):
                    registry.publish_one(root, pack, root)
                with self.assertRaisesRegex(ValueError, 'earlier write remains unknown'):
                    registry.registry_preflight(root, [pack])
            self.assertEqual(len(writes), 1)

    def test_async_registry_visibility_is_reconciled_after_bounded_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            subprocess.run(['git','init','-q',str(root)], check=True)
            artifact = root / 'fixture.tgz'
            artifact.write_bytes(b'fixture')
            pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0', 'path':str(artifact),
                    'integrity':'sha512-' + base64.b64encode(hashlib.sha512(b'fixture').digest()).decode(),
                    'dependencies':{}, 'optionalDependencies':{}}
            views = [None, None, {'dist':{'integrity':pack['integrity']},'dependencies':{},'optionalDependencies':{}}]
            with patch.object(registry, 'run_command', return_value=0), patch.object(registry, 'registry_view', side_effect=views), patch.object(registry.time, 'sleep'), patch.object(registry, 'create_workflow_marker'):
                result = registry.publish_one(root, pack, root)
            self.assertEqual(result['status'], 'registry_verified')
            self.assertEqual(registry.publication_journal(root)[pack['name']+'@'+pack['version']], 'registry_verified')

    def test_receipt_failure_prevents_write(self):
        pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0'}
        receipt = {'published':False, 'publications':[]}
        def broken():
            raise OSError('mandatory receipt unavailable')
        with patch.object(publisher, 'registry_preflight', return_value=set()), patch.object(publisher, 'capture', return_value=b'fixture-user'), patch.object(publisher, 'publish_one') as write:
            with self.assertRaises(OSError):
                publisher.publish_graph(pathlib.Path('.'), [pack], pathlib.Path('.'), receipt, broken)
            write.assert_not_called()
        self.assertIsNone(receipt['published'])

    def test_canonical_duplicate_manifest_is_rejected(self):
        data = {'name':'@iris-ui-kit/core', 'version':'0.2.7', 'license':'MIT'}
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'duplicate.tgz'
            with tarfile.open(path, 'w:gz') as archive:
                for name, content in [('package/package.json',json.dumps(data).encode()), ('package/LICENSE',b'MIT'), ('package/./package.json',json.dumps({**data,'version':'9.9.9'}).encode())]:
                    member = tarfile.TarInfo(name); member.size = len(content)
                    archive.addfile(member, io.BytesIO(content))
            with self.assertRaises(ValueError):
                contract.read_pack(path, {data['name']:{'version':data['version']}}, b'MIT')

    def test_hidden_pax_bytes_cannot_escape_file_or_total_budgets(self):
        data = {'name':'@iris-ui-kit/core', 'version':'0.2.7', 'license':'MIT'}
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'pax.tgz'
            with tarfile.open(path, 'w:gz', format=tarfile.PAX_FORMAT) as archive:
                member = tarfile.TarInfo('package/package.json')
                body = json.dumps(data).encode(); member.size = len(body)
                member.pax_headers = {'comment':'x' * 12000}
                archive.addfile(member, io.BytesIO(body))
                member = tarfile.TarInfo('package/LICENSE'); member.size = 3
                archive.addfile(member, io.BytesIO(b'MIT'))
            with patch.object(contract, 'MAX_FILE', 4096), patch.object(contract, 'MAX_SOURCE',8192), self.assertRaises(ValueError):
                contract.read_pack(path, {data['name']:{'version':data['version']}}, b'MIT')

    def test_successful_leader_does_not_leave_owned_child_running(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory); log = root/'owned.log'
            script = 'import os,time; pid=os.fork();\\nif pid == 0:\\n os.close(1); os.close(2); time.sleep(20); os._exit(0)\\nprint(pid,flush=True)'
            # Decode fixture escapes only; this remains a real POSIX child.
            script = script.replace('\\n', '\n')
            pid = None
            try:
                self.assertEqual(process.run_command(['python3','-B','-c',script],root,log,2),0)
                pid = int(log.read_text().strip())
                stat = pathlib.Path('/proc')/str(pid)/'stat'
                # SIGKILL delivery is asynchronous; wait for the actual stopped
                # state, never treat kill(0) success as evidence of execution.
                deadline = time.monotonic() + 0.5
                while stat.exists() and time.monotonic() < deadline:
                    if stat.read_text().split(') ',1)[1].split()[0] in ['Z','X']:
                        break
                    time.sleep(0.01)
                if stat.exists():
                    self.assertIn(stat.read_text().split(') ',1)[1].split()[0], ['Z','X'])
            finally:
                if pid is not None:
                    try: os.kill(pid,9)
                    except ProcessLookupError: pass

    def test_retained_intent_blocks_fresh_worker_with_empty_local_journal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            subprocess.run(['git','init','-q',str(root)], check=True)
            pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0'}
            ref = registry.workflow_marker(pack)
            response = json.dumps([{'ref':ref,'object':{'sha':'a'*40}}]).encode()
            with patch.object(registry,'registry_view',return_value=None), patch.object(registry,'capture',return_value=response):
                with self.assertRaisesRegex(ValueError, 'workflow write intent remains unresolved'):
                    registry.registry_preflight(root,[pack])

    def test_atomic_remote_intent_failure_prevents_npm_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            subprocess.run(['git','init','-q',str(root)], check=True)
            artifact = root/'fixture.tgz'; artifact.write_bytes(b'fixture')
            pack = {'name':'@iris-ui-kit/vue', 'version':'0.3.0', 'path':str(artifact),
                    'integrity':'sha512-'+base64.b64encode(hashlib.sha512(b'fixture').digest()).decode()}
            env = {'GITHUB_ACTIONS':'true','GITHUB_SHA':'a'*40}
            with patch.dict(os.environ,env), patch.object(registry,'capture',side_effect=ValueError('retained ref already exists or outcome unknown')), patch.object(registry,'run_command') as write:
                with self.assertRaises(ValueError): registry.publish_one(root,pack,root)
                write.assert_not_called()
            self.assertEqual(registry.publication_journal(root)[pack['name']+'@'+pack['version']], 'outcome_unknown')

unittest.main(argv=['owned-contract'], verbosity=2)
`

test('standalone publisher fails closed for authorization, integrity and unknown writes', () => {
  const result = spawnSync('python3', ['-B', '-c', code], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 128 * 1024,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /Ran 11 tests/)
  assert.match(result.stderr, /\bOK\b/)
})
