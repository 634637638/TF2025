# 兼容接口源码基线与恢复说明

> 文档类型：接口退役归档记录
> 记录日期：2026-11-04
> 当前状态：清单基线已建立；删除前 Git 标签尚未创建
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

## 当前基线

| 项目 | 记录值 |
| --- | --- |
| 分支 | `main` |
| HEAD | `0ad75ce9ac2fd150205250c0e5c08c65a9143294` |
| 路由清单 | [route-retirement-manifest.json](route-retirement-manifest.json) |
| 相关未提交文件 | `backend/src/routes/analytics.js`、`backend/src/routes/index.js` |
| 删除状态 | 尚未删除任何本清单中的 28 个路由 |

当前 HEAD 不能单独代表完整待删除源码，因为上述两个路由文件还包含其他未提交修改。开始任何删除批次前，必须先完成相关变更验证并形成基线提交，不得用当前 HEAD 标签覆盖未提交内容。

## 删除前标签

每批使用独立标签：

```text
compat-routes-before-batch-01-YYYYMMDD
compat-routes-before-batch-02-YYYYMMDD
compat-routes-before-batch-03-YYYYMMDD
compat-routes-before-batch-04-YYYYMMDD
```

标签创建后把完整 commit 写回对应批次文档。标签只用于恢复原实现，不代表接口可以跳过观察条件直接删除。

## 恢复顺序

1. 根据错误日志中的请求路径和 `migration_id` 找到清单条目及删除批次。
2. 优先回滚该接口所在的独立删除 commit，恢复原权限、参数和响应转换。
3. 重新执行对应契约测试、后端测试、文档检查和 `git diff --check`。
4. 部署恢复版本并核对 request ID、状态码和受影响页面。
5. 在兼容接口台账和批次文档登记回滚原因、时间、影响范围及新的迁移方案。

禁止通过复制归档代码、临时增加无权限路由或伪造成功响应处理回滚。
