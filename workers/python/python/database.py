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

import tempfile

from pymongo import AsyncMongoClient

from config import config

cert = None
if config.mongodb_ca_cert is not None:
    cert = tempfile.NamedTemporaryFile(delete=False, mode='w')
    cert.write(config.mongodb_ca_cert)
    cert.close()

client = AsyncMongoClient(
    config.mongodb_url, tlsCAFile=cert.name) if cert is not None else AsyncMongoClient(config.mongodb_url)
database = client.get_database(config.mongodb_database_name)
