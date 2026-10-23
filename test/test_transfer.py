"""Offline checks for exact-object server transfers."""
import hashlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'transfers'))
from remote_transfer import transfer, stream_object
from s3_transport import S3Connection, validate_ref, validate_transport_config


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.cfg = {'endpoint': 'https://s3.example.invalid', 'bucket': 'test-bucket', 'prefix': 'docs/'}
        self.data = b'example document\n'
        self.etag = '"version-one"'

    def test_scope_and_config(self):
        self.assertEqual(validate_ref(self.cfg, {'bucket': 'test-bucket', 'key': 'docs/a'})['Key'], 'docs/a')
        for ref in [{'bucket': 'other-bucket', 'key': 'docs/a'}, {'bucket': 'test-bucket', 'key': 'docs/../a'}]:
            with self.assertRaises(ValueError):
                validate_ref(self.cfg, ref)
        for update in [{'allow_writes': 'true'}, {'max_transfer_mib': 0}, {'endpoint': 'https://user:secret@example.invalid'}]:
            with self.assertRaises(ValueError):
                validate_transport_config({**self.cfg, **update})

    def client(self):
        data, etag = self.data, self.etag
        class Client:
            def head_object(self, **args):
                return {'ContentLength': len(data), 'ETag': etag}
            def get_object(self, **args):
                return {'ContentLength': len(data), 'ETag': etag, 'Body': io.BytesIO(data)}
        return Client()

    def test_download_plan_and_atomic_publish(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(S3Connection, 'client', return_value=self.client()):
            target = Path(directory) / 'document.txt'
            spec = {'direction': 'download', 'local_path': str(target), 'object': {'bucket': 'test-bucket', 'key': 'docs/a'}}
            self.assertFalse(transfer(self.cfg, spec)['executed'])
            self.assertFalse(target.exists())
            result = transfer(self.cfg, spec, True)
            self.assertTrue(result['version_pinned'])
            self.assertEqual(target.read_bytes(), self.data)
            with self.assertRaisesRegex(ValueError, 'overwrite'):
                transfer(self.cfg, spec, True)

    def test_bad_hash_leaves_no_destination_or_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(S3Connection, 'client', return_value=self.client()):
            target = Path(directory) / 'document.txt'
            spec = {'direction': 'download', 'local_path': str(target), 'sha256': '0'*64,
                    'object': {'bucket': 'test-bucket', 'key': 'docs/a'}}
            with self.assertRaisesRegex(ValueError, 'SHA256'):
                transfer(self.cfg, spec, True)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_upload_is_gated_conditional_and_verified(self):
        from botocore.exceptions import ClientError
        payload, etag = self.data, self.etag
        class Client:
            def head_object(self, **args):
                raise ClientError({'Error': {'Code': '404'}, 'ResponseMetadata': {'HTTPStatusCode': 404}}, 'HeadObject')
            def put_object(inner, **args):
                self.assertEqual(args['IfNoneMatch'], '*')
                self.assertEqual(args['Body'].read(), payload)
                return {'ETag': etag}
            def get_object(inner, **args):
                self.assertEqual(args['IfMatch'], etag)
                return {'Body': io.BytesIO(payload), 'ContentLength': len(payload), 'ETag': etag}
        with tempfile.TemporaryDirectory() as directory, patch.object(S3Connection, 'client', return_value=Client()):
            path = Path(directory) / 'document.txt'; path.write_bytes(payload)
            spec = {'direction': 'upload', 'local_path': str(path), 'object': {'bucket': 'test-bucket', 'key': 'docs/a'}}
            self.assertFalse(transfer(self.cfg, spec)['upload_enabled'])
            with self.assertRaisesRegex(ValueError, 'disabled'):
                transfer(self.cfg, spec, True)
            result = transfer({**self.cfg, 'allow_writes': True}, spec, True)
            self.assertTrue(result['verified'])
            self.assertEqual(result['sha256'], hashlib.sha256(payload).hexdigest())

    def test_short_body_is_rejected_and_closed(self):
        body = io.BytesIO(b'no')
        class Client:
            def get_object(self, **args):
                return {'Body': body, 'ContentLength': 5}
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            stream_object(Client(), {}, expected_size=5)
        self.assertTrue(body.closed)


if __name__ == '__main__':
    unittest.main()
