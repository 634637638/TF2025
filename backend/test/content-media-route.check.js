const test = require('node:test')
const assert = require('node:assert/strict')
const ContentMediaController = require('../src/controllers/content-media.controller')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('内容媒体 controller 保持缺文件、签名错误和成功响应契约', async () => {
  let removedFiles = []
  const controller = new ContentMediaController({
    validateFileSignature: async () => false,
    removeFiles: async files => { removedFiles = files },
    createUploadUrl: (...segments) => `/uploads/${segments.join('/')}`
  })
  const response = createResponse()

  await controller.upload({ file: null }, response)
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.message, '请选择图片或视频')

  const uploadedFile = {
    path: '/tmp/content-media-file',
    filename: 'stored-file.png',
    originalname: 'folder/original.png',
    mimetype: 'image/png'
  }
  await controller.upload({ file: uploadedFile }, response)
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.message, '文件内容与图片或视频格式不匹配')
  assert.deepEqual(removedFiles, [uploadedFile])

  const validController = new ContentMediaController({
    validateFileSignature: async (_file, allowedKinds) => allowedKinds.join(',') === 'image,video',
    removeFiles: async () => assert.fail('有效媒体不应删除'),
    createUploadUrl: (...segments) => `/uploads/${segments.join('/')}`
  })
  await validController.upload({ file: uploadedFile }, response)
  assert.equal(response.body.success, true)
  assert.equal(response.body.message, '媒体上传成功')
  assert.deepEqual(response.body.data, {
    url: '/uploads/content-media/stored-file.png',
    name: 'original.png',
    mime: 'image/png'
  })
})

test('内容媒体签名检查异常会清理本次文件并返回 400', async () => {
  let removedFiles = []
  const controller = new ContentMediaController({
    validateFileSignature: async () => { throw new Error('文件读取失败') },
    removeFiles: async files => { removedFiles = files }
  })
  const file = { path: '/tmp/content-media-file', originalname: 'upload.png' }
  const response = createResponse()

  await controller.upload({ file }, response)

  assert.equal(response.statusCode, 400)
  assert.equal(response.body.message, '文件读取失败')
  assert.deepEqual(removedFiles, [file])
})
