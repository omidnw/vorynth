# Add Human-in-the-Loop

Add human approval or intervention points to your workflow.

## Instructions

1. Tell me where you want human intervention (before which node)
2. I'll help you implement it:

### Setup Checkpointer
```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const graph = workflow.compile({
  checkpointer,
  interruptBefore: ["tools"], // Pause before tools node
});
```

### Run Until Interrupt
```typescript
const config = { configurable: { thread_id: "user-123" } };

// First run - will pause before "tools"
const state1 = await graph.invoke(
  { messages: [{ role: "user", content: "Search for X" }] },
  config
);

console.log("Paused. Pending tool calls:", state1.messages.at(-1)?.tool_calls);
```

### Resume After Approval
```typescript
// Human approves - continue execution
const state2 = await graph.invoke(null, config);
```

### Modify State Before Resuming
```typescript
// Human wants to modify the pending action
await graph.updateState(config, {
  messages: [{ role: "user", content: "Actually, search for Y instead" }],
});

const state2 = await graph.invoke(null, config);
```

## Use Cases

- **Tool approval**: Review tool calls before execution
- **Content review**: Approve generated content before sending
- **Escalation**: Human takeover for complex queries
- **Feedback loop**: Collect human feedback on responses

