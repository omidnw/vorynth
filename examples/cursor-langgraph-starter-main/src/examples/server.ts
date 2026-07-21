/**
 * HTTP Server Example
 *
 * A simple HTTP server that exposes the LangGraph agent via REST API.
 * Supports both regular invocation and streaming responses.
 *
 * Run with: pnpm example:server
 *
 * Endpoints:
 * - POST /invoke     - Run the agent and return the final result
 * - POST /stream     - Run the agent and stream responses (SSE)
 * - GET  /health     - Health check endpoint
 */

import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../workflows/agent.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

async function handleInvoke(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    const { message, thread_id } = JSON.parse(body);

    if (!message) {
      return sendError(res, 400, "Missing 'message' in request body");
    }

    const threadId = thread_id || `http-${Date.now()}`;

    console.log(`[invoke] thread=${threadId} message="${message}"`);

    const result = await graph.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages.at(-1);

    sendJson(res, 200, {
      thread_id: threadId,
      response: lastMessage?.content || "",
      messages_count: result.messages.length,
    });
  } catch (error) {
    console.error("[invoke] Error:", error);
    sendError(res, 500, error instanceof Error ? error.message : "Unknown error");
  }
}

async function handleStream(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    const { message, thread_id } = JSON.parse(body);

    if (!message) {
      return sendError(res, 400, "Missing 'message' in request body");
    }

    const threadId = thread_id || `http-stream-${Date.now()}`;

    console.log(`[stream] thread=${threadId} message="${message}"`);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const input = { messages: [new HumanMessage(message)] };

    for await (const [messageChunk, metadata] of await graph.stream(input, {
      streamMode: "messages",
      configurable: { thread_id: threadId },
    })) {
      if (
        messageChunk.content &&
        typeof messageChunk.content === "string" &&
        metadata.langgraph_node === "agent"
      ) {
        const data = JSON.stringify({
          type: "token",
          content: messageChunk.content,
          node: metadata.langgraph_node,
        });
        res.write(`data: ${data}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("[stream] Error:", error);
    const errorData = JSON.stringify({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
}

function handleHealth(_req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url || "/";

  if (req.method === "GET" && url === "/health") {
    return handleHealth(req, res);
  }

  if (req.method === "POST" && url === "/invoke") {
    return handleInvoke(req, res);
  }

  if (req.method === "POST" && url === "/stream") {
    return handleStream(req, res);
  }

  sendError(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`
🚀 LangGraph HTTP Server

Server running at http://localhost:${PORT}

Endpoints:
  POST /invoke  - Run agent (JSON body: { "message": "...", "thread_id?": "..." })
  POST /stream  - Stream response (SSE, same body format)
  GET  /health  - Health check

Example:
  curl -X POST http://localhost:${PORT}/invoke \\
    -H "Content-Type: application/json" \\
    -d '{"message": "What is 2 + 2?"}'

Press Ctrl+C to stop
`);
});

