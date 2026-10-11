import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listLearningDirectory } from "../github.js";

export function registerListLearningArticles(server: McpServer) {
  server.tool(
    "list_learning_articles",
    "List Markdown learning articles under content/learning/ in qinze2017/ze-ai-architect.",
    {},
    async () => {
      const items = await listLearningDirectory();

      const articles = items
        .filter(
          (item) =>
            item.type === "file" &&
            item.name.endsWith(".md") &&
            item.name !== "_index.md"
        )
        .map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
        }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                repository: "qinze2017/ze-ai-architect",
                branch: "main",
                directory: "content/learning/",
                articles,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
