# TF2025 表单控件统一规范

## 目标和适用范围

本规范适用于后台管理页面、后台弹窗、搜索区域和 H5 管理表单中的输入、下拉、日期及相关表单控件。

统一目标不是把所有控件强行做成同一种视觉，而是让相同语义的控件拥有同一个实现入口、校验行为、禁用态、错误态和移动端尺寸。页面只负责字段、选项和业务事件，不再复制基础控件的外壳样式。

## 标准入口

| 控件语义 | 首选实现 | 说明 |
| --- | --- | --- |
| 单行文本、手机号、邮箱、密码、数字 | `el-input` / `el-input-number` | 统一清除、禁用、错误和尺寸 |
| 金额、价格、成本、利润 | `AmountInput`；只读金额展示可保留 `el-input`，值复用 `formatAmount` | 禁止上下增减按钮；输入和展示最多保留 2 位小数并移除无意义尾随零 |
| 单选下拉、级联选项 | `el-select` / `el-cascader` | 统一键盘操作、空值和移动端宽度 |
| 单日期、月份、日期时间 | `el-date-picker` | 日期格式必须与《全局时间工具与日期格式》一致 |
| 日期范围 | `DateRangePicker` | 列表筛选不得直接复制日期范围布局 |
| 省市县乡村选择 | `CitySelector` | 组件内部必须遵守本规范；页面不得再实现一套地区下拉 |
| 复选、单选、开关 | `el-checkbox` / `el-radio` / `el-switch` | 原生控件只允许用于专用输入场景 |
| 表格内排序值 | `el-input-number` | 使用 `controls="false"` 保留紧凑单元格；范围和变更提交沿用字段业务规则 |
| 文件、颜色、扫码和拖动输入 | 原生 `input` | 浏览器能力或第三方库要求时允许保留 |

数字输入和文本域的公共视觉与尺寸由 `frontend/src/styles/components/_form-controls.scss` 统一维护；输入内容约束按下方“输入内容与脏数据防护”执行，样式不能替代校验。

Element Plus 的 `el-select`、`el-date-picker`、`el-input`、`el-input-number`、`el-cascader` 和 `el-time-picker` 自带内部输入框边框。即使历史组件需要传递 `.form-control` 以保持宽度，也只能由公共 `_form-controls.scss` 清除控件根节点的外层边框，最终保留一层内部边框；页面不得再次给这些组件添加外层边框。

权限管理的模块管理页已移除五处下拉框的旧 `form-control` 及其重复外框、内边距和聚焦样式；添加模块的分类、图标与页面筛选共用全局选择框外观，`module-standard-select` 只维护布局宽度。

## 手机表单字段布局

新增或修改的后台表单默认遵循“短字段每行两个，长字段每行一个”，手机范围为 `<=767px`。按字段内容和实际可用空间选择列数，不能为凑两列缩小公共控件、裁掉标签或隐藏错误。

