from __future__ import annotations

import asyncio
import io
from datetime import timedelta

from minio import Minio
from minio.error import S3Error

from kb.config import Settings


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self.ttl = timedelta(seconds=settings.presign_ttl_seconds)
        self.client = Minio(
            settings.s3_endpoint,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            secure=settings.s3_secure,
            region=settings.s3_region,
        )
        self.public_client = Minio(
            settings.s3_public_endpoint,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            secure=settings.s3_secure,
            region=settings.s3_region,
        )

    def ensure_bucket_sync(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self.ensure_bucket_sync)

    async def presign_put(self, key: str) -> str:
        return await asyncio.to_thread(self.public_client.presigned_put_object, self.bucket, key, self.ttl)

    async def presign_get(self, key: str, filename: str | None = None) -> str:
        headers: dict[str, str | list[str] | tuple[str]] | None = None
        if filename:
            safe = filename.replace('"', "")
            headers = {"response-content-disposition": f'inline; filename="{safe}"'}
        return await asyncio.to_thread(
            self.public_client.presigned_get_object, self.bucket, key, self.ttl, headers
        )

    def get_bytes_sync(self, key: str) -> bytes:
        response = self.client.get_object(self.bucket, key)
        try:
            return bytes(response.read())
        finally:
            response.close()
            response.release_conn()

    async def get_bytes(self, key: str) -> bytes:
        return await asyncio.to_thread(self.get_bytes_sync, key)

    def put_bytes_sync(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(self.bucket, key, io.BytesIO(data), len(data), content_type=content_type)

    async def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self.put_bytes_sync, key, data, content_type)

    def stat_size_sync(self, key: str) -> int | None:
        try:
            stat = self.client.stat_object(self.bucket, key)
        except S3Error:
            return None
        return int(stat.size or 0)

    async def stat_size(self, key: str) -> int | None:
        return await asyncio.to_thread(self.stat_size_sync, key)

    def delete_sync(self, key: str) -> None:
        self.client.remove_object(self.bucket, key)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.delete_sync, key)

    def delete_prefix_sync(self, prefix: str) -> None:
        for obj in self.client.list_objects(self.bucket, prefix=prefix, recursive=True):
            if obj.object_name:
                self.client.remove_object(self.bucket, obj.object_name)

    def remove_bucket_sync(self) -> None:
        if self.client.bucket_exists(self.bucket):
            self.delete_prefix_sync("")
            self.client.remove_bucket(self.bucket)
