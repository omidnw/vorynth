/**
 * createAgent Example (LangChain v1)
 *
 * Demonstrates the new high-level `createAgent` API from LangChain v1.
 * This replaces the deprecated `createReactAgent` from LangGraph prebuilt.
 *
 * Benefits:
 * - Simpler API for common agent patterns
 * - Built-in middleware support
 * - Runs on LangGraph under the hood
 *
 * Run with: pnpm example:create-agent
 *
 * @see https://docs.langchain.com/oss/javascript/migrate/langgraph-v1
 */

import "dotenv/config";
import { createAgent } from "langchain";
import { tools } from "../tools/index.js";

const agent = createAgent({
  model: `openai:${process.env.OPENAI_MODEL || "gpt-4o-mini"}`,
  tools,
  systemPrompt: `You are a helpful assistant with access to search and calculator tools.
Use the search tool when you need to find information.
Use the calculator tool for any mathematical calculations.
Always be concise and helpful.`,
});

async function main() {
  console.log("🤖 LangChain createAgent Example\n");
  console.log("This uses the new high-level createAgent API from LangChain v1.");
  console.log("It replaces the deprecated createReactAgent from LangGraph.\n");
  console.log("─".repeat(50));

  const queries = [
    "What is LangGraph?",
    "Calculate 123 * 456",
    "Hello! How are you?",
  ];

  for (const query of queries) {
    console.log(`\n👤 User: ${query}\n`);

    const result = await agent.invoke({
      messages: [{ role: "user", content: query }],
    });

    const lastMessage = result.messages.at(-1);
    console.log(`🤖 Agent: ${lastMessage?.content}\n`);
    console.log("─".repeat(50));
  }
}

main().catch(console.error);
