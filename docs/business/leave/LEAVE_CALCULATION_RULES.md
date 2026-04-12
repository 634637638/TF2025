# 休假计算规则说明

## 规则概述

每月有固定天数的带薪休假（默认2天），支持累积规则。

## 详细规则

### 1. 基本配额
- 每月固定配额：2天带薪休假
- 休假类型：`monthly_leave`（带薪，不扣工资）
- 请假类型：`leave`（无薪，扣工资）

### 2. 累积规则

**重要原则：只要上月有请假记录，说明上月休假额度已被使用，不能累计到本月。**

**情况1：上个月没有任何请假记录**
- 上月休假额度完全未使用，剩余天数可累积到本月
- 示例1：2025年12月无请假 → 2026年1月可用 0+2=2天（上月剩余0天+本月配额2天）
- 示例2：2025年12月无请假 → 2026年1月申请2天 → 本月还可再休 0+2-2=0天

**情况2：上个月有请假记录（包括带薪休假或普通请假）**
- 上月已使用休假额度，不能累计剩余天数到本月
- 本月只有本月配额天数，不管上月休了多少天
- 示例：2025年12月休假1天 → 2026年1月可用 2天（上月无剩余，只有本月配额）

### 3. 超过部分处理
如果申请天数超过本月可用天数，超过的部分自动转为请假（无薪）：
- 可用天数 = 上月剩余 + 本月配额 - 本月已用
- 超过部分 = 申请天数 - 可用天数
- 自动创建：休假记录（可用天数）+ 请假记录（超过部分）

## 计算示例

### 场景1：上月未用满，本月正常申请
- 2025年12月：休假0天（剩余2天可累积）
- 2026年1月1日：申请休假2天
- 计算：可用 = 2(上月剩余) + 2(本月配额) - 0(已用) = 4天
- 结果：休假2天（带薪）✅

### 场景2：上月未用满，本月超额申请
- 2025年12月：休假0天（剩余2天可累积）
- 2026年1月1日：申请休假2天
- 2026年1月5-6日：申请休假2天
- 计算：
  - 第1次：可用 = 2 + 2 - 0 = 4天，申请2天 → 休假2天
  - 第2次：可用 = 2 + 2 - 2 = 2天，申请2天 → 休假2天
- 结果：总共休假4天（带薪）✅

### 场景3：上月未用满，本月超额申请（需转请假）
- 2025年12月：休假0天（剩余2天可累积）
- 2026年1月：申请休假5天
- 计算：可用 = 2 + 2 - 0 = 4天，申请5天
- 结果：休假4天（带薪）+ 请假1天（无薪）✅

### 场景4：上月已用满，本月正常申请
- 2025年12月：休假2天（已满，无剩余）
- 2026年1月：申请休假2天
- 计算：可用 = 0 + 2 - 0 = 2天
- 结果：休假2天（带薪）✅

### 场景5：上月已用满，本月超额申请（需转请假）
- 2025年12月：休假2天（已满）
- 2026年1月1日：申请休假1天
- 2026年1月5-6日：申请休假2天
- 计算：
  - 第1次：可用 = 0 + 2 - 0 = 2天，申请1天 → 休假1天
  - 第2次：可用 = 0 + 2 - 1 = 1天，申请2天 → 休假1天 + 请假1天
- 结果：休假2天 + 请假1天 ✅

### 场景6：多次申请累加
- 2026年1月1日：申请休假1天 → 休假1天（剩余1天）
- 2026年1月5日：申请休假1天 → 休假1天（剩余0天）
- 2026年1月6日：申请休假1天 → 请假1天（无薪）
- 结果：休假2天 + 请假1天 ✅

## 代码实现

### 后端计算逻辑
```javascript
// 获取上个月带薪休假使用天数
const lastMonthUsed = await getUserUsedMonthlyLeaveDays(employeeId, lastYear, lastMonth);

// 检查上个月是否有任何请假记录（包括带薪休假和普通请假）
const lastMonthHasLeave = await hasAnyLeaveRecords(employeeId, lastYear, lastMonth);

// 计算上个月剩余天数
const lastMonthRemaining = Math.max(0, monthlyLeaveDays - lastMonthUsed);

// 获取本月已使用天数
const currentMonthUsed = await getUserUsedMonthlyLeaveDays(employeeId, currentYear, currentMonth);

// 计算本月可用天数
let totalAvailableDays;
if (lastMonthHasLeave) {
  // 上个月有请假记录，本月只有配额天数，不能累计
  totalAvailableDays = monthlyLeaveDays - currentMonthUsed;
} else {
  // 上个月没有请假记录，可以累积
  totalAvailableDays = lastMonthRemaining + monthlyLeaveDays - currentMonthUsed;
}

const availableDays = Math.max(0, totalAvailableDays);
```

### 前端自动转换逻辑
```javascript
if (requestedDays > availableDays) {
  const monthlyLeaveDays = availableDays;
  const regularLeaveDays = requestedDays - availableDays;

  // 创建休假记录
  await createAttendanceRecord({
    record_type: 'monthly_leave',
    monthly_leave_days: monthlyLeaveDays
  });

  // 创建请假记录（超过部分）
  await createAttendanceRecord({
    record_type: 'leave',
    leave_type: '事假',
    leave_days: regularLeaveDays,
    leave_reason: `休假申请（超过休假天数${regularLeaveDays}天，自动转为请假）`
  });
}
```

## 重要说明

1. **累积条件**：只有上月没有任何请假记录时，上月剩余天数才能累积到本月
2. **任何请假记录**：包括带薪休假（monthly_leave）和普通请假（leave），只要有记录即视为已使用
3. **每月独立清零**：上个月没用完的天数只能累积到本月，不会跨月累积到下下个月
4. **同月多次申请**：同一个月内的多次申请会累加计算已用天数
5. **自动转换**：超过可用天数的部分会自动转换为请假，无需手动操作
6. **工资计算**：
   - 休假（monthly_leave）：不扣工资
   - 请假（leave）：扣工资（底薪 ÷ 当月工作天数 × 请假天数）

## 测试建议

1. 测试上月无请假记录的情况（可累积）
2. 测试上月有请假记录的情况（不可累积）
3. 测试同月多次申请的累加
4. 测试超过可用天数的自动转换
5. 验证工资计算是否正确
