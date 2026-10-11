import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: "java-ai-learning-test-client",
  version: "1.0.0",
});

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);

await client.connect(transport);

console.time("publish_daily_learning");

const result = await client.callTool({
  name: "publish_daily_learning",
  arguments: {
    date: "2026-10-11",
    slug: "another-daily-learning",
    zh_content: `+++
title = "Spring 事务边界测试"
date = 2026-10-11
draft = false
summary = "用于验证每日学习发布流程的中文测试内容。"
tags = ["Java", "Spring"]
categories = ["每日复习"]
showComments = true
+++

这是中文测试内容。`,

    fr_content: `+++
title = "Test des limites de transaction Spring"
date = 2026-10-11
draft = false
summary = "Contenu de test en français pour valider le flux de publication."
tags = ["Java", "Spring"]
categories = ["Apprentissage"]
showComments = true
+++

Ceci est un contenu de test en français.`,

    en_content: `+++
title = "Spring Transaction Boundaries Test"
date = 2026-10-11
draft = false
summary = "English test content for validating the daily learning publishing workflow."
tags = ["Java", "Spring"]
categories = ["Learning"]
showComments = true
+++

This is English test content.`,
  },
});

console.timeEnd("publish_daily_learning");
console.log(JSON.stringify(result, null, 2));

await client.close();