- 姓名、电话、短分类、等级、性别、日期、积分等短字段默认两列；手机标签置顶，复用 `useMobile`、`label-position="top"` 和 `.tf-dialog-form.tf-dialog-form--stacked`。
- 邮箱、身份证、Apple ID、密码、详细地址、备注、上传及复杂组合控件等长字段手机整行。短字段出现长标签、长选项或复杂操作时也应整行；输入值可正常编辑滚动，不能截短模型值来适配。
- 地区作为整行组合控件使用公共 `CitySelector`，内部手机省/市、县区/乡镇分别两列，村委会/社区及版本提示整行；权限隐藏后短字段补位，落单字段铺满。详细地址仍整行，不能在页面另写地区网格。
- 布局唯一入口为 `frontend/src/styles/components/_dialog.scss`：表单接入 `.tf-form-layout`，直排短字段表单增加 `.tf-form-grid`，已有分组继续使用 `.tf-form-row`；直排长字段标记 `.tf-form-field--wide`，或放在行外，整组也可使用 `.tf-form-row--mobile-single`。桌面确需三列时使用 `.tf-form-row--three`，手机自动回到两列，末尾单项铺满。
- 同一入口支持原生 `form` 的 `.form-group` 及弹窗外显式接入的表单，不要求必须是 `el-form-item` 或位于 `MobileDialog`。销售结算、导航原生表单和模板头部继续沿用原提交及字段绑定；页面不得用私有手机单列规则覆盖公共行组。`MobileForm` 的短控件使用公共网格，文本域、密码、上传和复杂插槽按长字段整行。
- `v-if` 挂在实际字段上，权限隐藏后同组剩余字段自然补位，单字段铺满；`disabled`、字段权限、绑定和校验逻辑不因布局迁移改变。不要用空字段占位。
- 间距读取 `--tf-space-*`；控件宽度随网格收缩，错误文案换行并占据正常文档流，不能压住下一行。开关、单选和复选仍保留公共控件外观。
- 新页面和本次触及的存量表单必须接入；其他存量页面按改动范围逐步迁移，不代表仅更新公共样式就完成全站适配。只读详情的字段密度见[弹窗规范](dialog-standards.md#表单和正文)。

用户明确要求短标签与单个短控件（数量或下拉选择）同行时，可在已有 `.tf-form-layout` 内的 `el-form-item` 显式添加 `.tf-form-field--inline`。公共 `_dialog.scss` 负责标签与控件同行、垂直居中及控件自适应剩余宽度，手机端也保留同行；不要在页面新增私有覆盖，不将此例外推广到默认置顶的其他字段。当前用于手机关联商品退货的“退回数量”和独立商品收银的“出库方式”“数量”“销售价”“现金收取”“找零”，验收须核对标签和控件不重叠、错误换行及手机边界；下拉框所在列须预留标签与选项的共同宽度。

接入片段（位于已有表单中，`isMobile` 来自公共 `useMobile`）：

```vue
<el-form
  :model="form"
  class="tf-form-layout"
  :label-position="isMobile ? 'top' : 'right'"
  :class="{ 'tf-dialog-form': isMobile, 'tf-dialog-form--stacked': isMobile }"
>
  <div class="tf-form-row">
    <el-form-item v-if="canViewField('name')" label="姓名">
      <el-input v-model="form.name" :disabled="!canEditField('name')" />
    </el-form-item>
    <el-form-item v-if="canViewField('phone')" label="电话">
      <el-input v-model="form.phone" :disabled="!canEditField('phone')" />
    </el-form-item>
  </div>
  <el-form-item v-if="canViewField('remarks')" label="备注">
    <el-input v-model="form.remarks" type="textarea" class="tf-textarea" :rows="2" />
  </el-form-item>
</el-form>
```

客户新增/编辑及国补编辑已使用该公共行布局。验收须覆盖 375/430px、767/768px 相邻断点及桌面，分别检查长内容、字段权限隐藏、禁用、错误换行与正文滚动，静态审计不能替代浏览器检查。

库存编辑复用 `.tf-form-row--three` 保留桌面三列，手机由公共入口收敛为两列；序列号与 IMEI 使用公共两列行组，备注跨列使用 `1 / -1`，不能用固定 `span 3` 在手机网格中生成额外列。手机状态移至编码下方，与入库价格按左/右两列同行，备注隐藏时也保留这组配对；顶部序列号与入库价格卡片同样两列，长序列号在卡片内完整换行。正式回归 `npm --prefix frontend run test:input-flows -- --inventory-edit` 加载真实组件及库存路由样式，覆盖320/375/430/767/768/1024/1440px明暗主题、完整及隐藏字段、只读和长内容边界；不访问业务接口，不替代物理设备验收。

查看详情的旧分区容器接入 `.tf-detail-grid`，普通字段两列，地址、备注等长字段标记 `.tf-detail-field--wide`；公共 `RecordDetailDialog` 使用等价的 `wide` 字段属性。布局仅在手机断点调整，桌面原有分区和列数保留。描述列表统一使用 `RecordDescriptions`：手机两列且标签置顶，桌面保留调用方列数与方向；长字段 `span=2`，公共组件会补齐前一行短字段，避免 Element Plus 将长字段截到半行。不靠省略内容或缩小字号凑列数。所有网格子项须 `min-width:0` 且长值可换行，不能溢出弹窗。

多选下拉使用公共最小高度，有标签时由 `_form-controls.scss` 的 `.el-select__wrapper:has(.el-select__selection .el-tag)` 允许内容自然撑高；不能固定高度后任标签溢出遮挡上下字段。大量选择优先使用 `collapse-tags`，需要核对完整内容时使用独立可滚动清单，不能展开全部标签覆盖其他设置。积分设置回归 `node frontend/scripts/test-customer-points-settings.mjs` 覆盖8类型/30商品长标签及320/375/430/767/768/1440px明暗主题的实际边界和保存。

## 输入内容与脏数据防护

本节规定新建、修改字段及公共校验工具整改时的验收要求，适用于后台、H5、弹窗、表格编辑、扫码及导入入口。2026-11-13 已修复公共必填、完整数字格式、手机号及金额原文校验，并补 H5/客户资料调用链；全站业务和真机未验范围统一登记在[技术债务台账 T23](../development/TECHNICAL_DEBT_PROGRESS.md#t23-输入内容校验统一)。文档补齐不代表全站已经拦截非法输入。

### 字段契约

字段必须先明确语义、提交类型、是否必填、空值形式、长度或范围、精度和允许的标准化方式，再选择控件。沿用唯一共享业务类型与现有 API 契约，不为校验另建一套字段定义；新增或调整契约同步前后端、导入和测试。

| 字段语义 | 内容约束 |
| --- | --- |
| 数量、天数、排序及积分 | 按业务确定是否允许零、负数、小数及上下限；整数须为安全整数。不可仅凭控件名称推断全部数量都必须大于零 |
| 金额、价格、成本及利润 | 使用 `AmountInput`；提交为有限数，最多两位小数，范围与正负号由业务定义。负利润、退款等合法场景不得被全局非负规则误伤 |
| 手机号、IMEI、SN、条码及业务编码 | 按字符串校验字符集和长度，保留前导零；IMEI 与 SN 分开处理，SN/型号可以包含英文，不能一律转成数字 |
| 姓名、名称、地址及备注 | 明确长度、空白及换行规则；普通文本允许字段合法的中文、英文和标点，不全局套用“仅中文”或“删除所有特殊字符” |
| 邮箱、Apple ID、URL 及密码 | 复用各自专项规则，不套用姓名或数字过滤；密码不得自动去空格、改大小写或截断。URL 协议限制按安全规范处理 |

数字与金额的普通十进制输入不得接受 `12abc`、`12元`、`1e3`、`0x10`、`NaN`、`Infinity` 或多个小数点。科学计数法只有在专项业务契约明确允许并有前后端测试时才能使用。先检查完整字符串格式及类型，再做数值转换；禁止用 `parseFloat`、`parseInt` 的部分解析或只用 `Number(value)` 判定输入合法。数值型 JSON 只能校验实际数值的有限性、范围及精度，原始输入写法须在前端或字符串契约边界校验。

必填文本按字段允许的空白规则判断有效内容，纯空格不能通过；数字 `0` 与布尔 `false` 是否合法由字段契约决定，不得用真假值代替必填判断。缺省、`null`、空字符串和清空后的提交语义必须一致；可选空值不得静默变成 `0`，错误输入也不得转换为默认值后提交。

商品收银编码输入沿用公共 `v-identifier-input="'serial-text'"` 阻止汉字，识别前由 `isValidProductCode` 校验1–100位可打印ASCII及非空内容；条码保留大小写、符号和前导零，不能先转成数字或大写。手机相机复用 `OptimizedScanner` 的 `serialProfile=product`，其解析器与手动录入使用同一校验；不套用手机包装SN前缀处理，也不截断超长条码。配件SN仍单独按原规则大写核对，普通商品名称/类型检索继续允许中文。正式回归见 `accessory-scan.spec.ts`、`sales-goods-checkout.spec.ts`；实际相机与扫码枪另验。

### 标准化与拒绝边界

- 标准化只处理契约明示且不改变含义的格式，例如手机号约定的空格、短横线和国家区号；规则须与[客户检索规范](customer-search-standard.md#数据要求)一致。全角数字、大小写及首尾空格是否转换也必须明确，不能各页面自行决定。
- 未获允许的字符应触发字段错误或明确阻止提交，不能删除字符后把另一份值当作合法输入。例如 `12abc` 不得变成金额 `12`，超长手机号不得截成另一号码，错误内容不得仅因删掉汉字就通过校验。
- 金额合法小数输入超过两位时，公共组件沿用已登记的两位归一化行为；接口独立校验提交值的精度，不依赖页面已经舍入。金额计算按业务分币规则处理，展示格式化不替代金额合法性校验。
- 普通文本禁止字段未允许的控制字符，单行字段不接受换行；多行备注按契约允许换行。不能把所有 Unicode 字符、姓名间隔符、英文型号或合法标点统一视为脏数据。
- 搜索关键词与保存字段分别定义门槛；手机号部分检索、扫码输入和导入不得借用宽松规则直接创建正式记录。

手机号录入不得使用11位 `maxlength` 硬截断；12位号码必须保留原文并校验失败，不能被浏览器裁成另一个合法号码。入库、编辑的IMEI/SN同样不在有效编码长度处截短。普通名称、备注及联系方式的较大文本上限仍遵守各字段契约。本约束由表单审计的手机号模板检查及真实弹窗浏览器回归共同防回退，审计并非所有输入语义的穷举证明。

### 输入、提交与后端兜底

设备编码共用 `backend/src/config/input-validation.json` 的 `imei` / `phoneSerial`，前端唯一工具为 `utils/device-identifier.ts`，后端复用 `utils/imei.js`。标准 IMEI 为完整15位数字；手机 SN 为4–50位字母、数字、斜杠或连字符，分隔符须位于编码片段之间，保留前导零并转大写。无 IMEI 设备使用同一个合法 SN 作为 IMEI。入库、综合查询编辑、快速出库和导入不再删除非法字符或截短后提交；配件 SN 继续按其独立业务档位校验。编码文本框统一接入全局 `v-identifier-input`：键入、粘贴、拖放及中文输入法提交时主动阻止不符合字符集的内容，且不通过删除字符将错误值改造成合法值；规则仍在提交及服务端复核。扫码保留明确标签提取和 Apple 前缀选项，IMEI 扫码额外校验校验位，不能从超长或混入字符的字段提取有效前缀。手输与历史接口保持原有格式校验，不因本次统一新增 IMEI 校验位门槛。

1. 输入阶段复用 Element Plus、`AmountInput` 和公共标准化工具，保留小数点、负号等合法编辑中间态。`inputmode`、`type`、`min/max` 及 `maxlength` 只改善输入体验，不能充当完整验证。
2. 中文输入法组合输入期间不清洗、不截断正在组合的文字，也不重复提示；组合完成后统一处理。键盘、粘贴、拖入、自动填充、扫码和程序回填须遵守相同字段契约，不能只拦截 `keydown`。
3. 提交前通过 `useForm` / `ValidationRules` 和 Element Plus 表单校验，非法内容阻止请求，错误展示复用 `el-form-item` 与公共通知。不为同一错误同时堆叠字段提示、通知和二次确认；取消或关闭沿用[对话框规范](dialog-standards.md)，不新增未保存确认。
4. 服务端在请求校验/业务服务边界再次验证类型、完整格式、有限性、范围及精度；拒绝对象、数组、布尔等伪装数值的输入，不依赖隐式类型转换。校验失败通过现有错误响应返回明确字段原因，不写入业务数据、不触发积分、库存、收款或缓存副作用。
5. 字段合法不代表拥有写入权限。继续按“用户 → 角色 → 权限”、字段和资源范围统一鉴权，数据库 SQL 使用参数绑定。服务端职责见[API 规范](../guides/api-standards.md#上传下载与表单)。

Excel 导入同样在查询及业务写入前检查设备、姓名、手机号、基础资料文本和金额；手机数值单元格仅在安全整数且符合完整字段格式时转换，SN 必须用文本单元格保存，不能恢复 Excel 已丢失的前导零。金额允许完整非负两位小数，保留显式零；合并空金额保持旧值，覆盖空金额清空，新建空金额存 `null`。完全替换必须先预检整份文件，再进入清空事务。分析失败只返回行号与受控字段原因，不回显单元格原值；详细导入契约见[智能导入](../数据优化/智能导入功能说明.md#输入校验与空值)。

### 服务端业务解析入口

`validation.js` 的 `parseInput` 与 HTTP 校验中间件共用规则；只解析声明且实际提交的字段，保留未知字段供既有字段权限检查使用，缺省不制造更新值。可选 ID 的 `null` 保留；实际提交的状态、排序、阈值及必填金额不接受空值。失败抛出受控 `400 / VALIDATION_ERROR`，不能将对象、数组、布尔、科学计数、十六进制或带单位的字符串转成合法数字。

| 业务域 | 唯一解析入口与契约 |
| --- | --- |
| 品牌、型号、颜色、内存、门店、供应商 | `backend/src/utils/reference-options.js` 的 `parseReferenceInput/Id/Order`；名称单行1–100字、状态0/1、排序为0至2147483647整数；排序整份预检，缺项或重复ID不得先更新部分记录。地址、电话及备注仍按各业务字段声明 |
| 员工与用户 | `backend/src/utils/account-input.js`；用户名/姓名最多50字，姓名复用公共文字规则，手机号/邮箱共用公共校验；密码不转义、不裁剪或去空格。用户管理保留空姓名回退用户名、空密码不更新、关联编号0表示未分配的既有契约；员工角色数组复用 `normalizeRoleIds` |
| 维修 | `backend/src/utils/repair-input.js`；费用为非负两位金额；型号100字、故障/备注1000字。现场维修和历史设备编码只按100字单行文本约束，不套用库存IMEI/SN完整格式；当前录入框仍主动阻止汉字，不改写已载入的历史值 |
| 租赁 | `backend/src/utils/rental-input.js`；金额非负且最多两位、买断期数1–12、关联ID完整正整数、监管锁使用明确布尔值；还款及归还复用同一规则。前端先校验全部待提交合同，再保存客户；空成本不提交、显式零成本保留 |
| 国补与销售设备编辑 | 复用 `subsidy-input.js` / `device-identifier.ts`，IMEI/SN非法内容不删除或截短；只校验实际有权提交的字段，隐藏历史值不阻止其他字段修改 |
| 价目手工与Excel | `backend/src/utils/price-input.js`；金额非负两位、库存数量非负整数、状态0/1、品牌/型号必填且最多100字。Excel显式允许完整千分组 `1,234.50`，不删除百分号、单位或混输字符；按原逐行汇总机制拒绝非法行，不调用该行upsert |
| 菜单、角色、预警、待办、系统配置 | 写服务复用 `parseInput`；菜单导入整份预检后才写，布尔启停不得把字符串 `false` 当作开启。库存阈值0–100整数，待办星期1–7；系统配置按声明的number/boolean/json/string验证，批量配置先整份预检 |
| 批发及代划拨 | `backend/src/utils/transfer-input.js` 复用公共ID、姓名、手机号和两位金额规则；先预检请求及逐台价格，全部无效时不创建客户或租借连接。混合结果沿用逐台成功/失败及保存点回滚；划拨仍保持零成本与零价格 |
| 退库编辑、考勤与分享 | 退库金额复用 `isMoneyInput`，销售员关联ID/姓名与备注复用公共解析；管理员考勤员工ID禁止部分解析，普通员工仍强制自身；分享置顶由服务校验明确布尔值，不把字符串 `false` 当作开启 |
| H5购物车 | `backend/src/utils/shop-cart.js` 的 `parseCartItemInput` 供控制器与服务共用，设备/条目ID完整正整数，单台设备数量仅允许1；对象、布尔和科学计数字符串不能经强转写入 |
| 共同结算与售后公共数字边界 | 复用 `input-values.js` 的完整整数/金额判断，不另写允许尾随换行的数字正则；`sale-input.js` 保留原ID/金额上限及数值运算的分币浮点容差，商品数量/积分/售后资金沿用各自范围，不改原单快照、摘要、事务或积分分配规则 |

正式接口回归为 `backend/test/reference-input.check.js`、`business-input.check.js`、`admin-input.check.js`、`transfer-input.check.js`、`sale-input.check.js` 及既有各业务测试；均随后端 `npm test` 执行。设备编辑浏览器入口为 `npm --prefix frontend run test:input-flows -- --device-inputs`，追加 `--ios` 运行Xcode模拟器，接口与通知使用内存替身，不能冒充云端保存或物理设备验收。

### 普通文本、HTML 安全与敏感词

普通文本通过文本插值或文本属性展示，不拼入 HTML；富文本只复用[富文本规范](rich-content-standards.md)的公共编辑、净化及展示入口。字符过滤、HTML 转义和敏感词检查不能互相替代，也不能用简单删除脚本关键词代替可靠的 HTML 净化或参数化 SQL。

本次“脏数据防护”指字段非法内容与格式约束，不默认引入全站敏感词黑名单。若业务需要辱骂或违禁词审核，应先明确适用字段、词库来源/版本、维护责任、误判处理及拒绝/审核策略，由服务端统一执行并补行为测试；不得对密码、合法品牌型号、客户姓名等无差别替换词语。

### 公共入口与验收

公共入口为 `frontend/src/components/AmountInput.vue`、`frontend/src/composables/forms/useForm.ts` 与 `frontend/src/utils/security.ts`；后端通用请求校验位于 `backend/src/middleware/validation.js`，销售金额与 ID 已有业务校验位于 `backend/src/utils/sale-input.js`。普通十进制、两位金额、整数、手机号格式及单/多行控制字符的唯一规则源为 `backend/src/config/input-validation.json`，前端安全工具与后端 `input-values.js` 共用；业务范围、精度及必填要求仍由字段声明。姓名允许中英文、间隔符及合法标点，`personName` 只要求非空、单行、长度及至少含一个文字字符。标准化工具保留非法和超长原文，不能依靠工具截断代替字段拒绝。后端普通字符串默认不做 HTML 转义，密码原值保留；普通文本安全展示、富文本净化和 SQL 参数化分别处理。

预订单姓名与定金/总价/匹配价、国补申请/编辑的姓名、手机号、证件文本及金额已接公共规则。国补仅校验实际提交的可写字段；只读/隐藏的历史字段不得阻止其他有权字段的编辑。服务端先完成资料和门店校验再写入，非法输入不修改客户、国补、照片及缓存。证件本批保持单行文本与现有长度契约，不擅自新增历史资料的校验码门槛。设备编码与未逐一核验的业务/导入范围见 T23。

这些入口不代表全站业务接口均已采用；不得复制页面级正则绕开公共整改，也不得把销售专属金额上限推广为全局默认。

| 验收层次 | 必须覆盖的行为 |
| --- | --- |
| 公共规则单元测试 | 合法零值、正负边界、安全整数、两位小数；缺省/空值/纯空格；中英文混输、科学计数、十六进制、非有限数、超范围、超长及对象/数组/布尔类型；合法编码前导零与英文保留 |
| 组件行为测试 | 逐字小数编辑、清空、失焦、中文组合输入、混合内容粘贴、自动填充/扫码处理及外部回填；断言模型值和提交结果，不能只断言 DOM 属性 |
| 接口行为测试 | 绕过页面直接提交非法内容、隐藏字段和越权请求；失败时无业务写入和事务副作用，批量及导入遵守业务原子性边界 |
| 浏览器与真机 | PC 和手机视口下的错误可见性、焦点、键盘及布局；中文输入法与移动端实际键盘单列验证，仿真和静态审计不能替代真机结果 |

正式行为入口：`npm --prefix frontend run test:unit -- tests/form-validation.spec.ts tests/h5-auth-validation.spec.ts tests/amount-input.spec.ts tests/customer-name-prompt.spec.ts tests/preorder-customer.spec.ts tests/subsidy-input.spec.ts`；后端为 `ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/input-validation.check.js backend/test/preorder-mutation-controller.check.js backend/test/subsidy-apply-controller.check.js backend/test/subsidy-update-contract.check.js`。实际 H5 视图、金额与薪资弹窗的 Chromium 回归为 `npm --prefix frontend run test:input-flows`；加 `-- --ios` 使用本机 Xcode iPhone 模拟器。脚本使用真实组件及内存响应，需安装前后端依赖（浏览器驱动复用后端 Puppeteer），不访问云端 API；临时 Vite、浏览器 profile 和由脚本启动的模拟器在结束时清理/关闭。模拟器不等于真机键盘、摄像头或主屏幕书签验收。

`npm --prefix frontend run check:form-controls` 目前检查控件采用、样式及金额入口契约；`check:coverage` 检查文档、命令及公共入口登记。两者均不能证明全站内容校验合规。正式行为测试按[全局测试规范](../guides/TESTING_STANDARDS.md)保留并接入现有测试入口；T23 完成前须补齐可复现的拒绝/接受断言，不能只更新本页或增加关键词扫描后宣称闭环。

## 圆角与高度唯一入口

普通输入、选择、日期和数字控件的圆角与高度只允许由
`frontend/src/styles/components/_form-controls.scss` 维护：

- PC、平板、手机和超窄屏的普通输入、选择、日期和数字控件统一为 `30px`；PC 使用 `--input-height-default`，移动端使用 `--mobile-control-height`，两者由公共样式统一赋值。
- 公共 wrapper 高度与最小高度使用 `html body :is(...)` 覆盖组件库默认规格，避免选择框被默认 `32px` 最小高度撑大；页面不得另加高度补丁。
- 普通控件圆角统一为 `var(--tf-radius-control)`，当前值为 `6px`。
- 控件聚焦时统一使用 `var(--tf-form-control-focus-color)` 和 `var(--tf-form-control-focus-ring)`，当前为报价在库卡片同款橙色 `1px` 完整外圈；禁止页面单独设置聚焦颜色、宽度或 `inset` 阴影。
- 浏览器自动填充由 `_form-controls.scss` 统一处理：内部 input 使用公共自动填充背景和文字令牌；未聚焦时 wrapper 使用位于输入内容上层的 `::after` 绘制同为 `1px` 的连续边框，聚焦时隐藏该补边并只显示全局焦点环，避免边框加粗。页面不得单独复制 `:-webkit-autofill` 规则。
- 选择、日期、数字控件必须与普通输入使用同一 wrapper 高度和圆角。
- 所有设备的模态框表单控件与普通页面相同，统一为 `30px`，不再维护单独的弹窗高度。
- 统一检索面板和表格排序控件也统一为 `30px`；检索使用 `--tf-search-control-height`，表格排序使用 `--input-height-default`，页面不得再维护其他输入控件高度。
- 业务页面和业务组件禁止直接为 `.el-input__wrapper`、`.el-select__wrapper`、`.el-date-editor`、`.el-input-number` 或 `.el-textarea__inner` 设置 `height`、`min-height` 或 `border-radius`。
- 页面只能维护布局宽度、字段间距、状态边框和业务颜色，不能复制一套控件高度、圆角或外壳。
- 普通输入框不能仅因“已填写”就改用绿色边框或底色；聚焦、禁用和校验状态继续由公共控件处理。国补新增申请的检索、身份证、代办人和 IMEI 输入均复用此规则，不再使用 `has-value` 私有外观或额外的实体边框，避免与公共聚焦外圈叠加。拆分前遗留在父页面样式中的同类覆盖也必须同步清理。

因此，销售、库存、综合查询、系统设置、国补、工资、权限、基础资料、付款和 H5 管理页面必须使用同一公共控件入口；新增页面若出现页面级控件圆角或高度，`check:form-controls` 必须失败。

## 下拉选项统一包围

- Element Plus `el-select` 的弹出选项由 `frontend/src/styles.scss` 的公共 `.el-select-dropdown` 规则维护，页面无需另行接入或复制样式。
- 仅鼠标悬停或键盘定位（`.is-hovering`）的选项使用 `--tf-shadow-dropdown-option` 绘制 `1px` 内嵌细包围，圆角读取 `--tf-radius-control`（当前为 `6px`）；鼠标离开后移除包围，禁用项及仅选中的非交互项不常驻加圈，选中文字颜色和字重沿用原有语义。
- 包围颜色必须复用输入框聚焦色 `--tf-form-control-focus-color`（当前为 `--tf-color-orange`），禁止下拉选项另用灰蓝色或其他交互色；PC 和手机使用同一规则，后续调整输入框聚焦色时，下拉包围同步变化。
- 下拉大面板及箭头保留普通浮层样式，不增加橙色或聚焦色包围；内部 `.el-select-dropdown` 不重复绘制面板边框，避免与悬停选项重叠。输入框本体仍保留原有聚焦圈。
- 内嵌阴影不改变选项宽度、高度或间距，原有背景、文字和选中语义保持一致；输入控件本体的聚焦外圈仍由 `_form-controls.scss` 维护。
- 公共客户检索组件 `CustomerSearchDropdown` 仅在鼠标悬停或键盘聚焦的结果项展示同款完整包围，容器使用普通面板边框；列表留白、自适应高度和内容对齐按[客户检索统一规范](customer-search-standard.md)维护，禁止全部结果常驻加圈或复制第二套包围颜色。
- `check:form-controls` 检查公共状态覆盖和令牌引用，`check:design-tokens` 与 `check:style-debt` 检查新增硬编码和样式债务，不得提高基线绕过检查。

## 下拉列表滚动

- 远程 `el-select` 分页统一通过公共 `frontend/src/composables/useSelectLoadMore.ts` 监听 `popup-scroll`，复用 Select 内置 Scrollbar 的实际高度判断触底，不嵌套第二个滚动容器。业务方保留加载中、失败及末页禁用判断，首次读取和手动重试仍由原业务入口处理；搜索取消旧请求继续使用 `useLatestRequest`。
- 不再使用已弃用的 `v-infinite-scroll`，也不注册同名自定义指令或屏蔽弃用警告。`check:component-adoption` 检查旧指令回流；相关行为回归见 `frontend/tests/select-load-more.spec.ts`，商品入库下拉的真实滚动验证使用 `node frontend/scripts/test-accessory-stock-correction.mjs --template-search-only`。
- 选择、级联、自动补全、日期时间和操作菜单下拉统一由 `frontend/src/styles/components/_scrollbars.scss` 隐藏可见滚动条，包含浏览器原生滚动条、上下滚动按钮和 Element Plus 的 `.el-scrollbar__bar`；页面不再单独维护。
- 只隐藏滚动条的视觉元素，不删除滚动容器或设置 `overflow-y: hidden` / `overflow: clip`；列表原有最大高度、鼠标滚轮、触摸滑动和键盘定位能力保留，长列表仍可查看全部选项。
- 公共客户检索结果沿用同一滚动条入口，继续遵守[客户检索统一规范](customer-search-standard.md)的滚动容器和高度豁免要求。
- 自定义业务下拉的实际滚动容器必须添加公共语义 class `tf-dropdown-scroll`，复用同一原生滚动条隐藏规则，不在页面复制 CSS。商城首页型号、颜色、内存三个筛选列表已接入；保留各自的最大高度和滚动行为。
- `check:form-controls` 检查公共样式导入、下拉类型覆盖、原生和组件滚动条隐藏规则及滚动能力边界。

## 互斥切换控件（tf-state-selector）

互斥选项统一使用 `el-radio-group.tf-state-selector`。按钮式切换使用 `el-radio-button`，常规表单单选可以使用 `el-radio`；两种语义由同一公共入口管理字号、颜色、布局和禁用态。互斥切换与页面导航 Tab 不同，不添加 Tab 外层容器，也不复用 `tf-page-tabs`。

- 唯一视觉入口是 `frontend/src/styles/components/_tabs.scss` 中的 `.tf-state-selector`，选项高度、字号、边框、圆角、悬停和选中态均读取同一组 Tab 按钮令牌。
- 每个 `el-radio-group` 必须显式添加 `tf-state-selector`。迁移只改变外观和控件组件，不得改变现有绑定值、权限、提交或业务事件。
- 按钮式选项使用独立边框按钮，不显示页面 Tab 的背景容器；Element Plus 的默认选中色必须由公共规则覆盖。
- 页面仅维护控件位置、是否撑满和选项内容布局，不得声明控件字号、尺寸、边框、圆角、阴影或选中颜色。
- 禁止使用裸 `el-segmented` 或另建 `.tf-segment`、`.tf-segmented` 等平行样式入口。需要互斥按钮时统一用 `el-radio-group + el-radio-button`。
- `el-switch` 只用于独立的启用/停用布尔状态，不替代互斥选项；其视觉沿用 Element Plus 全局开关样式。
- `check:form-controls` 会拒绝未接入 `tf-state-selector` 的 `el-radio-group`，并拒绝 `el-segmented` 和旧样式类。

## 同行只读信息（tf-control-display）

与分段筛选、输入框同行的短排序说明及缩略单号，使用公共 `.tf-control-display`。唯一样式入口为 `_form-controls.scss`，高度按 PC 的 `--input-height-default`、手机的 `--mobile-control-height` 读取，当前均为30px；`border-box` 将边框计入总高，垂直内边距为0，不能依靠正文行高或页面内边距撑高。

强调信息增加 `.tf-control-display--accent`；需省略的文字使用 `.tf-control-display__text`，保留完整 `title` 或既有复制操作。公共入口统一内边距、字体、圆角及颜色，页面仅管理宽度、位置、换行和权限显隐，不另加皮肤或手机尺寸覆盖。排序说明仍是只读内容，复制操作继续使用公共 `el-button link` 和剪贴板工具；与20px小号状态标签同行的单号增加 `.tf-control-display--compact`，复用公共 `--admin-data-table-badge-height`，链接按钮的垂直内边距由公共 `_buttons.scss` 收紧；状态标签继续使用原小号，不放大。普通命令按钮与表格状态标签继续按各自语义规格显示。

`FilmServiceDialog` 的分类筛选、最新优先说明和单号复制区域分别采用30px筛选/排序和20px标签/单号组合。`/standards` 的表单预览展示公共规格，`check:form-controls` 检查唯一高度来源；`node frontend/scripts/test-checkout-order.mjs --film-service-only --viewports=375,430,768,1280` 使用真实组件及公共样式测量筛选、排序和单号外框，检查明暗主题与窄屏边界。隔离服务不会写真实业务数据。

## 原生业务输入盘点

普通搜索、名称、手机号、Apple ID、交易流水号、密码、数字字段，以及只读的员工/金额展示全部使用 `el-input` 或 `el-input-number`。当前业务模板中的原生普通文本和数字输入数量均为 0，由 `check:form-controls` 持续守护；迁移后的组件事件必须使用 Element Plus 发出的值，不得再依赖 `$event.target.value`。

文件上传、颜色、范围、复选和单选属于浏览器能力或专用编辑语义，继续按“原生控件边界”章节管理。

新建或大幅修改的后台表单必须优先使用 Element Plus 控件。公共组件可以封装 Element Plus，但不能让业务页面重新维护相同的基础样式。

## 统一行为

- 表单控件必须使用项目统一的 `size`、`disabled`、`clearable`、`placeholder` 和校验反馈规则。
- 受 `el-form` 管理的字段使用 `el-form-item`，错误文字由表单校验或公共错误状态展示，不得为同一字段复制多套错误提示。
- 必填标记由表单规则统一提供；业务页面不得通过多个手写星号制造不同间距。
- 下拉选项必须使用稳定的 `key`，展示文本与提交值分离；基础资料选项继续遵守《后台列表检索统一规范》的排序规则。
- 后台表格中的普通数值编辑也使用 `el-input-number`；排序字段不得直接使用原生 `<input type="number">`，公共尺寸由 `_table.scss` 中的 `.sort-order-control` 维护。
- 所有数字输入字段都不得显示上下增减按钮。每个普通 `el-input-number` 必须显式使用 `:controls="false"`；`AmountInput` 由公共组件内部设置该属性，调用方不重复传入，公共样式会隐藏历史页面遗漏的步进按钮、移除预留的左右空白并保持边框连续；原生 `input[type="number"]` 同时隐藏浏览器自带的数字旋钮。金额字段仍使用 `.price-input` / `.price-input-number` 语义 class，但不再单独维护按钮样式。
- `el-input` 的人民币符号统一放在 `#prefix` 插槽内，与金额共用同一个输入框边框、背景和高度；禁止用 `#prepend` 显示独立的灰色金额前置块。国补编辑销售价格、报价编辑采集价与综合查询编辑使用同一方式，`check:form-controls` 持续检查此规则。
- 备注、说明、地址等多行文本统一使用固定 `rows` 的 `el-input type="textarea"`，这是强制规则：控件首次渲染保持固定高度，不随输入内容自动向下展开；禁止使用 `autosize`。公共样式只允许 `resize: vertical`，用户可以通过文本域底部手柄手动向下拉伸，禁止横向、双向或完全禁止拉伸。页面不得通过私有 CSS 改回自动扩展、横向拉伸或固定不可调整高度。
- `rows="2"` 是备注、锁定提示、短说明和短地址等常规文本的统一紧凑规格，公共令牌按 PC/手机断点提供统一初始高度；`rows="3"` 及以上只用于确实需要展示更长内容的业务字段，并须保留固定 rows，不得用页面私有 `height`/`min-height` 覆盖公共行为。
- 短系统文案（例如锁屏标题、锁定提示、站点名称和公司地址）使用单行 `el-input`；只有备注、说明、地址详情等可能包含换行的内容才使用 textarea。字段语义优先于统一套用多行控件。
- 所有业务页面模板不得使用原生 `<textarea>`；统一控件可添加 `tf-textarea` 语义 class，但高度必须由 `rows` 明确声明。复制到剪贴板等脚本临时创建的隐藏 textarea 不属于业务表单控件。
- 金额展示统一使用 `frontend/src/utils/format.ts` 的 `formatAmount`/`formatCurrency`；业务公共格式化函数只能委托该入口并保留空值语义：`1500.00` 显示为 `1500`，`1500.50` 显示为 `1500.5`，不得直接在模板中使用金额 `toFixed(2)`。
- 日期字段必须明确 `type`、`format`、`value-format`，业务代码不得直接依赖浏览器本地日期字符串解析。
- 控件宽度由父级布局和公共搜索/弹窗规则控制；业务页面不得为普通输入、选择和日期控件复制一套固定高度、圆角或颜色。
- 表格内的编辑输入框不得被列边框和单元格留白切成左右独立区域；需要连续铺满时，必须给编辑列登记语义 class，并只在该列收口单元格边框与水平内边距。
- 手机端控件必须允许收缩或换行，文字、占位符和错误提示不得被裁切。

## 原生控件边界

原生控件不是默认入口。以下情况可以保留，但必须在代码审计中登记：

1. `file`、`color`、`range`、扫码或上传控件依赖浏览器原生能力。
2. `checkbox`、`radio` 是专用编辑器、批量勾选或数据导入结构的一部分。
3. 打印、导出或只在 H5 顾客端使用的轻量交互有明确兼容性要求。

登记例外必须同时满足：

- 在对应页面保留业务原因，不能只写“历史代码”；
- 不新增第二套通用控件样式；
- 新增字段优先迁移到标准控件；
- 例外数量不能增加，必须通过 `check:form-controls`；
- 完成页面迁移后删除例外登记。

回归观察清单由 `frontend/scripts/check-form-controls.mjs` 维护。当前运行时代码中的原生文本、数字、`select` 和日期输入数量均为 0；文件上传、颜色、范围、复选和单选仍按浏览器能力边界保留。

截至 2026 年 10 月 3 日，登录、屏幕解锁、H5 商品筛选、H5 订单查询、国补申请、菜单宽度、工资考勤、工资模板和工资发放中的普通输入均已迁移到统一 Element Plus 控件。国补身份证、姓名、电话归一化已改用组件字符串事件，业务校验行为保持不变。

下拉、日期、排序数字控件的迁移仍按各自的组件语义审计。地区选择统一使用 `CitySelector` 和 `services/region-options.ts`；客户地址编排复用 `views/customers/useCustomerAddress.ts` 与 `page/CustomerAddressFields.vue`。省份保存两位编码，其余层级保存名称，上级变化清空下级，编辑打开不静默改写历史值；异步加载走 `unifiedApi`、`useLatestRequest` 和公共 `InlineLoading`。

五级数据按父级加载，采用用户接受的**2023-06-30固定版本**，必须展示截止日期及港澳台乡村覆盖限制，不得称为当前最新数据。数据库能力未就绪时保留原三级读写并提示待迁移；失败保留历史文本，不能静默丢弃新字段。手机竖排、较宽屏换行并使用公共表单视觉，不得把全量村级目录放入首屏包。唯一类型由地区OpenAPI生成；来源、许可、独立字段、权限及迁移见[后端地区契约](../backend/region-address.md)。

专项行为入口：`npm --prefix frontend run test:unit -- tests/region-options.spec.ts tests/region-selector.spec.ts`；真实控件的隔离浏览器入口：`npm --prefix frontend run test:region-address`（不连接业务库，不替代云端与物理设备验收）。

## 迁移顺序

1. 后台列表筛选和普通编辑弹窗：优先使用 `UnifiedSearchPanel`、`el-select`、`DateRangePicker` 和 `el-date-picker`。
2. 新增业务表单：直接使用标准控件，不得复制历史原生控件写法。
3. 文件、颜色、扫码、复选和单选：保留原生能力，但只允许专用 class，不得伪装成通用文本输入。

## 禁止事项

- 后台新增普通 `<select>`、`input[type="date"]`、`input[type="month"]` 或 `input[type="time"]`。
- 在页面中复制 `.form-control`、`.date-input` 等通用控件主题来绕过 Element Plus 公共样式。
- 用浏览器原生日期字符串直接拼接数据库值，绕过 `TimeUtil` 和统一日期格式。
- 为同一字段同时渲染原生控件和 Element Plus 控件，仅通过 CSS 隐藏其中一个。
- 通过页面级 `!important` 修改公共控件高度、颜色、圆角或禁用态。

## 审计

提交或打包前执行：

```bash
cd frontend
npm run check:form-controls
```

审计会检查：

- 普通文本和数字输入是否全部使用 `el-input`/`el-input-number`；
- 原生 `select` 是否属于现有登记例外；
- 原生日期输入是否属于现有登记例外；
- 六类基础资料排序字段是否继续使用统一 `el-input-number`；
- 角色表单和权限模块管理的普通文本字段是否继续使用登记数量的 `el-input`；
- 已登记文件的例外数量是否增加；
- 统一文档、审计命令和公共入口是否已登记。
- 数字输入是否重新引入 `controls-position`，文本域是否重新引入 `autosize` 或 `resize="none"`；这些行为由公共表单控件入口统一控制。
- 所有业务模板是否仍存在原生 `<textarea>`；每个 `el-input type="textarea"` 是否声明固定 `rows`；文本域是否只保留垂直手动拉伸。
- 页面/组件是否私自维护普通表单控件的 `border-radius`、`height` 或 `min-height`；统一圆角和高度必须来自 `_form-controls.scss`，检索和表格排序只能使用已登记的公共组件例外。
- 页面/组件是否私自维护普通表单控件的 `:focus`、`.is-focus` 或 `.is-focused` 边框、阴影和颜色；聚焦状态必须来自 `_form-controls.scss`，公共检索容器的外层聚焦效果除外。
- 公共下拉选项是否只在鼠标悬停或键盘定位时使用统一内嵌包围令牌，并排除禁用项及仅选中状态。
- 下拉大面板、箭头和客户检索容器是否恢复普通浮层样式，内部面板是否没有重复边框。
- 下拉是否隐藏原生和 Element Plus 可见滚动条，且没有通过隐藏溢出来禁止列表继续滚动。

当前策略是原生 `select` 和日期输入默认清零；若确需重新引入，必须先登记原因、公共替代方案和回归范围，并运行完整 `npm run check:standards`。

## 金额控件与展示回归

金额数字输入唯一入口是 `frontend/src/components/AmountInput.vue`，通过已有组件自动注册使用，不在每个页面重复导入。它复用 Element Plus 数字控件、公共表单样式和 `formatAmount`，透传字段权限对应的禁用/只读、边界、插槽、焦点与变更事件。清空沿用组件库空值语义（默认 `null`，支持 `value-on-clear`），挂载不会改写业务模型；编辑草稿保留小数点与尾零，完成编辑后去掉无意义尾零，输入最多两位小数。调用方不得覆盖 `precision`、`controls` 或步进按钮位置。

公共金额默认`step=0.01`，避免合法分币金额被原生数字输入的整数步长拒绝提交；既有业务显式步长仍按原声明透传，不改变其键盘增减约定。非金额比例字段允许两位小数时，需同步声明匹配的小数步长。不能为绕开步长问题关闭整个表单校验；`tests/amount-input.spec.ts`和工资模板真实表单回归检查原生约束及提交。

- `225` / `225.00` → `225`，`225.02` → `225.02`，`225.20` → `225.2`，零显示 `0`；不使用千分位。
- 金额不得用 `precision=2` 强制补 `.00`，也不得用 `precision=0`、`Math.round`、`toFixed(0)` 在展示或表单回填时丢失真实小数。业务计算的数值精度、非金额的比例/数量/排序/天数及图表坐标缩写继续按各自契约处理。
- 可编辑金额统一使用 `AmountInput`；业务模型原有数值或字符串契约、业务校验及清空语义由调用方保留。只读金额可保留 `el-input`，展示委托 `formatAmount`，不得再复制一套金额格式化算法。
- 国补申请计算与缺省备注统一调用 `frontend/src/views/subsidy/subsidy-calculations.ts`：补贴按分四舍五入，遵守 6000 元资格线与 500 元上限，刷卡金额由售价减去已按分舍入的补贴生成；三项金额展示仍用 `formatAmount`，既有人工备注保留。申请提交复用同一计算结果，禁止直接将浮点乘法结果拼入备注。
- `check:form-controls` 使用 Vue 模板 AST 逐控件检查金额语义及公共入口，普通数字控件逐个检查 `controls=false`；正反例位于 `check-amount-input-contract.test.mjs`。真实输入行为回归位于 `tests/amount-input.spec.ts`，不能以静态审计替代交互验收。


价格输入的上下按钮由公共样式和组件属性共同禁止。新页面必须使用 `.price-input` 或 `.price-input-number`，不能通过页面私有 CSS 重新显示按钮。金额展示禁止固定补零，统一去掉小数末尾的 `0`；业务计算仍保留数值精度，只有展示层格式化。

金额规范适用于后台、销售、库存、国补、预订单、供应商、工资和 H5 页面。金额模板不得直接调用 `toFixed(2)`；统一使用 `formatAmount`/`formatCurrency` 或已登记的公共价格格式化函数。新增金额字段必须同时完成输入控件和展示格式接入，并通过 `check:form-controls` 与构建检查。

## 本轮统一记录（2026-10-04）

- 已将工资模板、考勤、角色管理、模块管理、国补申请和 Git 提交表单中的原生 textarea 全部迁移为 `el-input type="textarea"`。
- 已将“默认固定高度、允许手动向下展开”纳入强制审计；`check:form-controls` 现在会拦截原生 textarea、缺少 `rows` 或 `tf-textarea` 语义 class 的多行控件，以及横向/双向/禁止拉伸和自动高度配置。
- 当前业务模板原生 textarea 数量为 0，所有业务多行控件均已接入 `tf-textarea`；`rows=2` 使用全局 PC/手机高度令牌，`rows>=3` 按长内容语义保留固定行数并仍允许垂直手动展开。
- 已将普通控件的圆角和高度收口到 `_form-controls.scss`，移除销售、综合查询、库存、国补、权限、付款、H5 和基础资料页面的私有控件圆角/高度覆盖；`check:form-controls` 现在会阻止新增私有控件圆角或高度。
- 已将普通输入、选择、日期和数字控件的聚焦状态收口到 `_form-controls.scss`，统一为报价在库卡片同款橙色 1px 完整外圈，并移除销售、库存、综合查询、权限、国补、付款、城市选择、菜单和屏幕锁定页面的私有聚焦覆盖；公共检索容器仍保留自身外层聚焦反馈，内部输入不重复绘制。

最后更新：2026-11-12
