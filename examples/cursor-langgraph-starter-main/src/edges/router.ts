import { END } from "@langchain/langgraph";
import type { AIMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state/index.js";

/**
 * Should Continue Edge
 *
 * Determines whether to execute tools or end the conversation.
 * Routes to "tools" if the last message contains tool calls,
 * otherwise routes to END.
 */
export const shouldContinue = (state: AgentStateType): string => {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  return END;
};

