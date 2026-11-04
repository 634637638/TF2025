# TF2025 仓库指令

开始任务时先阅读根目录 [`AGENTS.md`](AGENTS.md)，遵循修改前阅读、公共实现、实施测试及完成检查的流程。首次写入前说明已读的适用规范、复用入口和准备执行的检查。

项目规范总入口为 [`docs/00-INDEX.md`](docs/00-INDEX.md)。前端按 [`docs/frontend/INDEX.md`](docs/frontend/INDEX.md) 和 `standards-manifest.json` 查找适用规范及审计；后端按 [`docs/backend/INDEX.md`](docs/backend/INDEX.md) 查找专题要求。跨模块开发和文档规范见 [`docs/CLAUDE.md`](docs/CLAUDE.md) 与 [`docs/guides/DOCUMENTATION_STANDARDS.md`](docs/guides/DOCUMENTATION_STANDARDS.md)。

不要仅阅读规范后就假定实现符合要求；修改前检查目标代码和调用链，完成后运行适用的审计与测试，并如实报告结果。
