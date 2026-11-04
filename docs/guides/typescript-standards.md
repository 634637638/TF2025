# TF2025 TypeScript 规范

本文规定前端类型的单一来源、局部类型边界和校验方式。实际编译选项以 `frontend/tsconfig.json` 为准；后端现有 JavaScript 技术边界不因本指南而自动迁移。

## 唯一权威定义与就近类型

| 类型 | 放置与复用 |
| --- | --- |
| 多页面共享的业务实体、API 请求/响应、分页、权限能力 | 在 `frontend/src/types/` 对应领域文件维护，复用已有定义 |
| 一个组件独有的 Props、Emits、内部状态或一个函数独有的辅助类型 | 可在实现文件就近定义；跨模块复用后提取，不制造第二个领域实体 |
| 公共 Composable 或工具独有的配置类型 | 可与公共实现同文件导出，由调用方引用 |
| 第三方库类型 | 优先引用包自带类型，缺失时在唯一声明文件补齐 |
| Window、Vue 模块扩展 | 在 `global.d.ts` 等统一声明处维护，禁止冲突重复属性 |

同名不代表同一业务模型。合并前核对字段含义、主键、可空性、状态、时间和金额单位；不同语义应使用明确名称。新增共享类型前先搜索，迁移全部引用后再删除重复定义。

既有公共服务已导出的权威类型先复用原入口，例如 `services/reference-options.ts` 的 `ReferenceRecord`；若迁入类型目录，应同时迁移引用并删除旧定义，不能为符合目录形式在两处各复制一份。

`@/types` 是现有导出入口，领域文件也可以直接使用 `import type`，不为实现“统一”强行建立循环导出。页面不能复制 `ApiResponse`；统一响应见 [API 规范](api-standards.md)。

以下完整示例参加编译检查：

```ts check
import type { ApiResponse, Store } from '@/types'

export function readStoreNames(response: ApiResponse<Store[]>): string[] {
  return (response.data ?? []).map(store => store.name)
}
```

## 未知数据与类型逃逸

- 新代码优先用具体业务类型；未知输入使用 `unknown`，先校验再访问字段。
- 禁止以新增 `any`、`as any`、`as unknown as T`、忽略指令或关闭编译检查掩盖接口不一致。
- 类型断言只适用于边界已经验证或库签名无法表达的场景，需说明依据；泛型和断言都不会验证真实 JSON。
- 不将动态数据包装成 `ReturnType<typeof JSON.parse>` 等间接类型来伪造清零。既有动态边界由 [类型债务检查](../development/FRONTEND_TYPE_UNIFICATION_PROGRESS.md) 跟踪，迁移时补充字段契约或守卫。
- DTO、表单和视图模型有差异时用明确适配，不把所有字段改成可选或扩大联合类型消除错误。
- 同一 API 的多种合法业务响应用可判别联合表达，保持字段和空值可追踪。

```ts check
export function readStringId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}
```

## 编译选项与历史债务

不复制一份理想化 `tsconfig` 作为当前配置。读取实际文件和 `npm --prefix frontend run type-check` 的结果；开启 `strict` 但单独关闭子选项时，不能宣称全量严格模式已经完成。

收紧空值、函数参数或未使用项检查时，按模块修复真实错误，再移除配置例外。不得为单次修复降低已经开启的选项。显式 `any`、隐式 `any`、重复类型和无效断言分别核对，单一关键词数量不能证明类型安全。

## 实施与回归

1. 查找现有实体、API 和组件类型及引用。
2. 对照真实字段、响应和空值调整权威类型，避免根据单一调用方猜测全局模型。
3. 迁移调用点和模板，保留业务、权限、通知及 Loading 行为。
4. 验证动态注册、全局声明和外部库扩展后再删重复定义。
5. 执行 `type-check`、`check:typescript-debt`、定向 ESLint 和模块测试；文档示例由 `npm run check:docs` 编译。

行为测试验证输入输出和契约，静态审计可以禁止类型逃逸，但不能强制某个变量名或要求使用 `any`。相关范围和交付要求见 [代码审查规范](CODE_REVIEW_STANDARDS.md)。
