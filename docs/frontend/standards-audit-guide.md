# TF2025 前端规范审计接入指南

## 目标

规范文档用于说明正确做法，公共组件和全局样式用于提供正确实现，审计脚本用于阻止页面绕开规范。三者必须同时存在，才能做到“不符合规范就不能启动或构建”。

## 当前统一命令

在项目根目录执行：

```bash
npm run check:standards
```

该命令会依次运行前端的 TAB、按钮、加载动画和数据实时性审计。任意一项失败都会返回非零退出码，并停止后续启动或构建。

以下入口已自动执行审计：

```bash
# 根目录一键启动前后端
npm run dev
npm start

# 单独启动前端
cd frontend
npm run dev
npm start

# 前端构建
npm run build
npm run build:debug
```

`frontend:raw` 和 `frontend/dev:server` 是一键启动内部使用的无重复审计入口，不作为日常开发命令。

## 新增一项规范审计

新增例如“模态框统一审计”时，按以下顺序实施：

1. 在 `docs/frontend/` 编写规范，明确适用范围、唯一公共入口、允许项和禁止项。
2. 在公共组件或 `frontend/src/styles/components/` 中实现统一结构和视觉。
3. 将现有页面迁移到公共实现，并删除重复、冗余和冲突的页面级代码。
4. 在 `frontend/scripts/` 新增 `check-*.mjs`，扫描必须使用的公共 class、组件或 API，并检测禁止的页面级覆盖。
5. 在 `frontend/package.json` 增加独立命令，例如：

```json
"check:dialogs": "node scripts/check-dialog-styles.mjs"
```

6. 将新命令追加到 `check:standards`：

```json
"check:standards": "npm run check:tabs && npm run check:buttons && npm run check:dialogs"
```

7. 准备一个合规样例和一个违规样例，确认合规代码退出码为 `0`、违规代码退出码为 `1`，最后执行生产构建。

## 审计脚本设计要求

- 错误必须包含文件路径、行号和具体违规原因。
- 只检查能够明确判定的规则，不能用宽泛关键词误伤业务代码。
- 公共样式文件使用明确允许列表，业务页面不得加入允许列表绕过检查。
- 特殊业务控件必须使用独立语义 class，并在规范中说明为什么不属于公共规则。
- 新增规则不能只检查新页面，必须扫描整个 `frontend/src`。

## 审计边界

静态审计适合检查公共组件接入、禁止的 CSS 覆盖、错误 API 调用和重复实现。它不能可靠判断遮挡、文字溢出、真实触摸滑动和视觉效果；这些仍需要浏览器在手机及 PC 视口下验证。

