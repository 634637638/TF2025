# 客户检索与姓名保护统一规范

## 公共入口

- 客户检索结果统一使用 `frontend/src/components/common/CustomerSearchDropdown.vue`。
- 选中客户后的姓名输入统一使用 `frontend/src/components/common/CustomerNameLockInput.vue`。
- 页面只维护客户搜索、选择、保存和清空的业务状态，不得复制锁按钮及其响应式样式。

## 交互规则

- 客户被选中后，姓名默认只读，并在输入框外侧显示“已锁定”。锁标识不得覆盖输入内容。
- PC 和 iPad 双击姓名输入框解锁；手机连续轻触两次解锁。
- 解锁后显示“保存”，回车、失焦或点击保存均调用页面原有的客户更新逻辑，成功后重新锁定。
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

最后更新：2026-09-17
