# 客户检索与姓名保护统一规范

## 公共入口

- 客户检索结果统一使用 `frontend/src/components/common/CustomerSearchDropdown.vue`。
- 选中客户后的姓名输入统一使用 `frontend/src/components/common/CustomerNameLockInput.vue`。
- 页面只维护客户搜索、选择、保存和清空的业务状态，不得复制锁按钮及其响应式样式。

## 交互规则

- 客户被选中后，姓名默认只读，并在输入框外侧显示锁定图标；图标通过 `title` 和 `aria-label` 说明“已锁定，双击姓名输入框可编辑”，不得显示“已锁定”文字或覆盖输入内容。
- PC 和 iPad 双击姓名输入框解锁；手机连续轻触两次解锁。
- 解锁后只显示保存/解锁图标，回车、失焦或点击图标均调用页面原有的客户更新逻辑，成功后重新锁定；图标必须保留 `title` 和 `aria-label`。
- 解锁后姓名没有变化时只重新锁定，不得发送更新请求或显示成功提示。
- 姓名锁控件保存时只提交变化后的姓名，不得顺带提交 Apple ID、邮箱等无关字段，避免历史数据校验阻断姓名修改。
- 更换客户必须点击独立的交换按钮；该操作清空当前客户关联、手机号和姓名，再重新检索选择。
- 未选择客户且进入新客户创建状态时允许输入姓名，不显示误导性的锁定状态。
- 预定交付等必须绑定既定客户的流程使用 `locked`，不得允许解锁或更换客户。

## 标准用法

```vue
<CustomerSearchDropdown
  :items="customerSearchResults"
  :visible="showCustomerSearch && !selectedCustomer"
  :keyword="form.customer_phone"
  @select="selectCustomer"
  @create="createCustomer"
/>

<CustomerNameLockInput
  ref="customerNameInputRef"
  v-model="form.customer_name"
  :selected="selectedCustomer !== null"
  :editing="customerNameEditing"
  :creating="customerCreating"
  @unlock="enableCustomerNameEdit"
  @touchend="handleCustomerNameTouchEnd"
  @input="handleCustomerNameInput"
  @blur="handleCustomerNameBlur"
  @save="saveCustomerNameEdit"
  @clear="clearSelectedCustomer"
/>
```

## 数据要求

- 手机号/关键词检索下拉统一展示前 50 条结果，由 `frontend/src/services/customer-options.ts` 中的 `CUSTOMER_SEARCH_PAGE_SIZE` 集中维护。页面和业务 API 封装不得自行写 `page_size: 20` 或其他客户检索条数。
- 检索仍然要求至少 2 个字符；50 条是单次下拉展示上限，不代表预加载全部客户。后端继续负责分页上限、权限和数据过滤。
- 完整手机号检索必须优先返回该号码的全部匹配记录，不能因为下拉页大小而把精确匹配记录静默排除。存在重复手机号时，页面必须提供可继续选择的结果或明确提示，不得显示成无结果。
- 手机号输入必须使用统一标准化规则处理空格、短横线和国家区号；前端标准化后的值与后端查询字段必须采用同一口径。
- 后端客户检索服务必须先校验 `page`、`page_size` 并限制为安全整数。MySQL 兼容实现不得直接把 `LIMIT ? OFFSET ?` 作为预处理参数；应将已校验的整数安全生成到 SQL，其他搜索条件仍必须使用绑定参数，禁止拼接用户输入。
- 客户检索接口出现 4xx、5xx 或超时，页面必须结束加载状态并显示明确错误，不得把接口故障静默转换成“暂无客户”。

- 修改姓名必须持久化到当前客户记录，成功后同步当前页面的已选客户对象。
- 更换客户后必须更新业务单据中的 `customer_id`，不能只替换页面显示的姓名和手机号。
- 清空后重新选择客户时，应恢复默认锁定状态并关闭旧搜索结果。
- 姓名与手机号继续使用项目统一的输入标准化函数，禁止绕过校验直接提交。

## 禁止事项

- 禁止在页面新增 `.customer-lock-button` 或 `.customer-name-group` 锁控件实现。
- 禁止点击锁标识直接清空客户；锁定状态与更换客户是两个不同动作。
- 禁止把锁图标放进姓名输入框后缀导致文字被遮挡。
- 禁止在不同页面自行定义锁控件尺寸、颜色和手机布局。

## 审计

运行：

```bash
cd frontend
npm run check:ui
```

审计会检查客户下拉与姓名锁定组件是否成套接入，并阻止旧私有锁控件重新出现。

最后更新：2026-10-04

## 云端故障记录

2026-10-04 云端批发、划拨、销售和快速出库的客户手机号检索出现“搜索中后空白”。后端日志确认 `/sales/customers` 调用公共服务时在 `customer-search.service.js` 的分页查询触发：

```text
ER_WRONG_ARGUMENTS: Incorrect arguments to mysqld_stmt_execute
```

原因是云端 MySQL 对预处理语句中的 `LIMIT ? OFFSET ?` 参数兼容性异常。修复方式为：`page_size` 和 `offset` 经过整数校验后内联到 SQL，关键词、状态和字段值继续使用绑定参数。修复文件为 `backend/src/services/customer-search.service.js`。

验证记录：当前云端数据库只读检索返回 `total=565`、首批 `50` 条，语法检查通过。部署后必须重启后端，并分别在销售、批发、划拨、综合查询快速出库中验证手机号检索；若仍显示空白，应检查 `/api/sales/customers` 的 HTTP 状态码和响应体。
