import { ChatOpenAI } from "@langchain/openai";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentStateType } from "../state/index.js";
import { tools } from "../tools/index.js";

const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0,
}).bindTools(tools);

/**
 * Agent Node
 *
 * Calls the LLM with the current message history and available tools.
 * Returns the AI response to be appended to messages.
 */
export const callModel = async (
  state: AgentStateType,
  _config?: RunnableConfig
): Promise<Partial<AgentStateType>> => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
};

