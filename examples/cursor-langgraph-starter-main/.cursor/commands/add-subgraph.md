# Add a Subgraph

Create a modular subgraph that can be composed into the main workflow.

## Instructions

1. Ask me what the subgraph should handle (purpose, inputs, outputs)
2. Create a new workflow file in `src/workflows/`:

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// Define subgraph-specific state (can extend parent state)
const SubgraphState = Annotation.Root({
  input: Annotation<string>,
  output: Annotation<string>,
});

// Define nodes
const processNode = async (state: typeof SubgraphState.State) => {
  return { output: `Processed: ${state.input}` };
};

// Build subgraph
const subgraphWorkflow = new StateGraph(SubgraphState)
  .addNode("process", processNode)
  .addEdge(START, "process")
  .addEdge("process", END);

export const subgraph = subgraphWorkflow.compile();
```

3. Import and add to parent workflow:

```typescript
import { subgraph } from "./subgraph.js";

workflow.addNode("subgraphName", subgraph);
```

## Use Cases

- **Research Agent**: Subgraph for web search and summarization
- **Code Review**: Subgraph for analyzing and suggesting code changes
- **Data Processing**: Subgraph for ETL operations
- **Validation**: Subgraph for input/output validation

