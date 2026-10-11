import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateDailyLearningInput } from "../validation.js";
import {
  checkLearningFilesExist,
  getMainHeadSha,
  publishLearningFilesAtomic,
  findDailyLearningPrimaryArticle,
} from "../github.js";

export function registerPublishDailyLearning(server: McpServer) {
  server.tool(
    "publish_daily_learning",
    "Validate and publish the missing Chinese, French Canadian, and English Canadian daily learning Markdown files to content/learning/ in qinze2017/ze-ai-architect. Existing files are never overwritten.",
    {
      date: z.string(),
      slug: z.string(),
      zh_content: z.string(),
      fr_content: z.string(),
      en_content: z.string(),
    },
    async (input) => {
      try {
        //
        // 1. Validate deterministic inputs and Markdown front matter.
        //
        const validated = validateDailyLearningInput(input);
	
	const existingPrimary =
            await findDailyLearningPrimaryArticle(validated.date);

        if (
          existingPrimary &&
          existingPrimary.path !== validated.paths.zh
        ) {
          throw new Error(
            `A different daily learning article already exists for ${validated.date}: ${existingPrimary.path}`
          );
        }

        //
        // 2. Capture main HEAD before duplicate checking.
        //
        const checkedHeadSha = await getMainHeadSha();

        const targetPaths = [
          validated.paths.zh,
          validated.paths.fr,
          validated.paths.en,
        ];

        //
        // 3. Check which translations already exist.
        //
        const existence = await checkLearningFilesExist(targetPaths);

        const existingPaths = existence
          .filter((item) => item.exists)
          .map((item) => item.path);

        const missingPaths = existence
          .filter((item) => !item.exists)
          .map((item) => item.path);

        //
        // 4. If all translations already exist, do nothing.
        //
        if (missingPaths.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "no_changes",
                    repository: "qinze2017/ze-ai-architect",
                    branch: "main",
                    directory: "content/learning/",
                    commit_sha: null,
                    created_paths: [],
                    skipped_paths: existingPaths,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        //
        // 5. Build only the files that are actually missing.
        //
        const candidates = [
          {
            path: validated.paths.zh,
            content: validated.zh_content,
          },
          {
            path: validated.paths.fr,
            content: validated.fr_content,
          },
          {
            path: validated.paths.en,
            content: validated.en_content,
          },
        ];

        const filesToPublish = candidates.filter((file) =>
          missingPaths.includes(file.path)
        );

        //
        // 6. Publish all missing translations in exactly one Git commit.
        //
        const publication = await publishLearningFilesAtomic(
          filesToPublish,
          validated.date,
          checkedHeadSha
        );

        //
        // 7. A successful response includes the real GitHub commit SHA.
        //
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "published",
                  repository: "qinze2017/ze-ai-architect",
                  branch: "main",
                  directory: "content/learning/",
                  commit_sha: publication.commit_sha,
                  created_paths: publication.created_paths,
                  skipped_paths: existingPaths,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown publication error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "failed",
                  repository: "qinze2017/ze-ai-architect",
                  branch: "main",
                  directory: "content/learning/",
                  commit_sha: null,
                  created_paths: [],
                  error: message,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
