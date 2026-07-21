# Cursor LangGraph Starter

A **Cursor-optimized** starter template for building AI agents with [LangGraph.js](https://docs.langchain.com/oss/javascript/langgraph/overview). This project provides a structured foundation with pre-configured Cursor rules and commands to accelerate your development.

## Features

- **LangGraph.js v1.0+** - Latest TypeScript patterns with Annotations
- **ReAct Agent** - Tool-calling agent with search and calculator
- **Cursor Rules** - AI-assisted development with project-specific guidance
- **Cursor Commands** - Slash commands for common workflows
- **Memory & Checkpointing** - Built-in conversation persistence
- **TypeScript** - Full type safety with strict mode
- **Testing** - Vitest setup with example tests
- **Evaluations** - LangSmith integration for agent performance assessment
- **Streaming** - Multiple streaming modes (updates, values, messages)
- **HTTP Server** - Ready-to-use REST API with SSE streaming
- **LangGraph Studio** - Compatible with LangGraph Studio via `langgraph.json`
- **createAgent** - New high-level agent API from LangChain v1
- **Interrupts** - Human-in-the-loop with typed interrupts

## 📁 Project Structure

```
cursor-langgraph-starter/
├── .cursor/
│   ├── rules/                    # Cursor AI rules
│   │   ├── langgraph-expert.mdc  # LangGraph patterns & best practices
│   │   ├── typescript-standards.mdc
│   │   ├── project-structure.mdc
│   │   ├── testing.mdc
│   │   └── evals.mdc             # Evaluation guidelines
│   └── commands/                 # Cursor slash commands
│       ├── add-tool.md           # /add-tool
│       ├── add-node.md           # /add-node
│       ├── add-subgraph.md       # /add-subgraph
│       ├── add-eval.md           # /add-eval
│       ├── run-evals.md          # /run-evals
│       ├── debug-graph.md        # /debug-graph
│       └── human-in-the-loop.md  # /human-in-the-loop
├── src/
│   ├── state/                    # State annotations
│   │   └── index.ts
│   ├── nodes/                    # Graph nodes
│   │   ├── agent.ts              # LLM calling node
│   │   └── tools.ts              # Tool execution node
│   ├── edges/                    # Routing logic
│   │   └── router.ts
│   ├── tools/                    # Agent tools
│   │   └── index.ts
│   ├── workflows/                # Graph composition
│   │   └── agent.ts
│   ├── evals/                    # LangSmith evaluations
│   │   ├── evaluators.ts         # Custom evaluator functions
│   │   ├── create-dataset.ts     # Dataset creation script
│   │   └── run.ts                # Evaluation runner
│   ├── examples/                 # Usage examples
│   │   ├── streaming.ts          # Streaming modes demo
│   │   ├── server.ts             # HTTP server with SSE
│   │   ├── create-agent.ts       # LangChain v1 createAgent
│   │   └── interrupts.ts         # Human-in-the-loop
│   └── index.ts                  # Entry point
├── tests/
│   └── workflow.test.ts
├── langgraph.json                # LangGraph Studio config
├── eslint.config.js              # ESLint flat config
├── .prettierrc                   # Prettier config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/naoufalelh/cursor-langgraph-starter.git
cd cursor-langgraph-starter

# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Run the Demo

```bash
# Development mode with hot reload
pnpm dev

# Or build and run
pnpm build
pnpm start
```

### Run Tests

```bash
pnpm test
```

## 🎯 Cursor Integration

This project is designed to work seamlessly with [Cursor](https://cursor.com).

### Rules

Cursor rules provide context-aware AI assistance. When you open this project in Cursor, the AI automatically understands:

- LangGraph patterns and best practices
- Project structure and conventions
- TypeScript coding standards

Rules are in `.cursor/rules/` and are applied based on file patterns.

### Commands

Use slash commands in Cursor Chat for common tasks:

| Command | Description |
|---------|-------------|
| `/add-tool` | Create a new tool for the agent |
| `/add-node` | Add a new node to the workflow |
| `/add-subgraph` | Create a modular subgraph |
| `/add-eval` | Create a new evaluator |
| `/run-evals` | Run evaluation suite |
| `/debug-graph` | Debug workflow execution |
| `/human-in-the-loop` | Add approval checkpoints |

## 📖 LangGraph Concepts

### State

State is defined using Annotations. The `AgentState` extends `MessagesAnnotation` for chat history:

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Add custom fields here
});
```

### Nodes

Nodes are async functions that receive state and return partial updates:

```typescript
const myNode = async (state) => {
  return { messages: [response] }; // Partial update
};
```

### Edges

Conditional edges route based on state:

```typescript
const shouldContinue = (state) => {
  if (state.messages.at(-1)?.tool_calls?.length) {
    return "tools";
  }
  return END;
};
```

### Workflow

Compose nodes and edges into a graph:

```typescript
const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

export const graph = workflow.compile();
```

## 🔧 Extending the Project

### Add a New Tool

1. Create tool in `src/tools/`
2. Export from `src/tools/index.ts`
3. Tool is automatically available to the agent

### Add a New Node

1. Create node function in `src/nodes/`
2. Add to workflow: `workflow.addNode("name", myNode)`
3. Connect with edges

### Add Memory

The project includes `MemorySaver` for conversation memory:

```typescript
const result = await graph.invoke(
  { messages: [new HumanMessage("Hello")] },
  { configurable: { thread_id: "user-123" } }
);
```

## 🧪 Evaluations

This project includes a LangSmith-based evaluation framework for assessing agent performance.

### Setup

1. Get a [LangSmith](https://smith.langchain.com) API key
2. Add to your `.env`:
   ```
   LANGCHAIN_API_KEY=your-langsmith-api-key
   LANGCHAIN_TRACING_V2=true
   ```

### Running Evaluations

```bash
# Create the evaluation dataset (first time only)
pnpm eval:create-dataset

# Run evaluations
pnpm eval
```

### Built-in Evaluators

| Evaluator | What it Measures |
|-----------|------------------|
| `helpfulness` | Response has meaningful content |
| `tool_usage` | Tools used when appropriate |
| `response_length` | Within acceptable bounds |
| `correct_tool` | Matches expected tool from dataset |

### Adding Custom Evaluators

Create evaluators in `src/evals/evaluators.ts`:

```typescript
export const myEvaluator = async ({ input, prediction, reference }) => {
  const score = /* 0 to 1 */;
  return { key: "my_metric", score, comment: "Explanation" };
};
```

View results at [smith.langchain.com](https://smith.langchain.com).

## 🌊 Streaming

LangGraph supports multiple [streaming modes](https://docs.langchain.com/oss/javascript/langgraph/streaming) for real-time output.

### Run the Streaming Example

```bash
pnpm example:streaming
```

### Streaming Modes

| Mode | Description |
|------|-------------|
| `updates` | State changes after each node |
| `values` | Full state after each node |
| `messages` | LLM tokens as they're generated |
| `custom` | Custom data from nodes/tools |

### Basic Usage

```typescript
// Stream LLM tokens
for await (const [chunk, metadata] of await graph.stream(input, {
  streamMode: "messages",
})) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

## 🌐 HTTP Server

A ready-to-use HTTP server with REST API and Server-Sent Events (SSE) streaming.

### Run the Server

```bash
pnpm example:server
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/invoke` | Run agent, return final result |
| POST | `/stream` | Run agent with SSE streaming |
| GET | `/health` | Health check |

### Example Request

```bash
# Regular invocation
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2 + 2?"}'

# Streaming (SSE)
curl -X POST http://localhost:3000/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a poem about AI"}'
```

## 🎨 LangGraph Studio

This project is compatible with [LangGraph Studio](https://github.com/langchain-ai/langgraph-studio) for visual debugging.

The `langgraph.json` file configures the graph for Studio:

```json
{
  "graphs": {
    "agent": "./src/workflows/agent.ts:graph"
  }
}
```

## 🤖 createAgent (LangChain v1)

The new high-level `createAgent` API from [LangChain v1](https://docs.langchain.com/oss/javascript/migrate/langgraph-v1) simplifies agent creation.

```bash
pnpm example:create-agent
```

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [searchTool, calculatorTool],
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Hello!" }],
});
```

This replaces the deprecated `createReactAgent` from `@langchain/langgraph/prebuilt`.

## ⏸️ Interrupts (Human-in-the-Loop)

LangGraph v1 supports typed interrupts for human-in-the-loop workflows.

```bash
pnpm example:interrupts
```

```typescript
import { interrupt, Command } from "@langchain/langgraph";

const requestApproval = async (state) => {
  // Pause execution and wait for human input
  const response = interrupt({
    task: state.task,
    reason: "Requires approval",
  });
  return { approved: response.approved };
};

// Resume with a Command
await graph.stream(
  new Command({ resume: { approved: true } }),
  config
);
```

## 📚 Resources

- [LangGraph.js Documentation](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangSmith Documentation](https://docs.smith.langchain.com)
- [Cursor Rules Documentation](https://docs.cursor.com/context/rules)
- [Cursor Commands Documentation](https://docs.cursor.com/agent/chat/commands)
- [LangChain.js](https://js.langchain.com/)

## 📄 License

MIT

