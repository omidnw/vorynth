import { StateGraph, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { AgentState } from "../state/index.js";
import { callModel } from "../nodes/agent.js";
import { toolNode } from "../nodes/tools.js";
import { shouldContinue } from "../edges/router.js";

/**
 * Agent Workflow
 *
 * A ReAct-style agent that can use tools to answer questions.
 *
 * Flow:
 * 1. START -> agent: Call the LLM
 * 2. agent -> tools (if tool calls) OR END (if no tool calls)
 * 3. tools -> agent: Loop back with tool results
 */
const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent");

/**
 * Memory Saver for state persistence
 * Enables conversation memory and human-in-the-loop features
 */
const checkpointer = new MemorySaver();

/**
 * Compiled Graph
 *
 * Ready to use with .invoke() or .stream()
 * Pass { configurable: { thread_id: "unique-id" } } for conversation memory
 */
export const graph = workflow.compile({ checkpointer });

export { workflow };

