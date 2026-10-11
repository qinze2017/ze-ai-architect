import { z } from "zod";

export const dailyLearningInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),

  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "slug must be lowercase English kebab-case"
    ),

  zh_content: z.string().min(1, "zh_content is required"),
  fr_content: z.string().min(1, "fr_content is required"),
  en_content: z.string().min(1, "en_content is required"),
});

export type DailyLearningInput = z.infer<typeof dailyLearningInputSchema>;

const LEARNING_DIR = "content/learning";

export function buildLearningPaths(date: string, slug: string) {
  const base = `${LEARNING_DIR}/${date}-${slug}`;

  return {
    zh: `${base}.md`,
    fr: `${base}.fr.md`,
    en: `${base}.en.md`,
  };
}

function validateFrontMatter(
  content: string,
  expectedDate: string,
  language: "zh" | "fr" | "en"
) {
  const trimmed = content.trim();

  if (!trimmed.startsWith("+++")) {
    throw new Error(`${language} content must start with TOML front matter`);
  }

  const secondDelimiterIndex = trimmed.indexOf("+++", 3);

  if (secondDelimiterIndex === -1) {
    throw new Error(`${language} content is missing closing TOML front matter`);
  }

  const frontMatter = trimmed.slice(3, secondDelimiterIndex);

  const requiredChecks = [
    {
      ok: /draft\s*=\s*false/.test(frontMatter),
      message: "draft = false is required",
    },
    {
      ok: /showComments\s*=\s*true/.test(frontMatter),
      message: "showComments = true is required",
    },
    {
      ok: new RegExp(`date\\s*=\\s*${expectedDate}`).test(frontMatter),
      message: `date must be ${expectedDate}`,
    },
    {
      ok: /title\s*=\s*".+"/.test(frontMatter),
      message: "title is required",
    },
    {
      ok: /summary\s*=\s*".+"/.test(frontMatter),
      message: "summary is required",
    },
  ];

  for (const check of requiredChecks) {
    if (!check.ok) {
      throw new Error(`${language} content invalid: ${check.message}`);
    }
  }
}

export function validateDailyLearningInput(input: unknown) {
  const parsed = dailyLearningInputSchema.parse(input);

  validateFrontMatter(parsed.zh_content, parsed.date, "zh");
  validateFrontMatter(parsed.fr_content, parsed.date, "fr");
  validateFrontMatter(parsed.en_content, parsed.date, "en");

  return {
    ...parsed,
    paths: buildLearningPaths(parsed.date, parsed.slug),
  };
}
