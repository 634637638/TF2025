# 供应商打款批次规范

## 适用范围

适用于供应商打款页面的批量打款、批次详情和已打款记录编辑。

## 批次定义

新打款记录使用 `phones.payment_batch_id` 标记批次。已打款批次由以下规则确定：

- 批量打款：同一次请求的设备使用同一个 `payment_batch_id`，编辑时仍按供应商边界同步；
- 单条打款：`payment_batch_id` 为空，编辑时只更新当前记录；
- 历史数据没有批次编号时，回退使用 `supplier_id + payment_status + payment_time`（北京时间精确到秒）识别。

批量打款时所有选中设备使用同一个批次编号和北京时间；编辑时只同步该供应商在该批次中的记录。单条打款不会因为时间相同而误并入批量批次。

## 编辑规则

编辑批量打款批次中的任意一条记录，必须在一个数据库事务中同步整批记录的：

- 打款时间；
- 打款方式；
- 打款备注。

前端编辑控件使用 `TIME_FORMATS.DATETIME` 保存完整时间，不得只传日期后由当前时间补齐。后端使用 `backend/src/utils/time.js` 的 `normalizeDateTime()` 解析业务时间，禁止直接使用 `new Date(payment_time)`。

编辑完成后，页面必须刷新列表或批次详情，确保同批次记录显示一致。批次颜色依赖统一的打款时间，整批同步后不得出现同批次颜色分裂。

编辑单条打款记录只更新该记录。若编辑表单未修改打款时间，前端必须提交原记录完整的北京时间，后端不得用当前时间覆盖。

## 权限与取消

- 编辑接口继续使用 `supplier-payments:edit` 权限，由统一认证和权限中间件保护。
- 取消打款仍使用现有取消流程，不因编辑批次同步而改变权限边界。
- 没有打款时间的历史异常数据不自动与其他记录合并，只更新当前记录。

## 验证

```bash
node --check backend/src/services/supplier-payment.service.js
cd frontend
npm run check:time
npm run type-check
```
