import type { Run, Example } from "langsmith/schemas";
import type { EvaluationResult } from "langsmith/evaluation";

interface Message {
  role?: string;
  content?: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

type EvaluatorFn = (run: Run, example?: Example) => Promise<EvaluationResult>;

/**
 * Evaluator: Helpfulness
 *
 * Checks if the response has meaningful content and isn't an error.
 */
export const helpfulnessEvaluator: EvaluatorFn = async (run, _example) => {
  const outputs = run.outputs || {};
  const messages = (outputs.messages as Message[]) || [];
  const lastMessage = messages.at(-1);
  const response = String(lastMessage?.content || "");

  const hasContent = response.length > 10;
  const isNotError = !response.toLowerCase().includes("error");
  const isNotApology = !response.toLowerCase().startsWith("i'm sorry");

  const score = hasContent && isNotError && isNotApology ? 1 : 0;

  return {
    key: "helpfulness",
    score,
    comment: hasContent
      ? "Response has meaningful content"
      : "Response too short or contains error",
  };
};

/**
 * Evaluator: Tool Usage
 *
 * Checks if tools were used appropriately based on the query.
 */
export const toolUsageEvaluator: EvaluatorFn = async (run, _example) => {
  const outputs = run.outputs || {};
  const inputs = run.inputs || {};
  const messages = (outputs.messages as Message[]) || [];
  const inputMessages = (inputs.messages as Message[]) || [];
  const query = String(inputMessages[0]?.content || "").toLowerCase();

  const toolCalls = messages.filter((m) => m.tool_calls && m.tool_calls.length > 0);
  const didUseTool = toolCalls.length > 0;

  const searchKeywords = ["search", "find", "look up", "what is", "who is", "latest"];
  const calcKeywords = ["calculate", "compute", "math", "+", "-", "*", "/", "sum", "multiply"];

  const shouldUseSearch = searchKeywords.some((kw) => query.includes(kw));
  const shouldUseCalc = calcKeywords.some((kw) => query.includes(kw));
  const shouldUseTool = shouldUseSearch || shouldUseCalc;

  const score = shouldUseTool === didUseTool ? 1 : 0;

  return {
    key: "tool_usage",
    score,
    comment: `Expected tool usage: ${shouldUseTool}, Actual: ${didUseTool}`,
  };
};

/**
 * Evaluator: Response Length
 *
 * Checks if response length is within acceptable bounds.
 */
export const responseLengthEvaluator: EvaluatorFn = async (run, _example) => {
  const outputs = run.outputs || {};
  const messages = (outputs.messages as Message[]) || [];
  const lastMessage = messages.at(-1);
  const response = String(lastMessage?.content || "");

  const minLength = 10;
  const maxLength = 2000;
  const length = response.length;

  const isWithinBounds = length >= minLength && length <= maxLength;
  const score = isWithinBounds ? 1 : 0;

  return {
    key: "response_length",
    score,
    comment: `Response length: ${length} chars (bounds: ${minLength}-${maxLength})`,
  };
};

/**
 * Evaluator: Correct Tool Selection
 *
 * Checks if the correct tool was selected based on expected output.
 */
export const correctToolEvaluator: EvaluatorFn = async (run, example) => {
  const reference = example?.outputs || {};

  if (!reference?.expected_tool) {
    return {
      key: "correct_tool",
      score: 1,
      comment: "No expected tool specified, skipping",
    };
  }

  const outputs = run.outputs || {};
  const messages = (outputs.messages as Message[]) || [];
  const toolCalls = messages.flatMap((m) => m.tool_calls || []);
  const usedTools = toolCalls.map((tc) => tc.name);

  const expectedTool = String(reference.expected_tool);
  const usedCorrectTool =
    expectedTool === "null" ? usedTools.length === 0 : usedTools.includes(expectedTool);

  return {
    key: "correct_tool",
    score: usedCorrectTool ? 1 : 0,
    comment: `Expected: ${expectedTool}, Used: ${usedTools.join(", ") || "none"}`,
  };
};

/**
 * All evaluators exported as an array
 */
export const evaluators = [
  helpfulnessEvaluator,
  toolUsageEvaluator,
  responseLengthEvaluator,
  correctToolEvaluator,
];
