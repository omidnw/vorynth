# Add a New Tool

Create a new LangChain tool that the agent can use.

## Instructions

1. First, ask me what the tool should do (name, description, parameters)
2. Create the tool in `src/tools/` following this pattern:

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const myTool = tool(
  async (input) => {
    // Tool implementation
    return "result";
  },
  {
    name: "tool_name",
    description: "What this tool does",
    schema: z.object({
      param: z.string().describe("Parameter description"),
    }),
  }
);
```

3. Export from `src/tools/index.ts`
4. Add to the tools array in `src/nodes/agent.ts`
5. The tool will automatically be available to the agent

## Example

Create a weather tool:
- Name: `get_weather`
- Description: Get current weather for a location
- Parameters: `location` (string)

