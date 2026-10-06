# 字段权限使用指南

字段权限用于控制业务字段是否展示、是否可编辑。它不能替代页面动作权限，也不能只靠浏览器隐藏数据；后端接口必须按相同的角色字段配置处理敏感响应和写入。

## 前端入口

使用 `frontend/src/composables/useFieldPermissions.ts`：

```ts
import { useFieldPermissions } from '@/composables/useFieldPermissions'

const {
  init,
  isFieldVisible,
  isFieldEditable,
  getHiddenFields,
  filterFieldsByPermission
} = useFieldPermissions()

await init()
```

- `isFieldVisible(moduleKey, fieldKey)` 控制字段是否展示。
- `isFieldEditable(moduleKey, fieldKey)` 只在字段可见且字段被列入 `editable_fields` 时返回 `true`。
- `getHiddenFields(moduleKey)` 和 `filterFieldsByPermission(...)` 用于统一过滤。
- `shouldShowActionColumn(fieldVisible, actionPermissions)` 用于计算操作列是否展示。

具体模块名与字段 ID 应使用页面注册值，不要依赖短名称猜测兄弟页面的字段配置。

## 必须覆盖的区域

同一字段权限应一致应用于统计卡片、筛选项、表格、移动卡片、详情、表单、打印、导出和字段相关计算。表单提交应从允许字段构造请求，不能把被隐藏字段的旧值或默认值一并提交。

动作权限与字段权限分开判断：

- 字段权限决定数据列是否可见、字段是否可编辑。
- 页面动作权限决定创建、编辑、审批、到账、上传等操作能否执行。
- 所有业务操作列、卡片操作区和手机展开操作区必须使用公共 `shouldShowActionColumn(fieldVisible, actionPermissions)`，列可见性按“操作字段可见或至少一个列内动作获权”计算；禁止页面自行写 AND 条件。按钮仍单独校验自己的动作权限。
- 关闭操作字段后，只要用户仍拥有编辑、删除、匹配等任一动作权限，PC 操作列和手机展开操作区仍保留对应操作入口。
- 普通业务字段（例如状态、时间、金额）只由自身字段权限控制，不能因为用户拥有某个动作权限而被强制显示。

## 后端边界

角色字段配置保存在 `role_field_permissions.field_config`，当前格式由后端 `field-permission-normalizer` 解析。用户字段权限由受认证接口 `GET /permissions/user-field-permissions` 返回。

后端必须针对具体业务接口执行字段过滤和写入校验。前端 `v-if`、本地权限缓存或只读样式都不是数据安全边界。新增字段权限时，应同步更新字段登记、后端响应/写入处理和契约测试。

相关入口：

- 字段登记：`frontend/src/config/moduleFields.js`
- 字段权限归一化：`backend/src/utils/field-permission-normalizer.js`
- 字段配置接口：`backend/src/routes/permission-management.js`
- 字段契约：`config/field-contracts.json`
- 覆盖检查：`cd frontend && npm run check:field-permissions`

不要使用旧文档中提到的 `v-field-permission`、`FieldPermissionWrapper` 或 `useFieldPermission`；当前项目没有这些统一入口。
