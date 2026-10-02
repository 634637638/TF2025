# 后端开发文档入口

本文件曾复制一份独立的项目开发指南，内容容易与总指南和当前代码漂移。现行开发约定统一以[项目开发指南](../CLAUDE.md)为准；后端实现、部署和数据库操作分别以本目录及对应分类索引中的专题文档为准。

## 后端入口

- [后端文档索引](INDEX.md)
- [上传文件存储与迁移规范](upload-storage-standard.md)
- [设备状态统一规范](phone-status-standard.md)
- [维修设备关联规范](repairs-device-link.md)
- [数据库文档索引](../database/INDEX.md)
- [部署文档索引](../deployment/INDEX.md)

后端服务使用 Node.js、Express 和 `mysql2`，通过显式 SQL、仓储和服务层访问数据库；项目未使用 Sequelize。Node 服务默认监听 `3000`，生产环境配置文件由服务器本机的 `backend/.env.production` 提供，不能提交或打包进前端。
