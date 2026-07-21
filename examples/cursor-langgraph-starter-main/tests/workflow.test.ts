import { describe, it, expect, beforeAll } from "vitest";
import { HumanMessage } from "@langchain/core/messages";

describe("Agent Workflow", () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
  });

  it("should have correct graph structure", async () => {
    const { workflow } = await import("../src/workflows/agent.js");
    const nodeNames = Object.keys(workflow.nodes);

    expect(nodeNames).toContain("agent");
    expect(nodeNames).toContain("tools");
  });

  it("should create valid input state", () => {
    const input = {
      messages: [new HumanMessage("Hello")],
    };

    expect(input.messages).toHaveLength(1);
    expect(input.messages[0].content).toBe("Hello");
  });
});

describe("Edge Router", () => {
  it("should route to END when no tool calls", async () => {
    const { shouldContinue } = await import("../src/edges/router.js");

    const state = {
      messages: [
        {
          content: "Hello! How can I help?",
          tool_calls: undefined,
        },
      ],
    };

    const result = shouldContinue(state as any);
    expect(result).toBe("__end__");
  });

  it("should route to tools when tool calls exist", async () => {
    const { shouldContinue } = await import("../src/edges/router.js");

    const state = {
      messages: [
        {
          content: "",
          tool_calls: [{ name: "search", args: { query: "test" } }],
        },
      ],
    };

    const result = shouldContinue(state as any);
    expect(result).toBe("tools");
  });
});

