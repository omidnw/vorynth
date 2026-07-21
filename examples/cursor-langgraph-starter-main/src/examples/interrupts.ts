/**
 * Interrupts Example (LangGraph v1)
 *
 * Demonstrates human-in-the-loop workflows using the `interrupt` function.
 * Interrupts pause graph execution and allow resuming with user input.
 *
 * Run with: pnpm example:interrupts
 *
 * @see https://docs.langchain.com/oss/javascript/langgraph/interrupts
 */

import "dotenv/config";
import {
  StateGraph,
  START,
  END,
  interrupt,
  MemorySaver,
  Annotation,
  Command,
} from "@langchain/langgraph";

const ApprovalState = Annotation.Root({
  task: Annotation<string>,
  approved: Annotation<boolean | undefined>,
  feedback: Annotation<string | undefined>,
  result: Annotation<string | undefined>,
});

const requestApproval = async (state: typeof ApprovalState.State) => {
  console.log(`\n⏸️  Requesting approval for task: "${state.task}"`);
  console.log("   Graph will pause here until resumed with a Command.\n");

  const response = interrupt({
    task: state.task,
    reason: "This task requires human approval before execution",
  });

  return {
    approved: response.approved as boolean,
    feedback: response.feedback as string | undefined,
  };
};

const executeTask = async (state: typeof ApprovalState.State) => {
  if (!state.approved) {
    return {
      result: `❌ Task rejected${state.feedback ? `: ${state.feedback}` : ""}`,
    };
  }

  console.log(`\n✅ Executing approved task: "${state.task}"`);
  return {
    result: `✅ Successfully completed: ${state.task}${state.feedback ? ` (feedback: ${state.feedback})` : ""}`,
  };
};

const shouldExecute = (state: typeof ApprovalState.State): string => {
  return state.approved !== undefined ? "execute" : END;
};

const workflow = new StateGraph(ApprovalState)
  .addNode("request_approval", requestApproval)
  .addNode("execute", executeTask)
  .addEdge(START, "request_approval")
  .addConditionalEdges("request_approval", shouldExecute, {
    execute: "execute",
    [END]: END,
  })
  .addEdge("execute", END);

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

async function main() {
  console.log("🔄 Interrupts Example (Human-in-the-Loop)\n");
  console.log("This demonstrates pausing a graph for human approval.");
  console.log("The graph uses `interrupt()` to pause and wait for input.\n");
  console.log("─".repeat(50));

  const threadId = `interrupt-demo-${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  console.log("\n📋 Step 1: Starting workflow with task: 'Deploy to production'");

  const stream1 = await graph.stream({ task: "Deploy to production" }, config);

  for await (const chunk of stream1) {
    console.log("   Chunk:", Object.keys(chunk));
  }

  const state1 = await graph.getState(config);
  console.log("\n🔍 Current state after interrupt:");
  console.log("   Task:", state1.values.task);
  console.log("   Approved:", state1.values.approved);
  console.log("   Next nodes:", state1.next);

  if (state1.tasks && state1.tasks.length > 0) {
    const interruptValue = state1.tasks[0].interrupts?.[0]?.value;
    console.log("   Interrupt value:", JSON.stringify(interruptValue));
  }

  console.log("\n📋 Step 2: Human approves the task...");

  const stream2 = await graph.stream(
    new Command({
      resume: { approved: true, feedback: "Looks good, proceed!" },
    }),
    config
  );

  for await (const chunk of stream2) {
    console.log("   Chunk:", Object.keys(chunk));
  }

  const state2 = await graph.getState(config);
  console.log("\n📊 Final state:");
  console.log("   Task:", state2.values.task);
  console.log("   Approved:", state2.values.approved);
  console.log("   Feedback:", state2.values.feedback);
  console.log("   Result:", state2.values.result);

  console.log("\n" + "─".repeat(50));
  console.log("✅ Workflow completed!");

  console.log("\n" + "─".repeat(50));
  console.log("\n🔄 Running rejection scenario...\n");

  const threadId2 = `interrupt-demo-reject-${Date.now()}`;
  const config2 = { configurable: { thread_id: threadId2 } };

  const stream3 = await graph.stream({ task: "Delete all data" }, config2);
  for await (const _chunk of stream3) {}

  console.log("📋 Human rejects the task...");

  const stream4 = await graph.stream(
    new Command({
      resume: { approved: false, feedback: "Too dangerous!" },
    }),
    config2
  );

  for await (const _chunk of stream4) {}

  const state3 = await graph.getState(config2);
  console.log("\n📊 Final state (rejected):");
  console.log("   Result:", state3.values.result);
}

main().catch(console.error);
