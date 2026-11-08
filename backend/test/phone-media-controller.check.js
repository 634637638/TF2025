const test = require('node:test')
const assert = require('node:assert/strict')
const { createUploadHandler } = require('../src/controllers/phone-media.controller')

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

test('手机媒体上传 controller 校验文件、透传上传者并返回既有响应字段', async () => {
  const removedFiles = []
  let saveArgs
  const uploadImage = createUploadHandler({
    mediaType: 'image',
    mediaLabel: '图片',
    validateSignature: async () => true,
    removeFiles: async files => removedFiles.push(...files),
    saveMedia: async args => {
      saveArgs = args
      return { id: 42, url: '/uploads/phones/phone.jpg' }
    },
    logger: { error() {} }
  })
  const file = { filename: 'phone.jpg', originalname: 'device.jpg', size: 123 }
  const response = createResponse()

  await uploadImage({ params: { id: '7' }, user: { id: 19 }, file }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.message, '图片上传成功')
  assert.deepEqual(response.body.data, {
    id: 42,
    url: '/uploads/phones/phone.jpg',
    filename: 'phone.jpg',
    originalname: 'device.jpg',
    size: 123
  })
  assert.deepEqual(saveArgs, {
    phoneId: '7',
    file,
    mediaType: 'inventory',
    uploadedBy: 19
  })
  assert.deepEqual(removedFiles, [])
})

test('手机媒体上传 controller 缺文件和签名无效时拒绝并清理无效文件', async () => {
  const removedFiles = []
  const uploadVideo = createUploadHandler({
    mediaType: 'video',
    mediaLabel: '视频',
    validateSignature: async () => false,
    removeFiles: async files => removedFiles.push(...files),
    saveMedia: async () => assert.fail('签名无效时不能归档'),
    logger: { error() {} }
  })
  const missingFile = createResponse()
  await uploadVideo({ params: { id: '7' }, user: { id: 19 } }, missingFile)
  assert.equal(missingFile.statusCode, 400)
  assert.equal(missingFile.body.message, '没有上传文件')

  const file = { filename: 'invalid.mp4' }
  const invalidSignature = createResponse()
  await uploadVideo({ params: { id: '7' }, file }, invalidSignature)
  assert.equal(invalidSignature.statusCode, 400)
  assert.equal(invalidSignature.body.message, '文件内容与视频格式不匹配')
  assert.deepEqual(removedFiles, [file])
})

test('手机媒体归档失败时 controller 清理上传文件并返回服务端错误', async () => {
  const removedFiles = []
  const uploadImage = createUploadHandler({
    mediaType: 'image',
    mediaLabel: '图片',
    validateSignature: async () => true,
    removeFiles: async files => removedFiles.push(...files),
    saveMedia: async () => { throw new Error('归档失败') },
    logger: { error() {} }
  })
  const file = { filename: 'phone.jpg' }
  const response = createResponse()

  await uploadImage({ params: { id: '7' }, file }, response)

  assert.equal(response.statusCode, 500)
  assert.equal(response.body.message, '服务器内部错误，请稍后重试')
  assert.deepEqual(removedFiles, [file])
})
