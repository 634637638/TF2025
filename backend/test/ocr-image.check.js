'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const sharp = require('sharp')
const Tesseract = require('tesseract.js')
const { detectImageFormat, preprocessImageForOcr, recognizeTextWithTesseract } = require('../src/utils/ocr-image')

test('OCR 预处理接收图片 Buffer 并使用 sharp 输出放大后的 PNG', async () => {
  const image = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer()
  const result = await preprocessImageForOcr(image)
  assert.equal(detectImageFormat(result.buffer), 'png')
  const output = await sharp(result.buffer).metadata()
  assert.equal(output.width, 40)
  assert.equal(output.height, 20)
  assert.equal(result.metadata.width, 20)
})

test('OCR 使用英文 worker、可调用默认 logger，并在识别成功后释放 worker', async t => {
  const events = []
  const image = Buffer.from('mock-image-buffer')
  const result = { data: { text: '1234' } }
  t.mock.method(Tesseract, 'createWorker', async (language, engine, options) => {
    assert.equal(language, 'eng')
    assert.equal(engine, 1)
    assert.equal(typeof options.logger, 'function')
    options.logger({ status: 'recognizing text' })
    return {
      async setParameters(params) { events.push('parameters'); assert.equal(params.tessedit_char_whitelist, '0123456789') },
      async recognize(buffer) { events.push('recognize'); assert.equal(buffer, image); return result },
      async terminate() { events.push('terminate') }
    }
  })
  assert.equal(await recognizeTextWithTesseract(image, { params: { tessedit_char_whitelist: '0123456789' } }), result)
  assert.deepEqual(events, ['parameters', 'recognize', 'terminate'])
})

test('OCR 参数设置或识别失败仍释放 worker 并传播异常', async t => {
  for (const stage of ['parameters', 'recognize']) {
    const error = new Error(stage)
    let released = 0
    const mocked = t.mock.method(Tesseract, 'createWorker', async () => ({
      async setParameters() { if (stage === 'parameters') throw error },
      async recognize() { throw error },
      async terminate() { released++ }
    }))
    await assert.rejects(recognizeTextWithTesseract(Buffer.from('image')), error)
    assert.equal(released, 1)
    mocked.mock.restore()
  }
})
