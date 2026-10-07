# 统一菜单 API 规范

本文规定后台 PC、手机和平板端的用户菜单入口、权限来源及模块关联规则。最后核实日期：2026-10-07。

## 公共调用链

前端统一通过 `frontend/src/stores/menu.ts` 的 `useMenuStore` 获取菜单，使用公共 Axios 封装调用 `GET /api/permissions/user-menu`。实际路由处理器为 `backend/src/permissions/menuPermissionFilter.js`。

处理器和 `backend/src/services/unifiedMenu.service.js` 均复用 `accessControl.service.js` 的 `getUserMenuVisibility`。不能声称所有路由都由统一菜单服务直接处理，也不能在页面或布局内另写角色名判断。

`/api/menus/*` 用于菜单管理 CRUD，不承担当前用户可见菜单查询。用户菜单接口需要 JWT 认证，返回如下结构：

```json
{
  "success": true,
  "data": {
    "menuPermissions": [
      {
        "id": 91,
        "name": "考勤工资",
        "url": "#",
        "parent_id": 0,
        "children": [
          {
            "id": 59,
            "name": "工资管理",
            "url": "/Salary",
            "parent_id": 91,
            "children": []
          }
        ]
      }
    ]
  }
}
```

## 权限与菜单层级

权限检查遵循“用户 → 有效角色 → 权限”。仅启用且用户绑定状态有效、未过期的角色参与计算；多角色菜单显式配置取可见并集，不根据“管理员”“销售员”等名称绕过规则。

菜单显示与页面查看独立：

- `view` 决定是否可以访问页面，页面和接口仍执行各自公共权限检查。
- 菜单可见性优先读取 `role_menu_visibility` 的显式配置。缺少该表时，使用 `role_permissions` 的 `menu_view` / `menu_visible` 配置。
- 没有显式菜单配置时，才允许根据已有业务权限推导可见性；显式隐藏不能被 `view` 自动覆盖。
- 菜单以 `module_key` 识别权限模块；缺少 Key 时可按有效 `module_id` 解析，维护时应保证二者一致。
- 当前实现中，无模块关联的菜单对已认证用户可见。

一级改为二级只改变 `parent_id`，不得改变该菜单的权限模块和页面授权。过滤先处理子菜单；只要有可见子菜单，父菜单即保留，包括父菜单自身关联模块被隐藏的情况。纯导航父节点无需额外授予业务权限。

工资管理主菜单应绑定 `salary_salaryview`，而不是同名的工资记录子模块 `salary_salaryrecordsview`。“我的工资” Tab 使用 `salary_mysalaryview` 授权；不能为了显示工资主菜单而授予全部工资记录或模板权限。营销文案后台绑定 `marketing_marketingmanagementview`，不能绑定公开营销页模块。

## 模块扫描与关联

`backend/src/services/menuModuleLinker.js` 是菜单自动关联的公共实现。模块扫描器的增量注册和全量修复均复用该服务，不另维护名称映射或 URL 匹配逻辑。

菜单编辑表单按公共路由查看权限和 `MODULE_KEY_MAP` 精确选择主页面模块，未识别路径由用户手动关联，不使用模糊包含判断。后台 `/api/menus/auto-bind-modules` 的适配服务也委托公共关联实现，只选择已注册的有效模块，不根据 URL 自行创建另一套模块；纯导航 `#` 不参与业务模块自动绑定。

有明确菜单映射时，按规范模块 Key 选择模块，优先于显示名称；不能因多个模块同名、查询顺序不同而绑定到子 Tab。规范模块不存在时不得退回同名子模块。普通已手动关联且无明确映射规则的菜单保持原关联。

模块扫描和关联修复不自动向普通角色发放权限。新增菜单时应核对目标模块、一级/二级结构，并分别配置角色的菜单显示及页面查看权限。

## 刷新与验证

权限或菜单变动后，通过 `useMenuStore.refreshMenus()` 重新请求；管理员在另一个账户修改权限后，目标用户可刷新页面或重新登录加载新菜单与权限。不能依赖永久缓存的菜单树。

回归至少检查：

1. 一级与二级位置下，同一菜单授权结果一致。
2. 子菜单可见时保留父节点，显式隐藏仍生效。
3. 菜单可见不等于接口或页面自动获得查看、编辑等权限。
4. 主页面和子 Tab 同名时，扫描前后仍关联正确模块。
5. PC、手机和平板使用同一用户菜单数据源。

运行 `cd backend && node --test test/menu-module-linker.check.js` 检查模块关联与层级过滤回归，运行 `npm --prefix frontend run check:permissions` 检查页面权限能力接入。

2026-10-07 已对云端销售员角色定向修复工资菜单错误关联，并按用户授权启用营销文案查看和菜单显示。抽样 3 个实际销售员用户，用户菜单处理器与统一菜单服务均返回两个二级菜单，薪资查询范围仍为 `own`，工资记录和工资模板未获查看权限。验证覆盖服务端返回和权限范围，未执行浏览器视觉回归；模块扫描代码修复需随后端部署上线。维护前后快照通过公共日志工具记录为 `menu_module_permission_repair`，没有冒用管理员身份写权限操作记录。

## 相关文档

- [权限系统完整指南](../permissions/permission-system-guide.md)
- [页面模块扫描规则](../permissions/page-module-scan-guide.md)
- [页面权限能力统一规范](../frontend/permission-capability-standards.md)
