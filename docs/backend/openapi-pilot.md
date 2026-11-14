# 地区 API 的 OpenAPI 试点

T12 选择只读地区模块试点，唯一契约为 `backend/src/contracts/regions.openapi.json`，OpenAPI 3.1。业务行为与数据版本见[五级地区与客户地址](region-address.md)，不是全站接口均已迁移。

## 维护流程

1. 修改唯一 OpenAPI 文件中的路径、认证、参数、错误响应或地区 schema。
2. 同步后端实现，执行 `npm --prefix frontend run generate:openapi`。
3. 前端从 `frontend/src/types/generated/regions.ts` 引用类型；该文件由工具生成并保留提交，禁止手改或再建一份手写共享类型。
4. 执行下列检查。契约、生成类型、调用方和测试一起评审；不以生成成功代替接口运行验收。

```bash
npm --prefix frontend run check:openapi
npm --prefix frontend run type-check
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/region-http-contract.check.js
```

`check:openapi` 已进入 `check:standards`。生成器复用仓库 ESLint 配置格式化产物，不能手工修正生成类型或单独豁免代码规范。正式测试覆盖可重复生成、手工修改产物和源契约变更的漂移拒绝，并清理自身临时目录。

HTTP 契约测试启动真实本机 Express 路由、Controller 和地区服务，覆盖省市县乡村读取、参数非法/重复、未登录、覆盖范围与500脱敏；只将认证结果替换为测试身份，不连接数据库，也不声称验证真实 JWT 或生产反向代理。测试逐项核对响应字段、类型、格式、必需属性、额外属性与 schema。

试点不引入公开 Swagger UI、不暴露内部客户接口或维护第二套认证。后续是否扩展模块，以唯一类型收益、契约测试和维护成本评估，执行状态统一见[技术债务台账 T12](../development/TECHNICAL_DEBT_PROGRESS.md)。
