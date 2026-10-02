const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs').promises
const os = require('os')
const path = require('path')
const {
  buildPhoneMediaDirectoryName,
  archivePhoneMediaUpload
} = require('../src/utils/phone-media-storage')

test('used phone media is archived by serial number and inventory date', async () => {
  const previousUploadPath = process.env.UPLOAD_PATH
  const uploadsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tf2025-phone-media-'))
  process.env.UPLOAD_PATH = uploadsRoot

  try {
    const sourceDirectory = path.join(uploadsRoot, 'phones')
    const sourcePath = path.join(sourceDirectory, 'phone-test.jpg')
    await fs.mkdir(sourceDirectory, { recursive: true })
    await fs.writeFile(sourcePath, 'test image')

    const file = {
      path: sourcePath,
      filename: 'phone-test.jpg'
    }
    const database = {
      query: async () => [[{
        serial_number: 'FFMXNCF9JC6G',
        inventory_time: '2026-04-25 12:30:00',
        is_new: 0
      }]]
    }

    const fileUrl = await archivePhoneMediaUpload({
      phoneId: 1,
      file,
      mediaRoot: 'phones',
      database
    })

    const expectedDirectory = path.join(uploadsRoot, 'phones', 'FFMXNCF9JC6G-20260425')
    assert.equal(
      buildPhoneMediaDirectoryName({
        serialNumber: 'FFMXNCF9JC6G',
        inventoryTime: '2026-04-25 12:30:00'
      }),
      'FFMXNCF9JC6G-20260425'
    )
    assert.equal(fileUrl, '/uploads/phones/FFMXNCF9JC6G-20260425/phone-test.jpg')
    assert.equal(file.path, path.join(expectedDirectory, 'phone-test.jpg'))
    await fs.access(file.path)
    await assert.rejects(fs.access(sourcePath))
  } finally {
    if (previousUploadPath === undefined) delete process.env.UPLOAD_PATH
    else process.env.UPLOAD_PATH = previousUploadPath
    await fs.rm(uploadsRoot, { recursive: true, force: true })
  }
})

test('new phone media uses the same archive layout with a NEW directory prefix', async () => {
  const previousUploadPath = process.env.UPLOAD_PATH
  const uploadsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tf2025-new-phone-media-'))
  process.env.UPLOAD_PATH = uploadsRoot

  try {
    const sourceDirectory = path.join(uploadsRoot, 'phones')
    const sourcePath = path.join(sourceDirectory, 'phone-new.jpg')
    await fs.mkdir(sourceDirectory, { recursive: true })
    await fs.writeFile(sourcePath, 'test image')

    const file = {
      path: sourcePath,
      filename: 'phone-new.jpg'
    }
    const database = {
      query: async () => [[{
        serial_number: 'FG1G212K0DYQ',
        inventory_time: '2026-05-15 12:30:00',
        is_new: 1
      }]]
    }

    const fileUrl = await archivePhoneMediaUpload({
      phoneId: 2,
      file,
      mediaRoot: 'phones',
      database
    })

    const expectedDirectory = path.join(uploadsRoot, 'phones', 'NEW-FG1G212K0DYQ-20260515')
    assert.equal(
      buildPhoneMediaDirectoryName({
        serialNumber: 'FG1G212K0DYQ',
        inventoryTime: '2026-05-15 12:30:00',
        isNew: 1
      }),
      'NEW-FG1G212K0DYQ-20260515'
    )
    assert.equal(fileUrl, '/uploads/phones/NEW-FG1G212K0DYQ-20260515/phone-new.jpg')
    assert.equal(file.path, path.join(expectedDirectory, 'phone-new.jpg'))
    await fs.access(file.path)
    await assert.rejects(fs.access(sourcePath))
  } finally {
    if (previousUploadPath === undefined) delete process.env.UPLOAD_PATH
    else process.env.UPLOAD_PATH = previousUploadPath
    await fs.rm(uploadsRoot, { recursive: true, force: true })
  }
})
