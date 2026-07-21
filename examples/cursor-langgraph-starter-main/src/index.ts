import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./workflows/agent.js";

async function main() {
  console.log("🚀 LangGraph Agent Started\n");
  console.log("This is a ReAct agent with search and calculator tools.");
  console.log("It will use tools when needed and respond directly otherwise.\n");
  console.log("─".repeat(50));

  const threadId = `thread-${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  const queries = [
    "What is LangGraph and what are its main features?",
    "Calculate 25 * 4 + 100",
    "Thanks! That's all I needed.",
  ];

  for (const query of queries) {
    console.log(`\n👤 User: ${query}\n`);

    const result = await graph.invoke(
      { messages: [new HumanMessage(query)] },
      config
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log(`🤖 Agent: ${lastMessage.content}\n`);
    console.log("─".repeat(50));
  }
}

main().catch(console.error);

