# Project instructions
Ze Qin's personal technical portfolio and learning website.

Primary goals: professional AI/software architecture portfolio, project case studies, AI
Architect Practice, technical learning notes, development progress, technical articles,
multilingual content, and lightweight static deployment.

- Production: https://ai.zeaitech.com/
- Repository: https://github.com/qinze2017/ze-ai-architect

## Stack
Keep Hugo, Markdown, Hugo templates, native HTML, CSS, minimal vanilla JavaScript,
GitHub, Giscus, and Cloudflare Pages. Prefer Hugo-native features before custom JS. Do not
introduce React, Next.js, Vue, Angular, a database, CMS, or large JS dependencies unless
explicitly requested.

## Engineering and Git
Prioritize correctness, maintainability, simplicity, performance, then visual polish.
Avoid unnecessary abstractions/dependencies; do not rewrite working code without concrete
reason. Inspect relevant code before changing it and keep changes narrowly scoped.

At the start of coding tasks run `git status`. Never overwrite unrelated user changes,
commit, or push unless explicitly requested. Never use `git reset --hard`, `git clean -fd`,
or `git checkout -- .` without explicit authorization.

At task end report files changed, what was fixed/added, build/test result, and remaining issues.

## Hugo validation
For meaningful changes run `hugo --minify --gc`; fix build errors, report relevant warnings,
and do not automatically treat warnings as errors. Follow current Hugo conventions and avoid
deprecated configuration when practical. Production `baseURL` remains `https://ai.zeaitech.com/`.

## Multilingual
- `zh`: default Chinese, `/`; `fr`: Canadian French, `/fr/`; `en`: English, `/en/`.
- Use Hugo multilingual/i18n; do not duplicate templates merely to translate UI. Shared UI
  text should use i18n where practical; Java, Spring Boot, RAG, LLM, Agent, Docker, and
  PostgreSQL may remain English.
- Prefer matching translated pages when switching languages. Use professional Canadian/Québec
  French and professional North American technical English.

## Giscus
Show GitHub Discussions comments only on content pages with `showComments = true`. Use
`qinze2017/ze-ai-architect`; `repoId = R_kgDOTh5MpA`; category `Announcements`;
`categoryId = DIC_kwDOTh5MpM4DB2RV`; mapping `pathname`; strict `0`; reactions enabled;
input position top; theme `preferred_color_scheme`; lazy loading. Map Giscus UI: `zh` →
`zh-CN`, `fr` → `fr`, `en` → `en`.

## Design and content
Preserve the modern, restrained, premium AI/software-architect identity unless redesign is
requested: strong typography, whitespace, polished light/dark themes; avoid generic
Bootstrap UI and excessive animation. Test around 1440, 1280, 1024, 768, 430, and 390px:
no horizontal overflow, overlap, clipping, or inaccessible controls. Respect
`prefers-reduced-motion`.

Sections: About, Projects, AI Architect Practice, Learning, Progress, Posts, Search.
PromoLocal is a featured real-world project. AI Architect Practice should emphasize
architecture reasoning, trade-offs, failure cases, observability, security, cost,
implementation, and takeaways—not generic AI summaries.

## SEO, accessibility, security
Preserve or improve semantic HTML, accessible/keyboard navigation, appropriate ARIA,
canonical URLs, Open Graph, JSON-LD, sitemap, RSS, and multilingual hreflang. Never use
`example.com` in production metadata. Never add secrets (API keys, tokens, passwords,
Cloudflare/GitHub credentials); use environment-variable names only when needed.
