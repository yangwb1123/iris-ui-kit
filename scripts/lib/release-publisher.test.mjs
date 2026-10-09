import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Real stdlib/process/file checks plus explicitly mocked registry policy.
// This never supplies publication credentials or writes to a registry.
const code = String.raw`
import base64, hashlib, json, pathlib, subprocess, tempfile, unittest
from unittest.mock import patch
from scripts.release import iris_publish as publisher
from scripts.release import iris_publish_registry as registry
from scripts.release import iris_publish_process as process

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
            with patch.object(registry, 'run_command', side_effect=write), patch.object(registry, 'registry_view', return_value=None):
                with self.assertRaisesRegex(ValueError, 'unknown'):
                    registry.publish_one(root, pack, root)
                with self.assertRaisesRegex(ValueError, 'earlier write remains unknown'):
                    registry.registry_preflight(root, [pack])
            self.assertEqual(len(writes), 1)

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
  assert.match(result.stderr, /Ran 5 tests/)
  assert.match(result.stderr, /\bOK\b/)
})
