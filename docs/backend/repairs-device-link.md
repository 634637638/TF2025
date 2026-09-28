# 维修设备关联规范

维修单支持两种录入方式：

- 在“IMEI/序列号检索”中选择已有设备。接口返回设备的品牌、型号、颜色、内存、IMEI、序列号，以及最近销售记录对应的客户；选择后这些字段会带入表单。
- 没有匹配设备时手动填写客户、品牌、型号、颜色、内存、IMEI、序列号和故障描述。设备关联可以保持为空。

维修记录通过 `phone_id` 记录与库存设备的关系，展示字段使用 `serial_number`、`color_id`、`memory_id` 等规范字段。设备检索接口为 `GET /api/repairs/devices/search?q=...`，至少输入 2 个字符；它只读，不改变库存状态。

`repairs` 表的设备关联、媒体和维修时间字段 `phone_id`、`serial_number`、`color_id`、`memory_id`、`photos`、`repair_time` 必须通过独立迁移脚本增加。脚本默认只检查并输出缺失字段，不修改数据库；确认后加 `--apply` 才会添加缺失列：

```bash
node backend/scripts/migrate-repair-device-fields.js
node backend/scripts/migrate-repair-device-fields.js --apply
```

`phone_id` 使用可空整数，兼容没有关联库存设备的现场维修；`photos` 使用可空文本保存 JSON 媒体数组，兼容已有 MySQL/MariaDB 版本。`repair_time` 使用可空日期时间字段；迁移会以原 `created_at` 回填空值，保留旧数据原先展示的维修日期。重复执行安全：只添加当前缺少的字段，且只回填 `repair_time IS NULL` 的记录。维修接口会在请求时检查必需列，但不会执行 DDL；部署时应先运行 dry-run，再备份数据库并执行 `--apply`，随后重启服务并检查维修列表、新增、编辑和媒体读取。

请求接口不会执行建表或改表操作。删除维修单仍使用 `repairs:delete` 权限，并以 `cancelled` 软删除；已完成维修单只显示删除按钮但不可执行删除。

## 维修时间和媒体留痕

维修时间使用独立的 `repair_time` 字段，由全局时间工具格式化展示；`created_at` 始终表示维修单实际创建时间。新建和编辑时可以手动选择维修时间，维修列表及字段权限配置只展示维修时间，不返回更新时间或完成时间；修改维修时间不会改动创建时间。数据库仍保留 `updated_at` 和 `completed_at` 供自动维护及完工流程使用。维修费用只保留实际发生的“维修费”，不再维护预计费用。

维修照片和视频保存在 `repairs.photos` JSON 字段中，媒体对象统一为：

```json
{
  "url": "/api/repairs/media/12/example.jpg",
  "type": "image",
  "name": "example.jpg"
}
```

上传接口为 `POST /api/repairs/upload/media`，字段名为 `files`，支持多选图片和视频，单文件最大 100MB，上传先进入 `uploads/repairs/temp`。维修单保存成功后，临时文件会移动到对应维修单目录；关闭新增、编辑或媒体管理窗口而未保存时，前端会调用通用临时文件清理接口，避免留下无主文件。

维修表格的“媒体”按钮可查看已有照片和视频；拥有 `repairs:edit` 权限的用户可以继续上传、删除并保存。移动端沿用国补的单一上传入口，系统文件选择器会提供拍照入口，拍摄后直接上传。字段权限对应 `repairs_repairsview` 模块的 `repair_info.photos`。

维修客户使用远程姓名/手机号检索，不再预加载固定数量的客户。选中客户后姓名和手机号自动回填；没有匹配项时可在维修表单直接新建客户，保存成功后自动选中。检索接口为 `GET /api/repairs/customers/search?keyword=...`，新建接口为 `POST /api/repairs/customers`，由 `repairs:create` 权限保护。

故障字段支持多选：换屏幕、换电池、维修主板、换框、更换相机、维修尾插、换听筒、换扬声器，也可以搜索或输入自定义项目。多个项目使用 `、` 保存到原 `problem_description` 文本列，兼容历史记录和现有搜索接口。
