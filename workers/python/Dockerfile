FROM python:3.11-slim

RUN apt-get update && apt-get install libmagic-dev libpoppler-cpp-dev libreoffice pandoc tesseract-ocr -y

RUN useradd -ms /bin/bash runner
USER runner

# Configure Poetry
ENV POETRY_VERSION=1.8.3

RUN pip3.11 install poetry==${POETRY_VERSION}
ENV PATH="${PATH}:/home/runner/.local/bin"

WORKDIR /app

# Install dependencies
COPY workers/python/poetry.lock workers/python/pyproject.toml ./
RUN poetry install

COPY workers/python/python/ ./python/

CMD ["poetry", "run", "python", "python/main.py"]