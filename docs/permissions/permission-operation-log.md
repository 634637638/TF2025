# 权限操作日志规范

## 适用范围

`permission_operation_logs` 仅记录权限管理域操作，不等同于整站业务审计日志。权限管理页面中的数据写操作必须由对应后端接口写入日志；读取列表、搜索、翻页、刷新和打开弹窗不记录，避免产生无意义日志。

当前覆盖：

- 角色管理：新增、编辑、删除、启用/停用、动作权限、菜单显示权限和字段权限修改；
- 角色分配：新增角色、移除角色及修改前后的角色集合；
- 门店绑定：新增、移除、清空和主门店调整；
- 模块管理：注册、批量注册、同步、创建、编辑、改名、恢复名称、启用/禁用和删除。

## 写入规则

- 后端业务接口是唯一日志写入入口，前端不得在业务请求成功后再次调用日志接口，避免重复记录。
- 日志至少保存操作人、操作类型、目标类型、目标 ID、目标名称、摘要、详情 JSON、IP、状态和创建时间。
- `description` 用于列表摘要；`details` 用于保存角色、权限等变更前后的结构化数据。
- 同一次保存涉及多个模块时只写一条日志，并在 `details.module_changes` 中按模块分组，禁止为每一个复选框额外制造多条重复日志。
- 后端必须在修改前读取旧数据并计算差异，至少保存新增项、移除项、修改前集合和修改后集合；前端不得自行推测差异。
- 日志写入失败不得回滚已经成功的业务操作，但必须写入后端错误日志便于排查。
- 清空权限日志是例外：成功后只在后端运维日志记录操作人 ID 和删除数量，不向刚清空的 `permission_operation_logs` 再插入一条记录。

## 权限差异结构

角色动作权限、菜单显示权限和字段权限统一使用模块级差异：

```json
{
  "audit_type": "role_action_permissions",
  "added_count": 2,
  "removed_count": 1,
  "affected_modules_count": 2,
  "module_changes": [
    {
      "module_key": "inventory_inventoryview",
      "module_name": "库存管理",
      "added_permissions": ["edit", "delete"],
      "removed_permissions": []
    }
  ]
}
```

`audit_type` 的主要取值：

- `role_action_permissions`：查看、新增、编辑、删除等操作权限；
- `role_menu_permissions`：菜单显示和隐藏；
- `role_field_permissions`：字段隐藏和恢复显示；
- `user_role_assignment`：用户角色分配；
- `user_store_binding`：用户门店绑定；
- `module_*`：模块创建、同步、改名、状态等操作。

## 分页与筛选

- 权限日志使用后端分页，前端不得对接口返回的当前页再次 `slice`。
- 页码、每页数量、操作类型、用户名和日期范围必须传给 `/permission-logs/logs`。
- 分页总数以接口返回的 `pagination.total` 为准，不能使用当前页数组长度。

## 保留时间

当前没有自动清理任务或固定保留天数，权限日志默认长期保留。用户主动删除或清空、手动执行数据库清理或未来新增明确的日志归档策略时，数据才会被移除。

统计接口中的“近 30 天”只限定统计范围，不会删除日志，也不会限制日志列表查询。

## 清空全部日志

- 权限日志 TAB 的公共页头在“导出日志”旁提供“清空日志”，沿用公共危险按钮、确认框和 Loading。按钮使用 `v-permission` 和 `usePagePermissions` 的 `permissions:delete` 能力；没有删除权限不能调用，后端独立鉴权。
- 接口为 `DELETE /api/permission-logs/logs`，必须经过 `unifiedAuth` 和 `requirePermission('permissions:delete')`，复用已有删除能力，不增加新的管理员动作。原有单条删除接口及权限保持原契约。
- 二次确认明确包含筛选范围外的全部记录且无法恢复，建议先导出；取消不发删除请求，处理中防重复提交。
- route 委托 controller → service → repository，仓储以一条 `DELETE FROM permission_operation_logs` 删除该表全部记录，不重置自增值、不触碰其他日志或权限配置，无需数据库迁移。
- 成功响应为 `{ success: true, message: '权限日志已清空', data: { deleted_count: 数量 } }`，空表返回数量 0。失败返回通用错误，不暴露数据库细节。
- 成功后回到第一页并重新读取列表；清空期间撤销旧读取，使用公共 `useLatestRequest` 防止旧响应回填，删除期间不接受新的列表读取。清空后的新增权限操作仍正常记录，刷新后可以显示。
- 回归入口：`node --test backend/test/permission-logs-controller.check.js` 与 `npm --prefix frontend run test:unit -- tests/permission-logs-clear.spec.ts`。测试使用模拟仓储和请求，不执行真实清库。

## 展示规则

列表默认展示摘要字段，每条日志均提供文字按钮“查看详情”。详情弹窗必须：

- 展示操作人、时间、对象、IP 和摘要；
- 按模块逐行展示具体开启、关闭、显示、隐藏或字段变化，一行只对应一个发生变化的模块；
- 权限变更详情直接显示“查看、编辑、删除”等实际权限名称，不展示新增数量、移除数量、当前权限数等统计数字代替明细；
- 一次涉及多个模块时完整展示所有模块；
- 角色和门店分配分别展示新增项与移除项；
- 兼容旧日志：旧记录没有前后差异时展示当时保存后的权限集合，并明确标注为历史记录；
- 遵循全局对话框和按钮规范，PC 自适应内容，手机按钮保持一行。

不得把大型 JSON 直接塞入主表格，也不得仅依赖模糊的 `description` 完成审计。
