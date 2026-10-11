import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readLearningArticle } from "../github.js";

export function registerReadLearningArticle(server: McpServer) {
  server.tool(
    "read_learning_article",
    "Read one Markdown file under content/learning/ in qinze2017/ze-ai-architect.",
    {
      path: z
        .string()
        .describe(
          "Exact Markdown path under content/learning/, for example content/learning/llm-app-architecture.md"
        ),
    },
    async ({ path }) => {
      try {
        const article = await readLearningArticle(path);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(article, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        };
      }
    }
  );
}
