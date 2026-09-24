# 上传文件存储与迁移规范

> **文档说明**：定义业务上传文件的目录命名、数据库关联、生命周期、迁移和部署要求
>
> **最后更新**：2026-09-24
> **版本**：v1.1.0
> **维护者**：TF2025 开发团队

## 适用范围

本文档适用于 `backend/uploads` 下的业务文件。上传根目录默认是
`backend/uploads`，可以通过环境变量 `UPLOAD_PATH` 改为绝对路径。

所有文件 URL 必须通过 `backend/src/utils/upload-paths.js` 生成或解析，禁止在
路由、服务和前端中手工拼接服务器绝对路径。

## 目录规范

### 国补照片

数据库字段：`national_subsidies.subsidy_photos`。

```text
uploads/subsidy/
├── 客户姓名序列号/
├── 代办人姓名序列号/
└── 序列号-YYYY-MM-DD/          # 二手机
```

规则：

- 没有代办人时使用“客户姓名 + 序列号”。
- 存在代办人时使用“代办人姓名 + 序列号”，代办人优先于客户姓名。
- 二手机使用“序列号 + 入库日期”，日期格式为 `YYYY-MM-DD`。
- 修改客户姓名、代办状态、代办人姓名或序列号后，目录和
  `subsidy_photos` URL 必须同步更新。
- 存在代办人时，只修改客户姓名不会改变目录。
- 文件移动或 URL 更新失败时，已经移动的文件必须回滚。

公共命名工具：`backend/src/utils/subsidy-photo-storage.js`。

### 二手机图片和视频

数据库字段：`H5_images.image_url`。

```text
uploads/phones/序列号-YYYYMMDD/
uploads/videos/序列号-YYYYMMDD/
```

示例：

```text
uploads/phones/FFMXNCF9JC6G-20260425/
uploads/videos/FFMXNCF9JC6G-20260425/
```

规则：

- 目录名只由序列号和入库日期组成，不包含手机 ID 和时分秒。
- 手机 ID 只用于查询关联的 `H5_images` 记录，不参与目录命名。
- 修改序列号或入库日期后，图片、视频目录及数据库 URL 必须一起更新。
- 只修改时分秒且日期不变时，目录名不变。
- 全新机媒体保持对应模块的根目录规则，二手机必须进入设备目录。
- 综合查询和手机管理上传入口必须共用同一个归档函数。

公共归档工具：`backend/src/utils/phone-media-storage.js`。

### H5 商城媒体

商城目录按数据库业务模块分组：

```text
uploads/shop/
├── h5_newimages/
│   └── 品牌-型号-颜色/
├── template-staging/
│   └── 颜色子模板ID/       # 未保存的模板媒体，24 小时后自动清理
├── h5_banners/
└── h5_config/
```

商品模板示例：

```text
uploads/shop/h5_newimages/苹果-17promax-橙色/
```

数据库关联：

| 目录 | 数据库字段 | 内容 |
|---|---|---|
| `shop/h5_newimages/品牌-型号-颜色` | `h5_newimages.image_url` | 商品模板图片和视频 |
| `shop/h5_banners` | `h5_banners.image_url`、`h5_banners.images` | H5 轮播图 |
| `shop/h5_config` | `h5_config.config_value` | 商城 Logo、微信二维码、支付宝二维码 |

规则：

- 模板目录必须使用基础资料表中的品牌、型号和颜色名称。
- 品牌、型号或颜色缺失时禁止生成 `unknown` 目录，上传应直接失败。
- 修改模板的品牌、型号或颜色后，已有媒体和数据库 URL 必须同步迁移。
- 删除模板时必须同时删除模板媒体；删除最后一个文件后清理空目录。
- 模板编辑媒体先写入 `h5_template_media_drafts` 和 `template-staging`，不进入商城正式媒体查询。
- 只有“保存母模板”成功提交草稿后，媒体才移动到 `h5_newimages/品牌-型号-颜色` 并写入 `h5_newimages`。
- 取消、关闭或离开模板编辑时，前端必须通过按上传者校验的草稿清理 API 同时删除暂存行和文件；服务重启或浏览器中断留下的草稿保留最多 24 小时。
- 同一颜色模板的多文件并发上传必须通过模板行锁序列化；主图只能设置为图片，不能设置视频。
- 配置页和轮播图页上传时必须显式提交模块名，后端仅接受
  `h5_config` 和 `h5_banners`。

