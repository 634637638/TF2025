# 页面权限能力统一规范

> **唯一能力清单**：`config/module-permission-capabilities.json`  
> **强制审计**：`cd frontend && npm run check:permissions`  
> **适用范围**：受登录保护的页面、页面按钮、弹窗操作、批量操作和对应后端接口

## 目标

权限必须描述页面真实存在的业务能力。页面没有“管理”或“同步”功能时，不得因为通用模板而生成 `manage`、`sync`；页面只有查看能力时，只能登记 `view`。

共享能力清单是前端、后端和模块扫描器的唯一权限动作来源。数据库中的旧权限记录只能用于角色已分配状态，不能反向创造页面能力。

## 权限判定规则

| 动作 | 允许登记的条件 |
| --- | --- |
| `view` | 受保护页面需要被访问和读取数据，所有模块必有 |
| `create` | 页面确实能新增一条业务记录 |
| `edit` | 页面确实能修改已有业务记录 |
| `delete` | 页面确实能删除或清理业务记录 |
| `approve` | 存在独立审批动作，不得用 `edit` 代替 |
| `manage` | 存在无法归入普通 CRUD 的独立管理功能，例如分类管理；不得作为管理员兜底 |
| `export` / `import` | 页面存在真实导出或导入入口及接口 |
| `sync` | 页面存在用户主动触发的同步操作和独立接口 |
| `match` / `deliver` / `cancel` | 预定等业务存在对应独立状态流转 |
| `return-to-stock` | 存在真实退库业务动作 |
| `wholesale` / `proxy-transfer` | 销售模块存在对应独立出库流程 |

“按钮只给管理员看”不是登记 `manage` 的理由。按钮是什么业务动作，就使用什么动作权限；管理员同样通过角色授权获得该权限。

## 单一来源

- 模块及动作只在 `config/module-permission-capabilities.json` 登记。
- `backend/src/config/module-permission-actions.js` 只负责读取清单及维护模块中文元数据，不得再定义动作数组。
- `frontend/src/config/modules.ts` 和 `frontend/src/utils/permissionMapper.ts` 必须从清单派生，不得复制权限数组。
- 未登记模块运行时只能回退为 `view`，审计时受保护路由页面未登记会直接失败。
- `menu_view` 是导航入口权限，不是页面业务动作，不写入模块动作数组。

## 新增页面流程

1. 在路由中注册真实页面。弹窗和纯展示/筛选 Tab 沿用所属页面模块；具有独立数据、接口和业务职责的 Tab 必须建立独立模块。
2. 确定稳定的 `module_key`，在共享能力清单中只登记页面真实存在的动作。
3. 页面使用 `usePagePermissions(moduleAlias)`；按钮显示、点击处理函数都校验同一动作。
4. 后端写接口使用 `requirePermission('moduleAlias:action')` 校验相同动作，不能只隐藏前端按钮。
5. 如需简短模块名，在统一映射中添加兼容别名；不得建立“入库弹窗”“编辑弹窗”等虚假模块。
6. 运行 `npm run check:permissions` 和 `npm run check:standards`，全部通过后才能提交或打包。

## 修改或移除功能

- 新增按钮或接口时，先判断是否已有准确动作；没有时先在 `actionDefinitions` 和 `actionOrder` 定义，再登记到目标模块。
- 移除页面功能时，同时移除按钮、处理函数、接口授权映射和共享清单动作。
- 业务动作改名时，前端按钮、处理函数、后端接口、权限日志和能力清单必须一起修改。
- 数据库遗留的旧角色权限不得继续显示为可配置按钮；需要通过迁移或权限同步清理。
- `role_type=admin` 的启用角色在模块同步时获得该模块清单内的全部真实动作和 `menu_view`；普通角色仍按明确分配控制。
- 禁止根据“销售员、员工、经理”等角色名称给新模块自动授权；模块同步不得扩大普通角色的权限范围。

## 公开页面和容器页面

- 无需登录的公开页面登记在 `publicPages`，不得生成角色权限模块。
- 仅承载子路由的布局页面登记在 `scanExcludedPages`，不生成独立模块。
- 子组件、弹窗和 Tab 使用父页面权限；只有拥有独立路由和独立业务职责时才建立模块。

## 页面与独立 TAB 的查看权限

- 每个受登录保护的叶子路由必须在 `ROUTE_PERMISSION_MAP` 或 `H5_ROUTE_PERMISSION_MAP` 中配置精确的 `view`，不得依赖父路径前缀兜底。
- 受保护页面必须使用统一 `PermissionGate`；只有路由按钮隐藏而页面组件仍加载数据，不算完整的查看权限控制。
- 路由权限加载失败、权限为空或检查过程异常时必须拒绝访问，不得失败后放行。
- 主页面 `view` 只控制页面外壳。具有独立模块的子 Tab 由自己的 `view` 控制：有权限才显示，无权限时隐藏，手动输入子路由也必须拒绝访问。
- 没有独立路由文件的业务 Tab 仍必须由模块同步器从共享能力清单注册到数据库，禁止因文件扫描不到而停用或从权限配置列表消失。
- 同一数据的状态筛选、列表/卡片切换等纯展示 Tab 共用主页面 `view`，不得为视觉切换制造无业务意义的权限。
- 独立业务 Tab 在 `embeddedViewPermissions` 登记，并在宿主页面使用对应的 `data-view-permission="module:view"` 标记；缺少登记或标记时审计失败。
- 父容器权限不得作为独立子模块 `view/create/edit/delete` 的兜底，否则关闭子模块权限仍可能访问或操作。

## 审计要求

`check:permissions` 会检查：

- 默认权限是否严格为 `view`；
- 动作定义、顺序、重复项和扫描别名是否合法；
- 前后端是否读取同一份能力清单；
- 受保护路由扫描结果是否全部登记；
- 每个受保护叶子路由是否有精确 `view` 映射并接入统一 `PermissionGate`；
- 每个模块是否存在后端统一 `view` 映射；
- 独立业务 Tab 是否已登记并使用自己的 `view` 标记；
- 共享清单中的嵌入式模块是否全部进入数据库模块同步流程；
- 前端模块配置是否重新硬编码权限数组；
- 页面使用的 `canCreate`、`canManage`、`canSync` 等能力是否已在对应模块登记；
- `canUpdate` 是否继续映射到 `edit`，避免产生虚假的 `update` 权限；
- 公开页面和扫描排除页面是否仍真实存在。

该检查已接入 `check:standards`，并由 `predev`、`prebuild`、`prestart` 强制执行。审计失败必须按错误提示补齐真实实现或移除虚假权限，不允许通过新增例外跳过。

## 示例

价目表存在真实同步按钮和同步接口：

```json
"price_list_pricelistview": ["view", "create", "edit", "delete", "export", "import", "sync"]
```

前端和后端必须使用同一个 `sync`：

```ts
const { canSync } = usePagePermissions('price-list')
```

```js
router.post('/sync/trigger', unifiedAuth, requirePermission('price-list:sync'), handler)
```

租赁页面没有独立“管理”操作时，只登记其实际能力，不得追加 `manage`：

```json
"rentals_rentalsview": ["view", "create", "edit"]
```
