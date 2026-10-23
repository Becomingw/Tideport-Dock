"""Personal S3 connections and exact-object scope checks for server transfers."""
import os


def validate_ref(cfg, ref):
    if not isinstance(ref, dict) or not isinstance(ref.get('key'), str):
        raise ValueError('object reference must contain bucket and key')
    bucket, key = ref.get('bucket'), ref['key']
    if bucket != cfg['bucket'] or not key.startswith(cfg.get('prefix', '')):
        raise ValueError('object is outside configured bucket/prefix')
    if not key or key.startswith('/') or '..' in key.split('/'):
        raise ValueError('invalid object key')
    for name in ('etag', 'version_id'):
        if name in ref and (not isinstance(ref[name], str) or not ref[name] or any(ord(c) < 32 for c in ref[name])):
            raise ValueError('Invalid object version identity')
    return {'Bucket': bucket, 'Key': key, **({'IfMatch': ref['etag']} if ref.get('etag') else {}),
            **({'VersionId': ref['version_id']} if ref.get('version_id') else {})}


def safe_error(error):
    code = (getattr(error, 'response', None) or {}).get('Error', {}).get('Code', '')
    allowed = {'AccessDenied', 'NoSuchKey', 'NoSuchBucket', 'PreconditionFailed', 'InvalidAccessKeyId',
               'SignatureDoesNotMatch', 'ExpiredToken', 'SlowDown', 'InternalError', 'ServiceUnavailable',
               'RequestTimeout', '403', '404', '412', '500', '503'}
    if code in allowed:
        return code
    name = type(error).__name__
    return name if name in {'EndpointConnectionError', 'ConnectTimeoutError', 'ReadTimeoutError',
                            'ResponseStreamingError', 'IncompleteReadError', 'SSLError',
                            'ProfileNotFound', 'NoCredentialsError', 'PartialCredentialsError'} else 'TransportError'


def validate_transport_config(cfg):
    from urllib.parse import urlsplit
    url = urlsplit(cfg.get('endpoint', ''))
    if url.scheme not in ('https', 'http') or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('endpoint must be an http(s) service URL without credentials or query')
    if not isinstance(cfg.get('bucket'), str) or not cfg['bucket']:
        raise ValueError('bucket is required')
    prefix = cfg.get('prefix', '')
    if not isinstance(prefix, str) or (prefix and (not prefix.endswith('/') or prefix.startswith('/') or '..' in prefix.split('/'))):
        raise ValueError('prefix must be empty or a relative directory ending with /')
    for key in ('insecure_tls', 'allow_writes'):
        if key in cfg and type(cfg[key]) is not bool:
            raise ValueError(f'{key} must be boolean')
    limit = cfg.get('max_transfer_mib', 512)
    if type(limit) is not int or not 1 <= limit <= 5120:
        raise ValueError('max_transfer_mib must be an integer in 1..5120')
    return cfg


class S3Connection:
    def __init__(self, config):
        self.config = dict(validate_transport_config(config))
        self._client = None

    def client(self):
        if self._client is None:
            import boto3
            from botocore.config import Config
            cfg = self.config
            verify = cfg.get('ca_bundle') or (not cfg.get('insecure_tls', False))
            if isinstance(verify, str):
                verify = os.path.expanduser(verify)
            try:
                self._client = boto3.Session(profile_name=cfg.get('profile', 'osslab')).client(
                    's3', endpoint_url=cfg['endpoint'], region_name=cfg.get('region', 'us-east-1'), verify=verify,
                    config=Config(signature_version='s3v4', s3={'addressing_style': 'path'},
                                  connect_timeout=5, read_timeout=30,
                                  retries={'mode': 'standard', 'total_max_attempts': 1}, max_pool_connections=2))
            except Exception as error:
                raise RuntimeError(f'OSS client unavailable ({safe_error(error)})') from None
        return self._client

