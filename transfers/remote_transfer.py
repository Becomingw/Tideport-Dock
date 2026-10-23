"""Single-file server-side transfer; plan by default, no overwrite or deletion."""
import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path
import tempfile
import time
from s3_transport import S3Connection, validate_ref, safe_error


def stream_object(client, args, destination=None, expected_size=None, progress=None):
    response = client.get_object(**args)
    body, digest, size = response['Body'], hashlib.sha256(), 0
    try:
        if args.get('IfMatch') and response.get('ETag') != args['IfMatch']:
            raise ValueError('Object version changed')
        if args.get('VersionId') and response.get('VersionId') != args['VersionId']:
            raise ValueError('Object version changed')
        if response.get('ContentLength') != expected_size:
            raise ValueError('Object size changed')
        while True:
            chunk = body.read(1024**2)
            if not chunk:
                break
            size += len(chunk)
            if size > expected_size:
                raise ValueError('Object exceeds expected size')
            digest.update(chunk)
            if destination is not None:
                destination.write(chunk)
            if progress:
                progress(size, expected_size)
        if size != expected_size:
            raise ValueError('Incomplete download; final destination was not published')
    finally:
        body.close()
    return digest.hexdigest(), size


def transfer(config, spec, execute=False, progress=None):
    from botocore.exceptions import ClientError
    connection = S3Connection(config)
    args = validate_ref(config, spec['object'])
    direction = spec.get('direction')
    if direction not in ('upload', 'download'):
        raise ValueError('direction must be upload or download')
    path = Path(spec['local_path']).expanduser()
    if not path.is_absolute():
        raise ValueError('local_path must be absolute on the compute server')
    expected_hash = spec.get('sha256')
    if expected_hash is not None and (len(expected_hash) != 64 or any(c not in '0123456789abcdef' for c in expected_hash)):
        raise ValueError('sha256 must be lowercase hex')
    client = connection.client()
    head_args = {key: value for key, value in args.items() if key in ('Bucket', 'Key', 'VersionId')}
    try:
        head = client.head_object(**head_args)
    except ClientError as error:
        if error.response.get('ResponseMetadata', {}).get('HTTPStatusCode') != 404:
            raise RuntimeError(f'OSS transfer preflight failed ({safe_error(error)})') from None
        head = None
    if direction == 'download':
        if head is None:
            raise ValueError('Object does not exist')
        if path.exists() or path.is_symlink():
            raise ValueError('Refusing to overwrite local destination')
        if not path.parent.is_dir():
            raise ValueError('Destination parent directory must already exist')
        if args.get('IfMatch') and head.get('ETag') != args['IfMatch']:
            raise ValueError('Object version changed')
        if head.get('VersionId'):
            args['VersionId'] = head['VersionId']
        if head.get('ETag'):
            args['IfMatch'] = head['ETag']
        if not ('VersionId' in args or 'IfMatch' in args):
            raise ValueError('Download requires a version identity')
        size = head['ContentLength']
        if not execute:
            return {'executed': False, 'direction': direction, 'bytes': size, 'atomic_local_publish': True}
        if shutil.disk_usage(path.parent).free < size:
            raise ValueError('Insufficient space for atomic download staging')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.osslab-', delete=False) as output:
                temporary = output.name
                digest, size = stream_object(client, args, output, size, progress)
                if expected_hash and digest != expected_hash:
                    raise ValueError('SHA256 mismatch; destination was not published')
                output.flush(); os.fsync(output.fileno())
            # Atomic no-clobber publication, including a concurrent local creator.
            os.link(temporary, path)
            return {'executed': True, 'direction': direction, 'bytes': size, 'sha256': digest,
                    'sha256_verified': bool(expected_hash), 'version_pinned': True}
        finally:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
    if head is not None:
        raise ValueError('Refusing to overwrite existing OSS object')
    if not path.is_file():
        raise ValueError('Upload source must be a completed regular file')
    size = path.stat().st_size
    limit = config.get('max_transfer_mib', 512)
    if type(limit) is not int or not 1 <= limit <= 5120 or size > limit * 1024**2:
        raise ValueError('Upload exceeds single-object transfer limit; multipart requires a separately validated adapter')
    plan = {'executed': False, 'direction': direction, 'bytes': size, 'upload_enabled': config.get('allow_writes') is True,
            'conditional_create': True, 'verification': 'read-back SHA256 (additional full GET)'}
    if not execute:
        return plan
    if config.get('allow_writes') is not True:
        raise ValueError('Uploads disabled in generated configuration')
    with path.open('rb') as source:
        before = os.fstat(source.fileno())
        if before.st_size != size:
            raise ValueError('Source changed after plan; rerun against a completed file')
        hasher = hashlib.sha256()
        while True:
            chunk = source.read(1024**2)
            if not chunk:
                break
            hasher.update(chunk)
        digest = hasher.hexdigest()
        if expected_hash and expected_hash != digest:
            raise ValueError('Source SHA256 mismatch')
        source.seek(0)
        # Never downgrade to an unconditional write if the S3 implementation
        # rejects conditional creation. An ambiguous transport failure needs HEAD.
        try:
            response = client.put_object(Bucket=args['Bucket'], Key=args['Key'], Body=source,
                                         ContentLength=size, IfNoneMatch='*', Metadata={'sha256': digest})
        except Exception as error:
            raise RuntimeError(f'Upload not confirmed ({safe_error(error)}); inspect target before retrying, never overwrite') from None
        after = os.fstat(source.fileno())
        if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
            return {**plan, 'executed': True, 'verified': False, 'error': 'Source changed during upload; inspect target, no automatic deletion'}
    verify_args = {key: args[key] for key in ('Bucket', 'Key')}
    if response.get('ETag'):
        verify_args['IfMatch'] = response['ETag']
    if response.get('VersionId'):
        verify_args['VersionId'] = response['VersionId']
    try:
        if len(verify_args) == 2:
            raise ValueError('Upload response omitted version identity')
        received, _ = stream_object(client, verify_args, expected_size=size, progress=progress)
        verified = received == digest
        return {**plan, 'executed': True, 'verified': verified, 'sha256': digest}
    except Exception:
        return {**plan, 'executed': True, 'verified': False, 'error': 'Upload completed but read-back verification failed; inspect target'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--spec', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    with open(args.config) as f:
        config = json.load(f)
    with open(args.spec) as f:
        spec = json.load(f)
    last = [0.]
    def progress(size, total):
        now = time.monotonic()
        if now - last[0] >= 2 or size == total:
            print(json.dumps({'phase': 'streaming', 'bytes': size, 'total_bytes': total}), flush=True)
            last[0] = now
    try:
        result = transfer(config, spec, args.execute, progress)
        print(json.dumps(result), flush=True)
        raise SystemExit(2 if result.get('verified') is False else 0)
    except Exception as error:
        # Avoid raw SDK messages and local/remote object paths in job logs.
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else safe_error(error)
        print(json.dumps({'ok': False, 'error': message}), flush=True)
        raise SystemExit(2)


if __name__ == '__main__':
    main()
