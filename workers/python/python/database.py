import tempfile

from pymongo import AsyncMongoClient

from config import config

cert = None
if config.mongodb_ca_cert is not None:
    cert = tempfile.NamedTemporaryFile(delete=False)
    cert.write(config.mongodb_ca_cert)
    cert.close()

client = AsyncMongoClient(
    config.mongodb_url, tlsCAFile=cert.name) if cert is not None else AsyncMongoClient(config.mongodb_url)
database = client.get_database(config.mongodb_database_name)
