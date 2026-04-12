# 供应商打款菜单配置指南

## 📋 配置说明

由于菜单名称验证规则要求英文名称,我们已经准备好了完整的SQL脚本,包含:
- ✅ 创建供应商打款模块
- ✅ 创建供应商打款菜单(使用英文名称 `supplier-payments`)
- ✅ 创建所有相关权限
- ✅ 关联菜单和模块
- ✅ 为超级管理员、管理员、销售员分配权限

## 🚀 执行步骤

### 方法1: 使用MySQL客户端工具(推荐)

使用你的MySQL客户端工具(如Navicat、phpMyAdmin、MySQL Workbench等)连接数据库并执行:

**文件位置:**
```
/Users/imac/Desktop/webtset/TF2025/backend/database/migrations/add_supplier_payment_menu_complete.sql
```

**数据库连接信息:**
- 主机: `rm-cn-x0r3j370k0011bko.rwlb.rds.aliyuncs.com`
- 端口: `3306`
- 用户: `root`
- 密码: `Horse2024@`
- 数据库: `tf2025`

### 方法2: 使用后端项目连接

如果你无法直接使用MySQL命令,可以通过后端项目执行:

1. 创建一个临时执行脚本:

```javascript
// /backend/temp-setup-menu.js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function setupMenu() {
  const connection = await mysql.createConnection({
    host: 'rm-cn-x0r3j370k0011bko.rwlb.rds.aliyuncs.com',
    user: 'root',
    password: 'Horse2024@',
    database: 'tf2025'
  });

  const sql = fs.readFileSync(
    '/Users/imac/Desktop/webtset/TF2025/backend/database/migrations/add_supplier_payment_menu_complete.sql',
    'utf8'
  );

  const statements = sql.split(';').filter(s => s.trim());

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await connection.execute(statement);
        console.log('✅ 执行成功');
      } catch (error) {
        console.log('⚠️ 跳过:', error.message);
      }
    }
  }

  await connection.end();
  console.log('🎉 配置完成!');
}

setupMenu();
```

2. 执行脚本:
```bash
cd /Users/imac/Desktop/webtset/TF2025/backend
node temp-setup-menu.js
```

### 方法3: 手动在界面添加

如果上述方法都不可用,可以在系统管理界面手动添加:

**菜单信息:**
- **父菜单**: 选择"采购管理"或"系统管理"
- **菜单名称**: `supplier-payments` ⚠️ 必须英文,小写,横线分隔
- **菜单标题**: `供应商打款` (这是显示的中文标题)
- **URL**: `/payments`
- **图标**: `fas fa-money-bill-wave`
- **组件**: `PaymentsView`
- **排序**: `30`

**重要提示:**
- 菜单名称必须符合规则: `^[a-zA-Z][a-zA-Z0-9_-]*$`
- 建议使用: `supplier-payments`
- 如果名称不符合规则会返回 422 错误

## ✅ 验证配置

执行SQL后,系统会自动输出配置结果:

```
========================================
供应商打款功能配置完成!
========================================
模块ID: xx
菜单ID: xx
父菜单ID: xx
========================================
已创建的权限:
- supplier-payments:view (查看打款页面)
- supplier-payments:read (查看打款记录)
- supplier-payments:create (创建打款申请)
- supplier-payments:approve (审批打款申请)
- supplier-payments:confirm (确认付款完成)
- supplier-payments:cancel (取消打款申请)
- supplier-payments:export (导出打款记录)
========================================
```

## 🔍 检查是否成功

执行以下查询验证:

```sql
-- 检查菜单是否创建
SELECT * FROM menus WHERE name = 'supplier-payments';

-- 检查模块是否创建
SELECT * FROM modules WHERE `key` = 'supplier-payments';

-- 检查权限是否创建
SELECT * FROM permissions WHERE module_id = (
  SELECT id FROM modules WHERE `key` = 'supplier-payments'
);

-- 检查菜单模块关联
SELECT * FROM menu_modules WHERE menu_id = (
  SELECT id FROM menus WHERE name = 'supplier-payments'
);
```

## 🎯 使用功能

配置完成后:

1. **刷新页面或重新登录**
2. **在左侧菜单查找"供应商打款"选项**
3. **点击进入测试功能**

### 测试账号
- **管理员**: sadmin / 123456 (全部权限)
- **销售员**: 3333 / 636363 (查看和创建权限)

## ⚠️ 常见问题

### Q: 菜单不显示?
**A:** 检查以下几点:
1. 菜单的 `is_active` 是否为 1
2. 用户角色是否有菜单权限 (menu_roles 表)
3. 菜单是否关联了模块 (menu_modules 表)
4. 刷新页面或清除缓存

### Q: 点击菜单报错 404?
**A:** 检查:
1. 前端路由是否配置 (`/payments`)
2. 页面组件是否存在 (`PaymentsView.vue`)
3. 前端服务是否正常运行

### Q: 没有权限操作?
**A:** 检查:
1. role_permissions 表是否有对应记录
2. 权限代码是否正确 (supplier-payments:xxx)
3. 用户角色是否正确

## 📞 技术支持

如果遇到问题,检查后端日志:
```bash
cd /Users/imac/Desktop/webtset/TF2025/backend
tail -f logs/*.log
```

或查看前端控制台错误信息。
