import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Example: Search Tool
 *
 * A mock search tool that simulates web search functionality.
 * Replace this with actual API calls (e.g., Tavily, SerpAPI, etc.)
 */
export const searchTool = tool(
  async ({ query }) => {
    const mockResults = [
      `Result 1 for "${query}": LangGraph is a library for building stateful, multi-actor applications.`,
      `Result 2 for "${query}": It extends LangChain with graph-based workflows.`,
      `Result 3 for "${query}": Key features include persistence, streaming, and human-in-the-loop.`,
    ];
    return mockResults.join("\n\n");
  },
  {
    name: "search",
    description:
      "Search the web for information. Use this when you need to find current information or facts.",
    schema: z.object({
      query: z.string().describe("The search query to look up"),
    }),
  }
);

/**
 * Example: Calculator Tool
 *
 * A simple calculator for basic math operations.
 */
export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      const result = new Function(`return ${sanitized}`)();
      return `${expression} = ${result}`;
    } catch {
      return `Error: Could not evaluate "${expression}"`;
    }
  },
  {
    name: "calculator",
    description:
      "Perform mathematical calculations. Use this for any math operations.",
    schema: z.object({
      expression: z
        .string()
        .describe("The mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"),
    }),
  }
);

/**
 * Export all tools as an array for easy binding to the model
 */
export const tools = [searchTool, calculatorTool];

