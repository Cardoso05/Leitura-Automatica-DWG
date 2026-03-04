 import os
 import uuid
 from pathlib import Path
 from typing import BinaryIO

 import aiofiles
 import boto3
 from fastapi import UploadFile

 from app.core.config import get_settings


 class StorageService:
     def __init__(self) -> None:
         self.settings = get_settings()
         self.storage_root = Path(self.settings.storage_local_path)
         self.results_root = Path(self.settings.storage_results_path)
         self.storage_root.mkdir(parents=True, exist_ok=True)
         self.results_root.mkdir(parents=True, exist_ok=True)
         self._s3_client = None
         if self.settings.storage_provider == "s3":
             self._s3_client = boto3.client(
                 "s3",
                 aws_access_key_id=self.settings.aws_access_key_id,
                 aws_secret_access_key=self.settings.aws_secret_access_key,
                 region_name=self.settings.aws_region,
             )

     def _generate_filename(self, original_name: str, suffix: str | None = None) -> str:
         extension = Path(original_name).suffix or ""
         if suffix:
             extension = suffix
         return f"{uuid.uuid4().hex}{extension}"

     async def save_upload(self, upload: UploadFile, suffix: str | None = None) -> str:
         filename = self._generate_filename(upload.filename or "file", suffix=suffix)
         if self.settings.storage_provider == "s3" and self._s3_client:
             body = await upload.read()
             self._s3_client.put_object(
                 Bucket=self.settings.aws_s3_bucket,
                 Key=filename,
                 Body=body,
                 ContentType=upload.content_type,
             )
             return filename

         target_path = self.storage_root / filename
         async with aiofiles.open(target_path, "wb") as out_file:
             while True:
                 chunk = await upload.read(1024 * 1024)
                 if not chunk:
                     break
                 await out_file.write(chunk)
         await upload.close()
         return str(target_path)

     async def save_bytes(self, data: bytes, extension: str = ".dxf") -> str:
         filename = f"{uuid.uuid4().hex}{extension}"
         if self.settings.storage_provider == "s3" and self._s3_client:
             self._s3_client.put_object(
                 Bucket=self.settings.aws_s3_bucket,
                 Key=filename,
                 Body=data,
             )
             return filename
         target_path = self.storage_root / filename
         async with aiofiles.open(target_path, "wb") as out_file:
             await out_file.write(data)
         return str(target_path)

     def get_local_path(self, stored_path: str) -> Path:
         path = Path(stored_path)
         if path.is_absolute():
             return path
         return self.storage_root / stored_path

     def remove_file(self, stored_path: str) -> None:
         path = Path(stored_path)
         if path.exists():
             path.unlink()

     async def save_result_file(self, data: bytes, filename: str) -> str:
         target_path = self.results_root / filename
         async with aiofiles.open(target_path, "wb") as out_file:
             await out_file.write(data)
         return str(target_path)
