const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const sharedService = require('../services/shared.service');
const { getUploadSubdir, getUploadUrl } = require('../utils/upload-paths');

const uploadDir = getUploadSubdir('shared');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const allowedExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov',
  '.pdf', '.ofd', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx',
  '.wps', '.et', '.dps', '.txt', '.md', '.rtf', '.log', '.json', '.xml',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.epub',
  '.mp3', '.wav', '.m4a', '.aac', '.flac'
]);
const allowedMimePrefixes = ['image/', 'video/', 'audio/'];
const allowedMimes = new Set([
  'application/pdf', 'application/ofd',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/kswps', 'application/kset', 'application/ksdps',
  'application/vnd.ms-works', 'application/x-wps', 'application/x-et', 'application/x-dps',
  'text/plain', 'text/csv', 'application/csv', 'text/markdown', 'text/rtf', 'application/rtf',
  'application/json', 'application/xml', 'text/xml',
  'application/zip', 'application/x-zip-compressed', 'application/vnd.rar',
  'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar',
  'application/gzip', 'application/x-gzip', 'application/x-bzip2', 'application/epub+zip',
  'application/octet-stream'
]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Number(req.user?.id) || 0}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.has(ext) && (allowedMimePrefixes.some(prefix => file.mimetype.startsWith(prefix)) || allowedMimes.has(file.mimetype))) return cb(null, true);
    return cb(new Error('仅支持图片、视频和常用文档文件'));
  }
});

const canManage = req => Array.isArray(req.user?.permissions) && req.user.permissions.includes('shared_sharedview:manage');
const handleError = (res, error, fallback = '操作失败') => {
  const message = error?.message || fallback;
  const status = /请输入|不能为空|不能超过|只能|不存在|仅支持|已存在|不能修改|不能删除/.test(message) ? 400 : 500;
  return ApiResponse.error(res, message, status);
};

router.use('/files', (req, _res, next) => {
  const rawToken = Array.isArray(req.query.token) ? req.query.token.at(-1) : req.query.token;
  if (!req.headers.authorization && typeof rawToken === 'string' && rawToken.trim()) {
    req.headers.authorization = `Bearer ${rawToken.trim()}`;
  }
  next();
});
router.use(unifiedAuth);
router.get('/', requirePermission('shared:view'), async (req, res) => { try { const result = await sharedService.list(req.user.id, req.query); return ApiResponse.success(res, result.rows, '获取经验分享成功', 200, { pagination: result.pagination }); } catch (error) { return handleError(res, error, '获取经验分享失败'); } });
router.get('/categories', requirePermission('shared:view'), async (req, res) => { try { return ApiResponse.success(res, await sharedService.listCategories(req.user.id), '获取分享分类成功'); } catch (error) { return handleError(res, error, '获取分享分类失败'); } });
router.post('/categories', requirePermission('shared:manage'), async (req, res) => { try { return ApiResponse.created(res, '分类新增成功', await sharedService.createCategory(req.body)); } catch (error) { return handleError(res, error, '新增分类失败'); } });
router.put('/categories/:id', requirePermission('shared:manage'), async (req, res) => { try { return ApiResponse.success(res, await sharedService.updateCategory(Number(req.params.id), req.body), '分类更新成功'); } catch (error) { return handleError(res, error, '更新分类失败'); } });
router.delete('/categories/:id', requirePermission('shared:manage'), async (req, res) => { try { await sharedService.removeCategory(Number(req.params.id)); return ApiResponse.success(res, null, '分类删除成功'); } catch (error) { return handleError(res, error, '删除分类失败'); } });
router.get('/files/:filename', requirePermission('shared:view'), async (req, res) => {
  try {
    const filename = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9._-]+$/.test(filename) || path.basename(filename) !== filename) {
      return ApiResponse.error(res, '无效的附件路径', 400);
    }
    const rawUrl = getUploadUrl('shared', filename);
    const access = await sharedService.canAccessAttachment(rawUrl, req.user.id);
    const belongsToUploader = filename.startsWith(`${Number(req.user.id)}_`);
    if (!access.referenced && !belongsToUploader) return ApiResponse.error(res, '附件不存在', 404);
    if (access.referenced && !access.allowed) return ApiResponse.error(res, '无权访问该附件', 403);
    const absolutePath = path.join(uploadDir, filename);
    if (!absolutePath.startsWith(`${path.normalize(uploadDir)}${path.sep}`) || !fs.existsSync(absolutePath)) {
      return ApiResponse.error(res, '附件不存在', 404);
    }
    return res.sendFile(absolutePath);
  } catch (error) {
    return handleError(res, error, '读取附件失败');
  }
});
router.get('/:id', requirePermission('shared:view'), async (req, res) => { try { const result = await sharedService.getById(Number(req.params.id), req.user.id); if (!result) return ApiResponse.error(res, '分享不存在', 404); return ApiResponse.success(res, result, '获取分享详情成功'); } catch (error) { return handleError(res, error, '获取分享详情失败'); } });
router.post('/upload', requireAnyPermission(['shared:create', 'shared:edit', 'shared:manage']), upload.array('files', 10), async (req, res) => { try { const files = (req.files || []).map(file => ({ url: getUploadUrl('shared', file.filename), name: file.originalname, type: file.mimetype, size: file.size })); return ApiResponse.success(res, files, '附件上传成功'); } catch (error) { for (const file of req.files || []) { try { fs.unlinkSync(file.path); } catch (_) {} } return handleError(res, error, '附件上传失败'); } });
router.post('/uploads/cleanup', requireAnyPermission(['shared:create', 'shared:edit', 'shared:delete', 'shared:manage']), async (req, res) => { try { const urls = Array.isArray(req.body?.urls) ? req.body.urls : []; await sharedService.cleanupUploads(urls, req.user.id); return ApiResponse.success(res, null, '未使用附件已清理'); } catch (error) { return handleError(res, error, '附件清理失败'); } });
router.post('/', requirePermission('shared:create'), async (req, res) => { try { return ApiResponse.created(res, '经验分享发布成功', await sharedService.create(req.user.id, canManage(req), req.body)); } catch (error) { return handleError(res, error, '经验分享发布失败'); } });
router.put('/:id', requireAnyPermission(['shared:edit', 'shared:manage']), async (req, res) => { try { return ApiResponse.success(res, await sharedService.update(Number(req.params.id), req.user.id, canManage(req), req.body), '经验分享更新成功'); } catch (error) { return handleError(res, error, '经验分享更新失败'); } });
router.delete('/:id', requireAnyPermission(['shared:delete', 'shared:manage']), async (req, res) => { try { await sharedService.remove(Number(req.params.id), req.user.id, canManage(req)); return ApiResponse.success(res, null, '经验分享已删除'); } catch (error) { return handleError(res, error, '经验分享删除失败'); } });
router.patch('/:id/pin', requirePermission('shared:manage'), async (req, res) => { try { await sharedService.pin(Number(req.params.id), Boolean(req.body?.pinned), req.user.id); return ApiResponse.success(res, null, '置顶状态已更新'); } catch (error) { return handleError(res, error, '置顶操作失败'); } });

module.exports = router;
