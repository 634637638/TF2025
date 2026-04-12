# 休假天数从工资模板获取

## 功能说明

**每月带薪休假天数现在从员工的工资模板中获取**，而不是使用全局统一的系统设置。

## 修改内容

### 修改前（全局统一设置）

```javascript
// 从系统设置获取，所有员工统一
const monthlyLeaveDays = await SystemSettingsService.getMonthlyLeaveDays();
```

**问题**：所有员工使用相同的休假天数，无法灵活配置。

### 修改后（从工资模板获取）

```javascript
// attendance.service.js
async getEmployeeMonthlyLeaveDays(employeeId) {
  // 从员工的工资模板中获取休假天数
  const query = `
    SELECT st.rest_days
    FROM users u
    INNER JOIN salary_templates st ON u.salary_template_id = st.id
    WHERE u.id = ?
  `;
  // ... 查询逻辑
}
```

**优势**：
- ✅ 每个员工可以有不同的休假天数配置
- ✅ 通过工资模板统一管理
- ✅ 灵活适应不同员工群体的需求

## 数据结构

### salary_templates 表

```sql
CREATE TABLE salary_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  base_salary DECIMAL(10, 2),
  rest_days INT DEFAULT 2,  -- 每月带薪休假天数
  -- 其他字段...
);
```

### users 表

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  salary_template_id INT,  -- 关联工资模板
  -- 其他字段...
  FOREIGN KEY (salary_template_id) REFERENCES salary_templates(id)
);
```

## 使用场景

### 场景1：不同岗位不同休假天数

**工资模板配置：**

| 模板名称 | 底薪 | 休假天数 |
|----------|------|----------|
| 普通员工 | 3000 | 2天 |
| 主管 | 5000 | 3天 |
| 经理 | 8000 | 4天 |

**员工分配：**
- 员工A（普通员工模板）：每月2天带薪休假
- 员工B（主管模板）：每月3天带薪休假
- 员工C（经理模板）：每月4天带薪休假

### 场景2：计算示例

**员工B（主管模板，每月3天休假）**

```
2025年12月：休假2天（未用满，剩余1天）
2026年1月：可用 = 1(上月剩余) + 3(本月配额) = 4天

申请：
  1月5日：休假2天 → 剩余2天
  1月6-7日：申请2天 → 休假2天 → 剩余0天
  1月8日：申请1天 → 请假1天（超过可用天数）
```

## 容错机制

代码实现了多层容错：

```javascript
async getEmployeeMonthlyLeaveDays(employeeId) {
  try {
    // 1. 优先从员工工资模板获取
    const result = await db.execute(query, [employeeId]);
    if (result && result[0]?.rest_days) {
      return result[0].rest_days;
    }

    // 2. 如果员工没有工资模板，使用系统默认值
    return await SystemSettingsService.getMonthlyLeaveDays();
  } catch (error) {
    // 3. 如果查询出错，使用系统默认值
    return await SystemSettingsService.getMonthlyLeaveDays();
  }
}
```

### 容错场景

| 场景 | 处理方式 |
|------|----------|
| 员工有工资模板，配置了休假天数 | 使用工资模板的配置 ✅ |
| 员工有工资模板，但未配置休假天数 | 使用系统默认值（2天） |
| 员工没有分配工资模板 | 使用系统默认值（2天） |
| 数据库查询出错 | 使用系统默认值（2天） |

## 工资模板管理

### 修改工资模板的休假天数

在后台 **工资模板管理** 页面：

1. 找到对应的工资模板
2. 编辑 `rest_days` 字段
3. 保存后，所有使用该模板的员工自动生效

### 示例SQL

```sql
-- 修改"主管"模板的休假天数为4天
UPDATE salary_templates
SET rest_days = 4
WHERE name = '主管';

-- 查看所有模板的休假天数配置
SELECT id, name, rest_days
FROM salary_templates
ORDER BY rest_days DESC;
```

## 前端显示

休假申请页面会显示：

```
┌─────────────────────────────────────────┐
│ 休假说明                                │
├─────────────────────────────────────────┤
│ 上月剩余1天可累积到本月，本月最多可用   │
│ 4天（来自工资模板配置）                 │
│                                         │
│ 上个月休假记录：                         │
│ 2025年12月：已休 2/3 天 [剩余1天可累积] │
└─────────────────────────────────────────┘
```

## 工资计算

工资计算时也会使用相同的 `rest_days` 配置：

```javascript
// salary-calculator.service.js
const template = await getEmployeeSalaryTemplate(employeeId);
const restDays = template.rest_days; // 与休假申请使用相同的配置

// 计算请假扣款
if (leaveDays <= restDays) {
  // 在休假天数内，不扣款
  deduction = 0;
} else {
  // 超过休假天数，扣款
  deduction = dailySalary * (leaveDays - restDays);
}
```

## 总结

通过从工资模板获取休假天数配置：

1. **灵活性**：不同员工可以有不同的休假天数
2. **统一管理**：通过工资模板统一配置和管理
3. **一致性**：休假申请和工资计算使用相同的配置
4. **容错性**：多层容错机制确保系统稳定运行
