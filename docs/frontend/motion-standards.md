# 全局动效规范

## 公共入口

动效令牌在 `frontend/src/styles/_variables.scss` 定义：

| 令牌 | 用途 |
| --- | --- |
| `--tf-motion-fast` | 控件状态反馈 |
| `--tf-motion-standard` | 一般交互过渡 |
| `--tf-motion-enter` | Dialog、通知等进入/离开 |
| `--tf-motion-slow` | 导航和较明显的布局过渡 |
| `--tf-motion-ease-standard` | 默认缓动 |
| `--tf-motion-ease-emphasized` | 强调型反馈缓动 |

减少动态偏好下，时长令牌归零；不得为了装饰效果覆盖系统偏好。Loading 的旋转由 Loading 组件负责，状态变化优先使用 `transform` 和 `opacity`，避免对布局属性使用宽泛的 `transition: all`。

## 使用规则

- 新增或修改公共交互不得直接写时长、延迟或缓动数字；应组合使用 `--tf-motion-*`。
- 页面专属且确需不同节奏时，先增加有语义的组件令牌，不复制另一套公共时长表。
- CSS keyframes 的业务效果可以保留，但动画时长和缓动必须引用公共令牌。
- 复杂业务动画应尊重 `prefers-reduced-motion`，不能只覆盖普通 transition。
- 页面切换由 Vue Router transition 壳负责；业务页面不得各自添加路由级切换动画。

## 历史迁移与审计

现存硬编码动效按文件保存在 `frontend/scripts/motion-adoption-baseline.json`。这只是迁移门禁，不代表历史声明已经统一；迁移后必须减少对应文件计数，不能提高基线掩盖新增。

```bash
cd frontend
npm run check:motion
```

此检查验证令牌、减少动态偏好、核心公共组件接入，并禁止硬编码动效继续增加。公共 Dialog、通知和 Loading 的动效令牌使用由审计持续检查。

最后更新：2026-10-01
