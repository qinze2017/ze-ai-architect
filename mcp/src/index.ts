import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerListLearningArticles } from "./tools/list-learning-articles.js";
import { registerReadLearningArticle } from "./tools/read-learning-article.js";
import { registerPublishDailyLearning } from "./tools/publish-daily-learning.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

// Create the MCP server once.
const server = new McpServer({
  name: "java-ai-learning-mcp",
  version: "1.0.0",
});

// Register tools once.
registerListLearningArticles(server);
registerReadLearningArticle(server);
registerPublishDailyLearning(server);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "java-ai-learning-mcp",
  });
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Java AI Learning MCP listening on port ${PORT}`);
});
