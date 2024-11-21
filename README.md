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

### Dependencies

#### MongoDB

```
docker run -d -p 27017:27017 mongo:latest
```

#### Redis

```
 docker run -d -p 6379:6379 redis:latest
```

## Implement a Custom Native Typescript Tool (all the way to the UI)

 In this example we will implement the tool `RiddleTool`, all the way to the [Bee UI](https://github.com/i-am-bee/bee-ui).

### Bee API 

### Create a new custom tool

1. Create a new file in *src/runs/execution/tools* directory. In this example we will create *riddle-tool.ts*.
2. Copy and paste the [riddle example base tool](https://github.com/i-am-bee/bee-agent-framework/blob/main/examples/tools/custom/base.ts). In *riddle-tool.ts*.

### Implement the tool in helpers and services

#### Add the tool in *src/runs/execution/helpers.ts* file.

1. Import the tool in the file:

```typescript
import { RiddleTool } from "./riddle-tool.js";
```

2. Append the tool to the array `tools` in the `getTools` function:

```typescript
export async function getTools(run: LoadedRun, context: AgentContext): Promise<FrameworkTool[]> {
  const tools: FrameworkTool[] = [];

  tools.push(new RiddleTool()); // Add the tool to the array

  const vectorStores = getRunVectorStores(run.assistant.$, run.thread.$);
  for (const vectorStore of vectorStores) {
    vectorStore.lastActiveAt = new Date();
  }
  
  ...
```
3. Add the tool in `createToolCall` function:

```typescript
  ...
  // Add the tool in the `else if` branch
  } else if (tool instanceof RiddleTool) {
    return new SystemCall({
      toolId: SystemTools.RIDDLE_TOOL,
      input: await tool.parse(input)
    });
  }
  throw new Error(`Unknown tool: ${tool.name}`);
}
```
4. Add the tool in `finalizeToolCall` function:

```typescript
      ...
      // Add the tool in the `switch` statement
      case SystemTools.RIDDLE_TOOL: {
        if (!(result instanceof StringToolOutput)) throw new TypeError();
        toolCall.output = result.result;
        break;
      }
    }
````

#### Add the tool definition in *src/tools/entities/tool-calls/system-call.entity.ts* file:

```typescript
export enum SystemTools {
  WEB_SEARCH = 'web_search',
  WIKIPEDIA = 'wikipedia',
  WEATHER = 'weather',
  ARXIV = 'arxiv',
  READ_FILE = 'read_file',
  RIDDLE_TOOL = 'riddle_tool', // Add the tool definition
}
```

#### Set the tool in the handlers in *src/tools/tools.service.ts* file:

1. Import the tool in the file:

```typescript
import { RiddleTool } from '@/runs/execution/tools/riddle-tool.js';
```

2. Instance the tool in the `getSystemTools` function:

```typescript
function getSystemTools() {
  ...

  const systemTools = new Map<string, SystemTool>();

  const riddleTool = new RiddleTool(); // Add this line

  ...
```
3. Set the tool at the end of `getSystemTools` function:

```typescript
  ...
  // add this block of code
    systemTools.set('riddle_tool', {
    type: ToolType.SYSTEM,
    id: 'riddle_tool',
    createdAt: new Date(),
    ...riddleTool,
    inputSchema: riddleTool.inputSchema.bind(riddleTool),
    isExternal: false,
    metadata: {
      $ui_description_short:
        'It generates a random puzzle to test your knowledge.'
    },
    userDescription:
      'It generates a random puzzle to test your knowledge.'
  });

  return systemTools;
}
```
4. Add the tool in `listTools` function:

```typescript
  ...

  const systemTools: (SystemTool | undefined)[] =
    !type || type.includes(ToolType.SYSTEM)
      ? [
          allSystemTools.get(SystemTools.WEB_SEARCH),
          allSystemTools.get(SystemTools.WIKIPEDIA),
          allSystemTools.get(SystemTools.WEATHER),
          allSystemTools.get(SystemTools.ARXIV),
          allSystemTools.get('read_file'),
          allSystemTools.get('riddle_tool') // add this line
        ]
      : [];
  ...
```
That's it! You have implemented the tool in the Bee API. :rocket:

### Bee UI

For the tool to be available in the UI, you need to follow these steps:

1. Add the tool the the schema in *src/app/api/schema.d.ts* file:

```typescript
"web_search" | "wikipedia" | "weather" | "arxiv" | "read_file" | "riddle_tool";
```

There are several lines like this in the file. I recommend replacing all of them.

2. Add the tool to `SYSTEM_TOOL_NAME` and `SYSTEM_TOOL_ICONS`in *src/modules/tools/hooks/useToolInfo.tsx* file:

```typescript
const SYSTEM_TOOL_NAME: Record<SystemToolId, string> = {
  wikipedia: 'Wikipedia',
  web_search: 'WebSearch',
  weather: 'OpenMeteo',
  arxiv: 'Arxiv',
  read_file: 'ReadFile',
  riddle_tool: 'RiddleTool', // Add this line
};

const SYSTEM_TOOL_ICONS: Record<SystemToolId, ComponentType> = {
  wikipedia: Wikipedia,
  web_search: IbmWatsonDiscovery,
  weather: PartlyCloudy,
  arxiv: Arxiv,
  read_file: DocumentView,
  riddle_tool: Code, // Add this line
};
```

That's it! You have implemented the tool in the Bee UI. :rocket: