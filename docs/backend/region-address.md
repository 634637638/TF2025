# 版本化五级地区与客户地址

本文说明 T16 的地区资源、客户字段、权限及受控迁移。实现和本地验证不表示云端已迁移；执行状态统一见[技术债务台账 T16](../development/TECHNICAL_DEBT_PROGRESS.md)。

## 数据口径与更新

用户已接受截止 **2023-06-30** 的固定版本。来源为 `modood/Administrative-divisions-of-China`，固定提交 `c49d495b40ac73eb1a66f6eeae5f8fd10696f035`；提交时间不代表数据截止日期。原始许可为 **WTFPL-2.0**，随正式资源保留原文。来源、文件校验和、版本及覆盖范围集中在 `backend/scripts/config/region-source.json` 和 `backend/data/regions/2023-06-30/manifest.json`。

该版本包含内地31省级、342地级、2978县级、41352乡级、620573村级节点。它不保证反映此后行政区划调整，也不包含港澳台完整乡村数据；组件保留原有港澳台三级兼容及明确提示，不伪造下级。

正式资源按省压缩，约5 MB，部署时必须一起上传 `backend/data/regions/2023-06-30/`。发布前执行 `npm --prefix backend run check:runtime-assets`，同时检查31省资源哈希、原许可及接口契约，漏传或损坏即失败。不把全量村级打入前端首屏包。后端验证资源 SHA256，按需解压，最多缓存3省并合并同省并发读取；这类只读缓存可以在不同进程重复，不能据此宣称其他安全状态支持多实例。

更新由项目维护者选择新版本、核对许可与覆盖口径，更新固定配置及源文件哈希后，使用 `prepare-region-data.js` 在**不存在的新输出目录**离线生成；脚本不联网、不访问数据库。先跑全量数据与兼容测试，再变更服务默认资源版本，保留旧版本供历史追溯；不能覆盖旧目录冒充原版本。生成参数见 `node backend/scripts/prepare-region-data.js` 的缺参提示。

## API 与唯一类型

- `GET /api/regions?parent=`：根级不传 parent；下级传2/4/6/9位父级编码。统一 JWT 认证，不读取客户数据、不新增地区管理权限。
- 响应为 `{ success, message, timestamp, data: { version, coverage, options: [{ code, name }] } }`；非法/重复参数400，未登录401，不在覆盖范围或无下级404，资源故障500且不暴露服务器路径。
- 唯一机器契约为 `backend/src/contracts/regions.openapi.json`。前端 `RegionSelection`、`RegionOption`、`RegionChildren` 引用生成类型，不能再手写第二套字段；生成与检查见 [OpenAPI 试点](openapi-pilot.md)。
- `GET /api/customers/address-capabilities`：统一认证及 `customers:view`，只读返回 `{ready, version, coverage}`。未迁移时保留原三级格式并提示管理员，不能静默丢弃新层级。
- 客户列表带 `include_address_levels=1` 时补充独立层级；单条详情与更新结果返回可用层级。新增/编辑沿用现有客户权限，父子链由服务端验证，变更上级会清空未显式提交的下级。

省份保存两位编码；城市、县区、乡镇、村级保存展示名称，兼容旧直辖市城市名称。版本由服务端确定，不接受客户端自行指定地区版本。没有明确匹配关系的历史地址不推断、不批量拆分；首次人工转为新格式时保存旧 `address` 到内部 `legacy_address`，不覆盖已存在备份。

## 字段权限、查询与导出

统一使用“用户 → 角色 → 权限”。新增 `customer.district`、`customer.town`、`customer.village` 字段能力；前端隐藏/禁用，后端通过公共 `FieldAccessService` 拒绝隐藏字段写入并脱敏响应。权限查询失败即失败，不能按全可见放行。

隐藏详细地址时同时隐藏新层级；隐藏任意地区层级时保守隐藏 `address` 及内部旧地址，防止组合文本旁路。内部 `legacy_address` 不进入普通响应或导出。

结构就绪后，地址关键词搜索扩展到县区、乡镇、村级；隐藏字段不参与搜索，不能借记录数量推断。客户 XLSX 导出使用 `customers:export`，在二进制生成前按同一权限删除不可见列，保留筛选；单次最多10000条，超限要求缩小范围，不静默截断。用户文本按字符串单元格写入，不执行公式。

## 云端迁移与回退

迁移只新增5个 nullable 列，详见[客户表结构](../database/customers-table-schema.md)。不修改原客户行，不自动回填或猜测乡村；应用请求不执行 DDL。

```bash
# 默认离线计划：完全不连接数据库
npm --prefix backend run migrate:customer-address
# 获准后只读检查当前环境配置的云库
npm --prefix backend run migrate:customer-address -- --inspect
# 只有针对当前目标获明确授权、做好数据库备份后才执行
npm --prefix backend run migrate:customer-address -- --apply
```

独立迁移 ID 为 `20261113_customer_address_levels`，不属于 `migrate:schema` 的历史运行时基线，不会由该基线自动重跑。执行前检查既有列定义、获取迁移锁，将目标指纹、原结构、待加列及校验和保存到 `backend/backups/migrations/` 的独占0600文件；备份成功才改表，完成后回读，重复执行不重复加列。结构备份不能代替运维完整数据库备份。

正常回退优先回退应用、保留新增列。物理删列必须停止应用写入、使用原备份、验证目标与校验和，并确认所有拟删列没有业务值：

```bash
npm --prefix backend run migrate:customer-address -- --rollback --maintenance-confirmed --backup /受控备份路径/原结构备份.json
```

已有新地址数据时脚本拒绝删列；不能为了回退丢失地址。DDL可能持锁，实际执行窗口由运维确认。本地替身测试和离线预览不代表云端迁移完成。

## 验证入口

```bash
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/region-catalog.check.js backend/test/customer-address.check.js backend/test/customer-address-query.check.js backend/test/region-http-contract.check.js
npm --prefix frontend run test:unit -- tests/region-options.spec.ts tests/region-selector.spec.ts
npm --prefix frontend run test:region-address
```

浏览器入口使用真实控件与固定版本地区资源、隔离 Vite 和本机接口替身，不读取环境文件、不连接业务库；覆盖5个视口×明暗主题。它不替代生产部署、真实客户读写、物理设备或云端迁移验收。

2026-11-13 已按本次明确授权在当前云端环境新增上述5列，执行前备份、完成后再次只读inspect均成功；结构备份校验和与0600权限通过。未修改客户行，也未运行真实业务写入验收；生产前后端仍由用户手动上传。
