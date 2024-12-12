# Copyright 2024 IBM Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Optional

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

from enums import ExtractionBackend


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='../../.env', env_file_encoding='utf-8', env_ignore_empty=True, extra='ignore')

    port: int = 8080

    log_level: str = 'info'

    run_bullmq_workers_raw: str = Field(alias='run_bullmq_workers')

    @computed_field
    @property
    def run_bullmq_workers(self) -> list[str]:
        return self.run_bullmq_workers_raw.split(',')

    redis_url: str
    redis_ca_cert: Optional[str] = None

    mongodb_url: str
    mongodb_database_name: str
    mongodb_ca_cert: Optional[str] = None

    unstructured_api_url: Optional[str] = None
    unstructured_api_key: Optional[str] = None

    s3_endpoint: str
    s3_bucket_file_storage: str
    s3_access_key_id: str
    s3_secret_access_key: str

    otel_sdk_disabled: bool = False


config = Config()
