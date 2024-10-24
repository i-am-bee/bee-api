FROM downloads.unstructured.io/unstructured-io/unstructured:0.16.4

WORKDIR /app

COPY workers/python/requirements.txt .

RUN pip3.11 install -r requirements.txt

COPY workers/python/ .

CMD ["python3.11", "main.py"]