FROM downloads.unstructured.io/unstructured-io/unstructured:0.16.5

# Configure Poetry
ENV POETRY_VERSION=1.8.3

RUN pip3.11 install poetry==${POETRY_VERSION}
ENV PATH="${PATH}:/home/notebook-user/.local/bin"

WORKDIR /app

# Install dependencies
COPY workers/python/poetry.lock workers/python/pyproject.toml ./
RUN poetry install

COPY workers/python/python/ ./python/

CMD ["poetry", "run", "python", "python/main.py"]