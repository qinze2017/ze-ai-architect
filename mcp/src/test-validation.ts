import { validateDailyLearningInput } from "./validation.js";

const sample = {
  date: "2026-10-10",
  slug: "spring-transaction-boundaries",
  zh_content: `+++
title = "测试"
date = 2026-10-10
draft = false
summary = "测试摘要"
tags = ["Java"]
categories = ["每日复习"]
showComments = true
+++

正文`,
  fr_content: `+++
title = "Test"
date = 2026-10-10
draft = false
summary = "Résumé de test"
tags = ["Java"]
categories = ["Apprentissage"]
showComments = true
+++

Contenu`,
  en_content: `+++
title = "Test"
date = 2026-10-10
draft = false
summary = "Test summary"
tags = ["Java"]
categories = ["Learning"]
showComments = true
+++

Content`,
};

console.log(validateDailyLearningInput(sample));
