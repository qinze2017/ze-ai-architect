import "dotenv/config";

const OWNER = "qinze2017";
const REPO = "ze-ai-architect";
const BRANCH = "main";
const LEARNING_DIR = "content/learning";

const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("Missing GITHUB_TOKEN");
}

const githubHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

export async function listLearningDirectory() {
  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${LEARNING_DIR}` +
    `?ref=${BRANCH}`;

  const response = await fetch(url, {
    headers: githubHeaders,
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `GitHub request failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected GitHub response: learning directory is not a directory");
  }

  return data.map((item) => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    type: item.type,
  }));
}

export async function readLearningArticle(path: string) {
  if (!path.startsWith(`${LEARNING_DIR}/`)) {
    throw new Error("Path must be under content/learning/");
  }

  if (!path.endsWith(".md")) {
    throw new Error("Only Markdown files are allowed");
  }

  if (path.includes("..")) {
    throw new Error("Path traversal is not allowed");
  }

  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}` +
    `?ref=${BRANCH}`;

  const response = await fetch(url, {
    headers: githubHeaders,
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `GitHub request failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  const data = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data) ||
    data.type !== "file" ||
    typeof data.content !== "string"
  ) {
    throw new Error("Unexpected GitHub response");
  }

  const content = Buffer.from(data.content, "base64").toString("utf8");

  return {
    name: data.name,
    path: data.path,
    sha: data.sha,
    content,
  };
}

export async function checkLearningFilesExist(paths: string[]) {
  const results = [];

  for (const path of paths) {
    if (!path.startsWith(`${LEARNING_DIR}/`)) {
      throw new Error(`Path outside learning directory: ${path}`);
    }

    if (path.includes("..")) {
      throw new Error(`Path traversal is not allowed: ${path}`);
    }

    const encodedPath = path
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const url =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}` +
      `?ref=${BRANCH}`;

    const response = await fetch(url, {
      headers: githubHeaders,
    });

    if (response.status === 404) {
      results.push({
        path,
        exists: false,
      });
      continue;
    }

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `GitHub request failed for ${path}: ` +
          `${response.status} ${response.statusText} ${body}`
      );
    }

    const data = await response.json();

    results.push({
      path,
      exists: true,
      sha:
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        typeof data.sha === "string"
          ? data.sha
          : undefined,
    });
  }

  return results;
}

export type LearningFileToPublish = {
  path: string;
  content: string;
};

type GitHubRefResponse = {
  object: {
    sha: string;
  };
};

type GitHubCommitResponse = {
  sha: string;
  tree: {
    sha: string;
  };
};

type GitHubBlobResponse = {
  sha: string;
};

type GitHubTreeResponse = {
  sha: string;
};

async function githubJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...githubHeaders,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `GitHub request failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  return (await response.json()) as T;
}

function assertPublishPath(path: string) {
  if (!path.startsWith(`${LEARNING_DIR}/`)) {
    throw new Error(`Write outside learning directory is forbidden: ${path}`);
  }

  if (path.includes("..")) {
    throw new Error(`Path traversal is forbidden: ${path}`);
  }

  if (!path.endsWith(".md")) {
    throw new Error(`Only Markdown files may be published: ${path}`);
  }
}

export async function publishLearningFilesAtomic(
  files: LearningFileToPublish[],
  date: string,
  expectedHeadSha: string
) {
  if (files.length === 0) {
    throw new Error("No files to publish");
  }

  for (const file of files) {
    assertPublishPath(file.path);

    if (!file.content.trim()) {
      throw new Error(`Empty content is forbidden: ${file.path}`);
    }
  }

  //
  // 1. Resolve the current main branch HEAD.
  //
  const refUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}` +
    `/git/ref/heads/${BRANCH}`;

  const currentRef = await githubJson<GitHubRefResponse>(refUrl);

  const currentCommitSha = currentRef.object.sha;

  if (currentCommitSha !== expectedHeadSha) {
    throw new Error(
      "main branch changed after duplicate check; publication aborted"
    );
  }

  //
  // 2. Read the current commit to obtain its tree.
  //
  const currentCommitUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}` +
    `/git/commits/${currentCommitSha}`;

  const currentCommit =
    await githubJson<GitHubCommitResponse>(currentCommitUrl);

  const currentTreeSha = currentCommit.tree.sha;

  //
  // 3. Create one Git blob for every Markdown file.
  //
  const treeEntries: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }> = [];

  for (const file of files) {
    const blobUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`;

    const blob = await githubJson<GitHubBlobResponse>(blobUrl, {
      method: "POST",
      body: JSON.stringify({
        content: file.content,
        encoding: "utf-8",
      }),
    });

    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  //
  // 4. Create one new tree based on the existing repository tree.
  //
  const treeUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}/git/trees`;

  const newTree = await githubJson<GitHubTreeResponse>(treeUrl, {
    method: "POST",
    body: JSON.stringify({
      base_tree: currentTreeSha,
      tree: treeEntries,
    }),
  });

  //
  // 5. Create exactly one Git commit containing all new files.
  //
  const commitUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}/git/commits`;

  const newCommit = await githubJson<GitHubCommitResponse>(commitUrl, {
    method: "POST",
    body: JSON.stringify({
      message: `Publish daily learning ${date}`,
      tree: newTree.sha,
      parents: [currentCommitSha],
    }),
  });

  //
  // 6. Move main to the new commit.
  //
  // force=false means we never force-push.
  // If main changed after step 1, GitHub should reject a non-fast-forward update.
  //
  const updateRefUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}` +
    `/git/refs/heads/${BRANCH}`;

  await githubJson(updateRefUrl, {
    method: "PATCH",
    body: JSON.stringify({
      sha: newCommit.sha,
      force: false,
    }),
  });

  return {
    commit_sha: newCommit.sha,
    previous_commit_sha: currentCommitSha,
    created_paths: files.map((file) => file.path),
  };
}

export async function getMainHeadSha() {
  const refUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}` +
    `/git/ref/heads/${BRANCH}`;

  const currentRef = await githubJson<GitHubRefResponse>(refUrl);

  return currentRef.object.sha;
}

export async function findDailyLearningPrimaryArticle(date: string) {
  const entries = await listLearningDirectory();

  const prefix = `${date}-`;

  const matches = entries.filter((item) => {
    if (item.type !== "file") return false;
    if (!item.name.startsWith(prefix)) return false;
    if (!item.name.endsWith(".md")) return false;
    if (item.name.endsWith(".fr.md")) return false;
    if (item.name.endsWith(".en.md")) return false;

    return true;
  });

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple primary daily learning articles already exist for ${date}`
    );
  }

  return matches[0];
}
