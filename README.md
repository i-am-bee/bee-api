<p align="center">
    <img src="./docs/assets/Bee_Dark.svg" height="128">
    <h1 align="center">Bee API</h1>
</p>

<p align="center">
  <h4 align="center">OpenAI-compatible Assistants API backed by <a href="https://github.com/i-am-bee/bee-agent-framework">Bee Agent Framework</a></h4>
</p>

## Getting started

> [!TIP]
>
> 🚀 The fastest way to setup Bee (UI + API) is through [Bee Stack](https://github.com/i-am-bee/bee-stack).

1. Create `.env` (from `.env.example`) and fill in values.
2. Run `pnpm install` to install dependencies.
3. Start the server with `pnpm start:dev`

## Technologies

- [Fastify](https://fastify.dev/) as the web framework
- [MikroORM](https://mikro-orm.io/) backed by [MongoDB](https://www.mongodb.com/) as the database layer
- [BullMQ](https://docs.bullmq.io/guide/jobs) backed by [Redis](https://redis.io/) as the job executor
- [Bee Agent Framework](https://github.com/i-am-bee/bee-agent-framework) as the agent execution engine

## Architecture overview

The Assistants API consists mostly of CRUDL endpoints for managing API resources like assistants, threads, runs and more. Furthermore, some resources are asynchronous in a sense that they contain `status` changing over time as the background execution progresses. Clients use polling or streaming to watch for status updates of such resources.

### Infrastructure

The infrastructure consists of:

- REST API server
- MongoDB
- Redis

The REST API server stores resources in MongoDB database. Redis is used by BullMQ, rate limiter and as pub/sub broker for event streaming. Agent execution is performed by the Bee Agent Framework using various adapters for inference and embeddings.

### Server

The codebase contains several types of modules:

- `*.modules.ts` containing endpoint handlers
- `*.services.ts` containing services for the handlers
- `dtos/*.ts` containing JSON schema definitions for resources
- `*.entity.ts` containing ORM definitions for database entities
- `*.queue.ts` containing BullMQ queues and workers for asynchronous execution

These modules are connected in the following manner

```
module ---> dto
       ---> service ---> entity
                    ---> queue ---> entity
```

OpenAPI schema is auto-generated from the `dtos` and exposed on the `/docs` endpoint.

## Starting the bee-api infrastructure

The easiest way to run all the dependencies for the bee-api is to:

- Clone the bee-stack repository https://github.com/i-am-bee/bee-stack
- Navigate to the bee-stack directory.
- Run the infrastructure:

```
./bee-stack.sh clean
./bee-stack.sh start:infra
```

- Then navigate back to the bee-api repository.
- Install packages:

```
pnpm install
```

- When running for the first time seed the database:

```
pnpm mikro-orm seeder:run
```

- copy .env.example to .env

```
cp .env.example .env
```

- Add values the env vars: CRYPTO_CIPHER_KEY, LLM_BACKEND, EMBEDDING_BACKEND and API key for which ever provider you have chosen.

- Run the bee-api:

```
pnpm start:dev
```
