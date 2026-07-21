# Debug Graph Execution

Help debug issues with the LangGraph workflow.

## Instructions

1. Tell me what's happening vs what you expected
2. I'll help you debug by:

### Check Graph Structure
```typescript
// Visualize the graph structure
console.log(graph.getGraph().drawMermaid());
```

### Add Logging to Nodes
```typescript
const myNode = async (state, config) => {
  console.log("Node input state:", JSON.stringify(state, null, 2));
  
  // ... node logic ...
  
  const result = { /* updates */ };
  console.log("Node output:", JSON.stringify(result, null, 2));
  return result;
};
```

### Stream with Debug Info
```typescript
for await (const event of graph.streamEvents(input, { version: "v2" })) {
  console.log(`Event: ${event.event}`, event.data);
}
```

### Enable LangSmith Tracing
Set these environment variables:
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-key
LANGCHAIN_PROJECT=debug-session
```

## Common Issues

- **Infinite loop**: Check conditional edge logic, ensure END is reachable
- **State not updating**: Verify node returns correct partial state
- **Tool not called**: Check tool binding and model capabilities
- **Wrong routing**: Debug edge function with console.log

