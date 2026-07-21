import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Agent State Annotation
 *
 * Extends MessagesAnnotation to include the message history with proper
 * reducer for appending messages. Add custom fields as needed.
 */
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

export type AgentStateType = typeof AgentState.State;

