/**
 * Streaming Example
 *
 * Demonstrates the different streaming modes available in LangGraph:
 * - updates: Stream state updates after each node
 * - values: Stream full state after each node
 * - messages: Stream LLM tokens as they're generated
 *
 * Run with: pnpm example:streaming
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../workflows/agent.js";

const DIVIDER = "─".repeat(60);

async function streamUpdates() {
  console.log("\n📡 STREAM MODE: updates");
  console.log("Shows state changes after each node execution\n");

  const input = { messages: [new HumanMessage("What is 25 * 4?")] };

  for await (const chunk of await graph.stream(input, {
    streamMode: "updates",
    configurable: { thread_id: `stream-updates-${Date.now()}` },
  })) {
    const [nodeName, update] = Object.entries(chunk)[0];
    console.log(`[${nodeName}]`, JSON.stringify(update, null, 2).slice(0, 200));
  }
}

async function streamValues() {
  console.log("\n📊 STREAM MODE: values");
  console.log("Shows full state after each node execution\n");

  const input = { messages: [new HumanMessage("Hello!")] };

  for await (const chunk of await graph.stream(input, {
    streamMode: "values",
    configurable: { thread_id: `stream-values-${Date.now()}` },
  })) {
    console.log(`Messages count: ${chunk.messages?.length || 0}`);
    const lastMsg = chunk.messages?.at(-1);
    if (lastMsg) {
      console.log(`Last message: ${String(lastMsg.content).slice(0, 100)}...`);
    }
  }
}

async function streamMessages() {
  console.log("\n💬 STREAM MODE: messages");
  console.log("Shows LLM tokens as they're generated\n");

  const input = { messages: [new HumanMessage("Write a haiku about coding")] };

  process.stdout.write("Response: ");

  for await (const [messageChunk, metadata] of await graph.stream(input, {
    streamMode: "messages",
    configurable: { thread_id: `stream-messages-${Date.now()}` },
  })) {
    if (
      messageChunk.content &&
      typeof messageChunk.content === "string" &&
      metadata.langgraph_node === "agent"
    ) {
      process.stdout.write(messageChunk.content);
    }
  }

  console.log("\n");
}

async function streamMultipleModes() {
  console.log("\n🔀 STREAM MODE: multiple (updates + messages)");
  console.log("Combines multiple streaming modes\n");

  const input = { messages: [new HumanMessage("Say hi briefly")] };

  for await (const [mode, chunk] of await graph.stream(input, {
    streamMode: ["updates", "messages"],
    configurable: { thread_id: `stream-multi-${Date.now()}` },
  })) {
    if (mode === "updates") {
      const nodeName = Object.keys(chunk)[0];
      console.log(`[update] Node completed: ${nodeName}`);
    } else if (mode === "messages") {
      const [msgChunk] = chunk;
      if (msgChunk.content && typeof msgChunk.content === "string") {
        process.stdout.write(msgChunk.content);
      }
    }
  }

  console.log("\n");
}

async function main() {
  console.log("🌊 LangGraph Streaming Examples\n");
  console.log(DIVIDER);

  try {
    await streamUpdates();
    console.log(DIVIDER);

    await streamValues();
    console.log(DIVIDER);

    await streamMessages();
    console.log(DIVIDER);

    await streamMultipleModes();
    console.log(DIVIDER);

    console.log("\n✅ All streaming examples completed!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

