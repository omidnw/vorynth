# Add a New Node

Create a new node in the LangGraph workflow.

## Instructions

1. Ask me what the node should do (name, purpose, state changes)
2. Create the node function in `src/nodes/`:

```typescript
import type { RunnableConfig } from "@langchain/core/runnables";
import { AgentState } from "@/state/index.js";

export const myNode = async (
  state: typeof AgentState.State,
  config?: RunnableConfig
): Promise<Partial<typeof AgentState.State>> => {
  // Node logic here
  return {
    // Only return fields being updated
  };
};
```

3. Add the node to the workflow in `src/workflows/agent.ts`:
   - `workflow.addNode("nodeName", myNode)`
   - Connect with edges

## Node Guidelines

- Nodes receive current state and return partial state updates
- Keep nodes focused on a single responsibility
- Use verb-noun naming: `processInput`, `generateResponse`, `validateOutput`
- Access config for thread_id, callbacks, etc.

