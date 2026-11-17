# 首页快捷方式配置

首页公告下方展示站点统一配置的快捷方式，管理入口为“系统设置管理 → 站点信息 → 快捷方式”。配置供全站共用，展示时按当前员工实际权限过滤，不是个人收藏。无配置时不自动写入默认入口，也不展示空卡片。

## 存储与接口

复用现有键值式 `settings`，独立键 `dashboard_shortcuts` 保存 JSON 数组；没有新增业务表，也不把它加入公开 `site-settings` 响应。首次保存时才创建该键。后端只检查 `key_name/value/type` 结构，不自动 DDL；历史宽表结构返回409并要求核对，不能默默丢弃配置。

单项包含服务端生成的UUID `id`、`label`（1至40字符）、`kind`（page/action）、`target`、登记图标 `icon`、`sortOrder`（0至9999整数）和布尔 `enabled`。数组按排序值、ID稳定升序；单个JSON配置最多60000字节。新增、更新和删除都在同一事务锁定该配置键，避免管理员操作不同条目时覆盖整个旧列表；失败回滚，损坏JSON不自动重置。

| 接口（前缀 `/api/system`） | 公共权限 | 行为 |
| --- | --- | --- |
| `GET /dashboard-shortcuts` | `dashboard:view` | 仅返回已启用项，首页再核验实际目标权限 |
| `GET /dashboard-shortcuts/admin` | `system:view` | 管理端读取全部项 |
| `POST /dashboard-shortcuts` | `system:edit` | 新增一项，返回管理列表 |
| `PUT /dashboard-shortcuts/:id` | `system:edit` | 更新指定项，保留ID及其他项 |
| `DELETE /dashboard-shortcuts/:id` | `system:delete` | 删除指定项，返回管理列表 |

全部接口沿用统一JWT认证、CSRF和错误响应。管理端额外核验 `system_systemview/settings.site_info` 字段可见性，字段读取失败按严格模式拒绝；页面、创建/更新、删除分别沿用系统查看、编辑和删除权限，不新增独立页面权限。前端复用 `unifiedApi`、领域API及 `dashboard-shortcuts` Pinia；保存成功同步首页列表，旧读取不得覆盖写入结果。后端动作权限继续独立生效，快捷入口不代替交易权限或门店范围校验。

字段权限复用公共存储解析，兼容现存SQL NULL加单字段权限列的有效记录，不能把它们当损坏JSON导致保存500；例如 `settings.id` 只读不限制 `settings.site_info` 的保存。站点信息自身隐藏或只读仍返回403，损坏JSON或非法单字段配置仍在写入前返回统一500。此兼容不修改云库记录、不降低严格模式，具体边界见[字段权限规范](../frontend/field-permission-guide.md#后端边界)。正式快捷方式测试使用真实字段权限服务和仓储配合数据库替身，覆盖有效旧记录保存、拒权零写入及故障零写入。

## 页面与功能目标

页面候选自动汇总Vue Router中已注册、有中文标题、需要登录且有统一权限映射的静态业务页面，及明确标记 `requiresAuth: false`、`dashboardShortcut: true` 的公开业务页面（报价、导航站和商城等）。可按页面名称搜索；不维护第二套页面目录。登录、错误页和依赖具体记录ID的详情页不作为候选。服务端只接受无查询串的站内路径；首页再排除未注册、停用和失效目标。配置不能传入外站、脚本、查询串或任意函数。

功能登记唯一来源为 `backend/src/config/dashboard-shortcuts.json`，前后端共用。当前登记80项、覆盖34个业务页面，包括手机/商品入库和销售、商品模板/类型/单位、基础资料新增、客户及积分设置、考勤、工资、备份、系统/权限设置、商城、报价、数据和分析页签等。管理下拉按所属页面分组，支持同时检索页面名和功能名；候选不会因为配置管理员本人缺少某业务权限而消失，首页则按使用员工权限过滤。前端复用 `canAccessRoutePath/usePagePermissions` 和目标页面原有权限，登记不会自动扩大权限。

以下三项保留既有参数，兼容已保存配置：

| 功能 | 现有目标 | 额外动作 |
| --- | --- | --- |
| 手机入库 | `/inventory?openStockIn=true` | `inventory:create`，复用已有入库路由参数 |
| 商品入库 | `/accessories?openStockIn=true` | `accessories:create` |
| 商品销售 | `/query?mode=goods&openSale=true` | `query:goods-view`，并具备 `query:goods-sell` 或 `query:goods-gift` |

商品入库/商品销售使用公共 `useRouteDialog` 消费参数，等待异步商品面板就绪，兼容KeepAlive，再次进入不重复打开；无权时消费旧参数但不打开。商品销售直达原商品收银，打开不创建交易；其原有收费、授权赠送和库存校验继续生效。不带 `mode=goods` 的综合查询仍默认手机模式，撤销商品查看权限时回到手机模式。

其余功能统一采用 `/目标页?shortcut=功能ID`，由公共 `usePageShortcuts`（位于 `useRouteDialog.ts`）显式绑定目标页面原有打开函数或页签；先等待页面挂载、字段权限和必要业务初始化，再消费参数并复核页面、动作及字段限制。工资/考勤等页面等待默认页签初始化完成，避免覆盖指定页签；KeepAlive和重复进入仍可正确消费。

功能只能打开表单、设置、页签或选择模式，不自动提交、删除、付款、同步或执行其他业务写入。手机销售先进入单台/批量选择模式，仍须选择设备；编辑、退货、贴膜等依赖具体单据或设备的操作仍由原页面先选择记录。散客收费贴膜可直达商品销售，不新增购机或贴膜服务次数。

后续新增页面只需维护真实路由、标题及权限映射，公开业务页另需明确标记；新增功能须在共享登记表填写ID、所属页面、名称和原有动作权限，并用 `usePageShortcuts` 绑定实际入口及必要的字段/初始化条件，再补充行为和登记闭环测试。不能只增加下拉选项，不允许DOM模拟点击按钮或动态执行配置函数。

## 验证与边界

正式测试为 `backend/test/dashboard-shortcuts.check.js`、`frontend/tests/dashboard-shortcuts.spec.ts` 和 `frontend/tests/dashboard-shortcut-registry.spec.ts`。登记闭环测试读取真实路由及页面绑定，检查全部候选、唯一功能ID、动作权限能力及实际处理入口，防止孤立配置；行为测试覆盖全部新功能的参数消费、指定处理函数、重复进入、拒权及初始化等待。完整后端测试使用仓库规定的隔离环境。前端视觉入口为 `node frontend/scripts/test-dashboard-shortcuts.mjs`（可用 `--viewports=390,768,1440` 指定视口），覆盖390/768/1440明暗主题、分组搜索、真实新增颜色直达和拒权、公共默认按钮与多列表单；真实综合查询收银回归复用 `node frontend/scripts/test-checkout-order.mjs --goods-sale-only --viewports=390,1440`。静态、类型、内存事务和隔离浏览器分别核对，不替代云端配置保存及物理手机验收。

本批代码测试不预置云端配置、不执行结构迁移、不创建采购销售交易；管理员实际保存站点配置时才写入上述设置键。当前验证证据及其余暂停范围统一见 [T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。
