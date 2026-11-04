# 综合查询模态框组件使用指南

## 概述

本文档介绍了综合查询页面使用的三个模态框组件，这些组件基于 `MobileDialog` 封装，提供了统一的UI风格和响应式体验。

## 手机端详情入口

综合查询在手机和平板（视口宽度不超过 `1024px`）上，连续轻触同一行两次打开 `QueryDetailDialog`。识别由全局 `v-table-double-tap` 负责，复用现有 `openDetailModal`，不依赖浏览器生成的兼容点击事件。滑动、长按、按钮及表单操作不会触发行详情；电脑端状态单元格双击查看销售单等行为保持原逻辑。

手势规则和适用范围统一维护于[后台卡片与表格统一规范](../frontend/admin-table-standards.md#手机端双击详情)，本指南不另设私有计时方案。

## 组件列表

### 1. QueryEditModal - 编辑模态框

用于编辑设备的基本信息、供应商、店铺、价格等。

**文件位置：** `frontend/src/components/query/QueryEditModal.vue`

#### 编辑与快速出库的共享布局

`QueryEditModal` 和 `QuickSaleModal` 共用 `frontend/src/styles/components/_query-modal.scss` 中的表单布局类，避免两套弹窗分别维护网格和区块样式：

- `tf-query-modal-section`、`tf-query-modal-section-title`：统一信息分区、标题和间距。
- `tf-query-modal-row`：默认两列；`tf-query-modal-row--3`、`tf-query-modal-row--4` 分别用于三列和四列字段组。
- PC 端四字段组在视口宽度不超过 1200px 时收为两列；手机端所有字段组统一两列。
- `tf-query-modal-span-2` 用于手机端跨两列的字段；日期控件填满所在字段列，不使用固定宽度。
- 快速出库设备信息按三行展示：第一行供应商/店铺/成色/状态，第二行品牌/型号/颜色/内存，第三行序列号/IMEI/入库价格/销售或批发价格；划拨状态隐藏两个价格字段。手机端入库员和销售员并排，客户手机和姓名并排，Apple ID占整行。
- 快速出库手机端的序列号和 IMEI 输入框必须使用同一外层结构，并复用入库页面的 `OptimizedScanner`；扫码按钮只在移动端显示，扫码或手动输入成功后回填对应字段并清除该字段校验提示。
- 快速出库扫码必须通过 `phone.brand` 传入当前品牌名称，复用[设备扫码规则](../business/inventory/DEVICE_SCANNING_RULES.md)识别 Apple 包装多出的 `S` 字段标识；不能在表单回填或手动输入时直接删除真实序列号首字母。
- 快速出库支持销售、批发/调货、划拨三种交易类型；交易类型决定设备状态、销售记录类型和 `XS/PF/HB` 单号后缀。销售需要支付方式，批发/调货填写批发价格，划拨不填写金额。该字段统一称为“成色”。

新增或调整这两个弹窗的表单布局时，优先使用上述公共类；业务组件只保留特有的检索下拉、利润提示等交互样式。

#### 日期与单据号联动

综合查询编辑销售日期后，关联销售记录按新业务日期和当前交易类型重新生成单据号；同日格式变化、只改时分秒或只改其他信息不重复换号。需要新号时优先补目标日期/类型的最小空号，原日期空号供后续新增使用，其他现有单据不重排；实际台数按记录统计。日期、单号、修改时间及关联记录的规则统一遵守[销售与调货事务标准](../guides/sales-transfer-transaction-standards.md#综合查询编辑日期)，前端不自行拼接或计算单号。

#### 使用示例

```vue
<template>
  <div>
    <el-button @click="openEditModal">编辑设备</el-button>

    <QueryEditModal
      v-model="showEditModal"
      :edit-item="currentEditItem"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'

const showEditModal = ref(false)
const currentEditItem = ref(null)

const openEditModal = (item) => {
  currentEditItem.value = item
  showEditModal.value = true
}

const handleEditSuccess = () => {
  // 重新加载数据
  loadData()
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |
| editItem | Object | null | 要编辑的设备信息对象 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 编辑成功时触发 | - |

---

### 2. QuickSaleModal - 快速出库模态框

用于快速创建销售出库记录，跳过入库流程。

**文件位置：** `frontend/src/components/query/QuickSaleModal.vue`

#### 使用示例

```vue
<template>
  <div>
    <el-button
      type="warning"
      @click="showQuickSaleModal = true"
    >
      <i class="fas fa-bolt"></i>
      快速出库
    </el-button>

    <QuickSaleModal
      v-model="showQuickSaleModal"
      @success="handleQuickSaleSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'

const showQuickSaleModal = ref(false)

const handleQuickSaleSuccess = () => {
  // 重新加载数据
  loadData()
  ElMessage.success('快速出库成功')
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 快速出库成功时触发 | - |

#### 功能特点

- ✅ 自动计算利润和利润率
- ✅ 支持扫码识别IMEI和序列号（预留接口）
- ✅ 完整的表单验证
- ✅ 自动设置当前用户为销售员
- ✅ 响应式设计，移动端友好

---

### 3. ReturnStockModal - 退库模态框

用于将已售设备退回库存。

**文件位置：** `frontend/src/components/query/ReturnStockModal.vue`

#### 使用示例

```vue
<template>
  <div>
    <el-button
      type="secondary"
      @click="openReturnModal(item)"
    >
      <i class="fas fa-undo-alt"></i>
      退库
    </el-button>

    <ReturnStockModal
      v-model="showReturnModal"
      :device-info="currentReturnDevice"
      @success="handleReturnSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'

const showReturnModal = ref(false)
const currentReturnDevice = ref(null)

const openReturnModal = (item) => {
  currentReturnDevice.value = item.基本信息
  showReturnModal.value = true
}

const handleReturnSuccess = () => {
  // 重新加载数据
  loadData()
  ElMessage.success('退库成功')
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |
| deviceInfo | Object | null | 要退库的设备信息对象 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 退库成功时触发 | - |

---

## 集成到 QueryView.vue

在综合查询页面中使用这些组件：

```vue
<template>
  <div class="query-view">
    <!-- 页面头部按钮 -->
    <el-button
      native-type="button"
      @click="showQuickSaleModal = true"
      class="btn btn-warning"
      v-permission="'inventory_inventoryview:create'"
    >
      <i class="fas fa-bolt"></i>
      快速出库
    </el-button>

    <!-- 表格操作列 -->
    <td class="actions-cell">
      <el-button
        native-type="button"
        @click="openEditModal(item)"
        v-permission="'query_queryview:edit'"
      >
        <i class="fas fa-edit"></i>
        编辑
      </el-button>
      <el-button
        native-type="button"
        @click="openReturnModal(item)"
        v-permission="'query_queryview:create'"
      >
        <i class="fas fa-undo-alt"></i>
        退库
      </el-button>
    </td>

    <!-- 模态框组件 -->
    <QueryEditModal
      v-model="showEditModal"
      :edit-item="currentEditItem"
      @success="loadData"
    />

    <QuickSaleModal
      v-model="showQuickSaleModal"
      @success="loadData"
    />

    <ReturnStockModal
      v-model="showReturnModal"
      :device-info="currentReturnDevice"
      @success="loadData"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'

// 模态框状态
const showEditModal = ref(false)
const showQuickSaleModal = ref(false)
const showReturnModal = ref(false)

// 当前操作的数据
const currentEditItem = ref(null)
const currentReturnDevice = ref(null)

// 打开编辑模态框
const openEditModal = (item) => {
  currentEditItem.value = item
  showEditModal.value = true
}

// 打开退库模态框
const openReturnModal = (item) => {
  currentReturnDevice.value = item.基本信息
  showReturnModal.value = true
}

// 加载数据
const loadData = () => {
  // 重新加载查询数据
}
</script>
```

---

## 样式定制

所有组件都支持通过 CSS 变量进行样式定制：

```scss
:root {
  // 主题色
  --el-color-primary: #1890ff;

  // 边框颜色
  --el-border-color: #dcdfe6;
  --el-border-color-light: #e4e7ed;

  // 文字颜色
  --el-text-color-primary: #303133;
  --el-text-color-regular: #606266;

  // 圆角
  --el-border-radius-base: 4px;
}
```

---

## API 接口说明

### QueryEditModal 使用的接口

- `PUT /inventory/:id` - 更新设备信息

### QuickSaleModal 使用的接口

- `POST /quick-sale` - 快速出库

### ReturnStockModal 使用的接口

- `POST /inventory/return-to-stock` - 退库操作

---

## 权限控制

| 组件 | 所需权限 |
|------|----------|
| QueryEditModal | query_queryview:edit |
| QuickSaleModal | inventory_inventoryview:create |
| ReturnStockModal | query_queryview:create |

---

## 移动端适配

所有组件都内置了移动端适配：

- 自动检测屏幕尺寸
- 移动端单列布局
- 触摸友好的按钮大小
- 优化的字体和间距

---

## 注意事项

1. **数据格式**：确保传入的 `editItem` 和 `deviceInfo` 对象格式正确
2. **权限检查**：在使用前确保用户具有相应的权限
3. **错误处理**：组件已内置错误处理，无需额外处理
4. **数据刷新**：监听 `@success` 事件后刷新列表数据

---

## 常见问题

### Q: 如何自定义模态框宽度？

A: 可以通过修改组件中的 `width` 和 `max-width` props：

```vue
<QueryEditModal
  v-model="showEditModal"
  :edit-item="currentEditItem"
  width="95%"
  max-width="1000px"
  @success="handleSuccess"
/>
```

### Q: 如何禁用移动端全屏？

A: 设置 `:force-fullscreen="false"`：

```vue
<QueryEditModal
  v-model="showEditModal"
  :edit-item="currentEditItem"
  :force-fullscreen="false"
  @success="handleSuccess"
/>
```

### Q: 如何添加自定义字段？

A: 在对应组件的模板和表单数据中添加字段即可。
