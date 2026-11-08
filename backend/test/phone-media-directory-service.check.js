'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const syncPhoneMediaDirectory = require('../src/services/phone-media-directory.service')

test('phone media directory moves can be compensated when the surrounding transaction fails', async () => {
  const originalUploadPath = process.env.UPLOAD_PATH
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-media-update-'))
  process.env.UPLOAD_PATH = temporaryRoot
  const oldDirectory = path.join(temporaryRoot, 'phones', 'old')
  const sourcePath = path.join(oldDirectory, 'image.jpg')
  await fs.mkdir(oldDirectory, { recursive: true })
  await fs.writeFile(sourcePath, 'media')
  const repository = {
    async getManagedMedia() {
      return [{ id: 4, image_url: '/uploads/phones/old/image.jpg' }]
    },
    async updateMediaUrl() {}
  }

  try {
    const actions = await syncPhoneMediaDirectory(4, {
      is_new: 1,
      serial_number: 'SERIAL4',
      inventory_time: '2026-11-08'
    }, {}, repository)
    assert.equal(await fs.readFile(sourcePath, 'utf8').catch(() => null), null)

    await actions.rollback()
    assert.equal(await fs.readFile(sourcePath, 'utf8'), 'media')
    await assert.rejects(fs.access(path.join(temporaryRoot, 'phones', 'NEW-SERIAL4-20261108', 'image.jpg')))
  } finally {
    if (originalUploadPath === undefined) delete process.env.UPLOAD_PATH
    else process.env.UPLOAD_PATH = originalUploadPath
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
})