模板媒体采用“暂存上传、保存时归档”两个阶段，两个阶段写入不同目录：

1. 上传接口先写入 `uploads/shop`，随后将文件移入
   `uploads/shop/template-staging/<颜色子模板ID>` 并记录草稿。
2. 点击保存母模板后，后端再创建
   `uploads/shop/h5_newimages/品牌-型号-颜色`，将暂存文件归档并写入正式媒体表。

因此，上传成功不等于正式归档目录也有写权限。若部署日志出现
`EACCES: permission denied, mkdir .../uploads/shop/h5_newimages/...`，通常是
Node 进程能写暂存目录，但不能在 `h5_newimages` 下创建正式目录。其他模块（例如
国补照片写入 `uploads/subsidy/...`）正常，也不能证明商城这两个目录均可写。

公共归档工具：`backend/src/utils/shop-media-storage.js`。

## 媒体预览规范

图片和视频在管理端必须使用统一的媒体预览组件
`frontend/src/components/MediaPreviewViewer.vue`：

- 图片使用图片预览，视频使用原生 `<video controls playsinline>` 播放。
- 图片、视频可以在同一个预览窗口中前后切换，支持关闭和移动端操作。
- 媒体类型优先读取数据库类型字段，同时按文件扩展名兜底识别，不能只用图片查看器处理视频。
- 已售商品、综合查询和 H5 上架编辑均应接入该组件；模板编辑中的视频缩略图也必须保留播放控件。
- 预览失败时显示错误状态，不得把媒体链接改造成强制下载链接。

## 上传生命周期

所有上传入口必须遵循以下顺序：

1. Multer 将文件写入受控上传目录。
2. 使用 `upload-file-validation.js` 校验文件真实签名，不只检查扩展名和 MIME。
3. 根据业务记录计算最终目录并移动文件。
4. 业务数据保存成功后写入最终 URL。
5. 任一步失败时删除本次上传文件，事务失败时回滚已移动文件。
6. 新增表单关闭、取消或保存失败时，使用与业务记录、上传者绑定的暂存清理接口；不要只按 URL 直接删文件。
7. 删除业务记录或媒体记录时，同时删除物理文件并清理空目录。

不得自动删除无法确认归属的文件。未引用文件必须先报告，由维护人员确认后再处理。

## 迁移命令

文件归档迁移命令默认是只读预演，只有添加 `--apply` 才会移动文件并更新媒体 URL。
商城模板媒体结构命令是数据库 DDL 迁移，不接受 `--apply`，需确认连接目标后显式执行。

```bash
cd backend

# 国补照片
npm run migrate:subsidy-photos
npm run migrate:subsidy-photos -- --apply

# 手机图片和视频
npm run migrate:phone-media
npm run migrate:phone-media -- --apply

# H5 商城媒体
npm run migrate:shop-media

# 模板图片/视频暂存表和 video 类型
npm run migrate:shop-template-media
npm run migrate:shop-media -- --apply
```

执行要求：

- 运行前备份数据库和完整 `uploads` 目录。
- 确认 `backend/.env` 指向预期数据库。脚本会更新该数据库中的 URL。
- 先查看预演中的缺失文件、目标冲突和未引用文件。
- 迁移期间停止相关上传和编辑操作。
- 执行后再次运行预演，正常结果应为待迁移文件数 `0`。
- 不得使用 `--delete` 同步上传目录，不得自动清理未引用文件。

## 部署要求

媒体目录、数据库 URL 和后端代码属于同一个发布单元，必须一起部署。

如果迁移脚本在服务器执行：

1. 停止上传写入。
2. 备份服务器数据库和 `backend/uploads`。
3. 上传新代码但暂不启动服务。
4. 执行迁移预演和 `--apply`。
5. 核验待迁移为 `0` 后启动服务。

