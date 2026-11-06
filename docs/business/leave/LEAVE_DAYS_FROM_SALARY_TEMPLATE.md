# 休假天数从工资模板获取

## 功能说明

**每月带薪休假天数从员工的工资模板中获取**。未使用额度最多结转一个自然月，因此可用上限按模板动态计算为“月额度 × 2”，而不是固定 4 天。若上月有无薪请假记录，上月余额不结转到本月；本月模板额度仍有效。

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
  rest_days INT,  -- 每月带薪休假天数；考勤额度只读取员工关联模板此字段
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
| 普通员工 | 3000 | 2天，最多累计4天 |
| 主管 | 5000 | 3天，最多累计6天 |
| 经理 | 8000 | 4天，最多累计8天 |

**员工分配：**
- 员工A（普通员工模板）：每月2天带薪休假
- 员工B（主管模板）：每月3天带薪休假
- 员工C（经理模板）：每月4天带薪休假

### 场景2：计算示例

**员工B（主管模板，每月3天休假）**

```
2025年12月：月额度3天，休假2天（未用满，剩余1天）
2026年1月：可用 = 1(上月剩余) + 3(本月配额) = 4天，最高不超过6天

申请：
  1月5日：休假2天 → 剩余2天
  1月6-7日：申请2天 → 休假2天 → 剩余0天
  1月8日：申请1天 → 请假1天（超过可用天数）
```

## 工资模板前置条件

休假额度只使用员工关联工资模板中的 `rest_days`。没有有效模板时，余额接口返回 `template_bound: false`、`is_leave_disabled: true` 和 0 额度；创建、编辑和审批通过请求由后端以 HTTP 422 和 `SALARY_TEMPLATE_REQUIRED` 拒绝。查询失败会作为服务错误返回，不回退到系统设置。

模板已关联但 `rest_days` 为空时按 0 天计算；请假扣款和加班费仍从该工资模板读取各自的薪资配置。

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
│ 4天（当前模板月额度2天 × 2）             │
│                                         │
│ 上个月休假记录：                         │
│ 2025年12月：已休 2/3 天 [剩余1天可累积] │
└─────────────────────────────────────────┘
```

## 工资计算

工资结算与休假申请共用按自然月计算的额度规则。带薪休假日保留工资和提成；无薪请假日按实际请假记录扣除工资并排除当天提成。额度检查使用 `rest_days`，上月存在无薪请假时不结转上月余额：

```javascript
// salary-calculator.service.js
const template = await getEmployeeSalaryTemplate(employeeId);
const monthlyBalances = buildMonthlyLeaveBalances({ monthlyLimit: template.rest_days, monthlyUsage, startDate, endDate });
const eligiblePaidLeave = monthlyBalances.find(item => item.month === payrollMonth)?.quota ?? template.rest_days;
const unpaidLeaveDeduction = dailySalary * actualUnpaidLeaveDays;
```

## 总结

通过从工资模板获取休假天数配置：

1. **灵活性**：不同员工可以有不同的休假天数
2. **统一管理**：通过工资模板统一配置和管理
3. **一致性**：休假申请和工资计算使用相同的配置
4. **计算依据明确**：无模板时停止操作，不用默认额度掩盖缺失配置
