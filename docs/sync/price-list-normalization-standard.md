# 报价采集归一化规范

## 颜色标准

报价采集使用颜色管理中的**启用颜色名称**作为唯一标准颜色。`colors` 表不增加额外的分类字段，也不自动创建外部颜色。外部数据先提取原始颜色，再归一到当前颜色管理中的标准名称。

例如，颜色管理中存在“红色”时，以下外部颜色都保存为“红色”：

- 酒红、大红、勃艮第酒红色
- 冰川蓝色保存为蓝色
- 银色保存为白色
- 草绿、深绿、浅绿保存为绿色
- 灰色、天空灰、深空灰保存为黑色

精确命中颜色管理名称时优先保留该名称；未识别的颜色不会擅自归类或新增，便于后续在颜色管理中补充标准后重新同步。

## 型号与外部代码

已确认的 iPhone 型号使用外部型号代码检索和严格匹配：

| 本站型号 | 外部代码 |
| --- | --- |
| iPhone 17 Air | A3518 |
| iPhone 17 | A3521 |
| iPhone 17 Pro | A3524 |
| iPhone 17 Pro Max | A3527 |
| iPhone 17E | A3635 |
| iPhone 18 Pro | A3715 |
| iPhone 18 Pro Max | A3718 |

`price_list.external_model` 中如果仍保留历史展示名称，不能覆盖已确认的型号代码。同步时优先使用代码检索，避免外部站点因名称格式差异返回空结果；同步成功后也会将确认的代码写回记录。

## 维护要求

1. 新增外部颜色时，先归入已有标准颜色，不为每个外部别名新增颜色。
2. 新增手机型号时，先确认外部型号代码，再加入产品名称映射和报价采集代码表。
3. 修改颜色管理后重新执行一次报价同步，采集会在同步开始时刷新启用颜色配置。
4. 同步日志中的型号、颜色、内存和价格应能组成唯一的可核对组合；无法匹配的组合保留在同步失败明细中，不使用其他型号或容量的价格替代。

## 匹配逻辑职责与回归

颜色、容量、型号归一和同城候选排序的唯一实现为 `backend/src/services/price-product-matcher.service.js`。`price-list.service.js` 保留原公共方法委托，仍独占数据库、启用颜色配置、外部抓取与会话；匹配器按需读取主服务配置，不复制缓存或权限状态，不访问数据库/网络，不改变输入候选数组。拆分不改变上述业务匹配规则，也不代表整个价目/商城大文件债务已关闭。

外部来源的搜索候选词、目标型号识别、有效报价行判断和检索 URL 构造统一由 `backend/src/services/price-source-parser.service.js` 实现。主服务传入 HTML 解析器和本次使用的采集源 URL，参见[多来源检索规则](../business/price-source-sync.md#外部型号检索与匹配)。解析单元只处理传入的数据，目标型号判断决定是否继续解析，写回前还需核对品牌、型号、容量和颜色。

公开未登录来源请求报价前，主服务先访问同源首页并逐跳保留匿名会话 Cookie，之后复用于报价及型号补搜请求。重定向只允许同主机，并将跳转中的 HTTP 地址升级为 HTTPS；公开源不复用账号来源的登录 Cookie。

```bash
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/price-source-parser.check.js backend/test/price-product-matcher.check.js backend/test/price-list-iphone18.check.js backend/test/price-list-public-session.check.js backend/test/price-channel-pricing.check.js backend/test/price-list-management.check.js backend/test/price-list-public-search-contract.check.js
```