如果本地迁移脚本连接的是云端数据库，数据库 URL 已经更新：

1. 立即停止服务器相关上传写入。
2. 备份服务器 `backend/uploads`。
3. 将本地重组后的 `backend/uploads` 和新后端代码一起上传。
4. 文件同步使用增量模式，不使用 `--delete`。
5. 不要在服务器重复执行 `--apply`，先运行预演确认状态。
6. 抽查数据库 URL 对应文件存在后再恢复服务。

只部署代码、不部署重组后的文件，会导致新数据库 URL 指向不存在的服务器路径。

### 上传目录权限

后端必须以固定的非 root 服务用户运行，并且该用户对业务上传目录具有创建目录、写入、重命名和删除文件的权限。不要用 `chmod 777` 规避权限问题。

以 Node/PM2 用户为 `www:www`、项目位于 `/www/wwwroot/api2025.com/backend` 为例，首次部署或修复目录权限时执行：

```bash
cd /www/wwwroot/api2025.com/backend

install -d -o www -g www -m 775 \
  uploads/shop \
  uploads/shop/template-staging \
  uploads/shop/h5_newimages

chown -R www:www uploads/shop/template-staging uploads/shop/h5_newimages
find uploads/shop -type d -exec chmod 775 {} \;
find uploads/shop -type f -exec chmod 664 {} \;
```

如配置了 `UPLOAD_PATH`，以上路径应替换为该变量实际指向的上传根目录。执行前应先确认服务用户和上传根目录：

```bash
ps -eo user,group,pid,args | grep '[n]ode'
```

保存报 `EACCES` 时，检查从上传根目录到目标目录的每一级权限，并用实际服务用户验证父目录可写：

```bash
namei -l /www/wwwroot/api2025.com/backend/uploads/shop/h5_newimages
sudo -u www test -w /www/wwwroot/api2025.com/backend/uploads/shop/h5_newimages \
  && echo '商城模板归档目录可写' \
  || echo '商城模板归档目录不可写'
```

目录修复后可以重新保存；通常无需重启 Node。若服务使用容器、挂载卷或独立 `UPLOAD_PATH`，还需确保挂载目标本身允许该服务用户写入。

## 当前迁移记录

截至 2026-08-30，本地文件与当前配置数据库已完成以下迁移：

| 模块 | 结果 |
|---|---|
| 国补照片 | 255 条记录、1459 张引用照片已按业务目录归档 |
| 二手机图片 | 899 张有效图片已归档 |
| 二手机视频 | 7 个有效视频已归档 |
| H5 商城 | 297 个模板媒体、3 张轮播图、3 张配置图已归档 |

已知历史异常：

- `H5_images` 有 9 条记录关联已不存在的手机 ID `15778`，对应物理文件缺失。
- `uploads/shop` 根目录有 3 个无数据库引用的历史文件。
- 上述异常未自动删除，必须人工确认。

## 验证清单

- [ ] 数据库中的每个上传 URL 都能解析到 `uploads` 内部。
- [ ] URL 对应的物理文件存在。
- [ ] 二手机目录符合 `序列号-YYYYMMDD`。
- [ ] 商品模板目录符合 `品牌-型号-颜色`。
- [ ] 模板媒体取消后，草稿表记录和暂存文件均被删除；保存后只存在正式媒体记录。
- [ ] 迁移预演显示待迁移数量为 `0`。
- [ ] 新增上传、取消新增、编辑标识字段和删除记录均完成回归。
- [ ] 前端类型检查与媒体存储专项测试通过。

## 更新日志

### 2026-09-24 - v1.1.0

- 说明 H5 模板媒体上传暂存和保存归档是两个不同写目录阶段。
- 补充部署 Node 服务用户目录权限、`EACCES` 诊断及修复命令。

### 2026-08-30 - v1.0.0

- 新增国补、手机媒体和 H5 商城目录规范。
- 新增上传生命周期、迁移命令和部署同步要求。
- 记录 2026-08-30 本地迁移结果与保留异常。
