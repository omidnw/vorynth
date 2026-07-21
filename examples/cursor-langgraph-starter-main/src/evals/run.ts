import "dotenv/config";
import { evaluate } from "langsmith/evaluation";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../workflows/agent.js";
import { evaluators } from "./evaluators.js";

const DATASET_NAME = process.env.EVAL_DATASET || "langgraph-agent-evals";
const EXPERIMENT_PREFIX = process.env.EVAL_PREFIX || "langgraph-agent";

interface DatasetInput {
  messages: Array<{ role: string; content: string }>;
}

/**
 * Target function that wraps the graph for evaluation
 * Converts the input format and invokes the graph
 */
async function targetFunction(input: DatasetInput) {
  const messages = input.messages.map((m) => {
    if (m.role === "user") {
      return new HumanMessage(m.content);
    }
    return new HumanMessage(m.content);
  });

  const result = await graph.invoke(
    { messages },
    { configurable: { thread_id: `eval-${Date.now()}-${Math.random()}` } }
  );

  return result;
}

async function runEvaluation() {
  console.log("🧪 Starting LangGraph Agent Evaluation\n");
  console.log(`📊 Dataset: ${DATASET_NAME}`);
  console.log(`🏷️  Experiment prefix: ${EXPERIMENT_PREFIX}`);
  console.log(`📏 Evaluators: ${evaluators.length}\n`);
  console.log("─".repeat(50));

  const results = await evaluate(targetFunction, {
    data: DATASET_NAME,
    evaluators,
    experimentPrefix: EXPERIMENT_PREFIX,
    maxConcurrency: 2,
  });

  console.log("\n" + "─".repeat(50));
  console.log("✅ Evaluation complete!\n");
  console.log("📈 View detailed results at: https://smith.langchain.com");

  return results;
}

runEvaluation().catch((error) => {
  console.error("❌ Evaluation failed:", error.message);
  process.exit(1);
});
