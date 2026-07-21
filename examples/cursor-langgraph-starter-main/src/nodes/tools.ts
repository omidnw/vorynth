import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools/index.js";

/**
 * Tool Node
 *
 * Executes tool calls from the agent's response.
 * Uses LangGraph's prebuilt ToolNode for automatic tool execution.
 */
export const toolNode = new ToolNode(tools);

