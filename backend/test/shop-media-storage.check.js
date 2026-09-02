const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs').promises
const os = require('os')
const path = require('path')
const {
  buildShopTemplateDirectoryName,
  archiveShopAssetUpload,
  archiveShopTemplateUpload
} = require('../src/utils/shop-media-storage')

const withUploadsRoot = async callback => {
  const previousUploadPath = process.env.UPLOAD_PATH
  const uploadsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tf2025-shop-media-'))
  process.env.UPLOAD_PATH = uploadsRoot
  try {
    await callback(uploadsRoot)
  } finally {
    if (previousUploadPath === undefined) delete process.env.UPLOAD_PATH
    else process.env.UPLOAD_PATH = previousUploadPath
    await fs.rm(uploadsRoot, { recursive: true, force: true })
  }
}

test('shop template directory uses brand, model and color', () => {
  assert.equal(
    buildShopTemplateDirectoryName({
      brandName: '苹果',
      modelName: '17promax',
      colorName: '橙色'
    }),
    '苹果-17promax-橙色'
  )
})

test('shop assets and template media are archived by business module', async () => {
  await withUploadsRoot(async uploadsRoot => {
    const shopRoot = path.join(uploadsRoot, 'shop')
    await fs.mkdir(shopRoot, { recursive: true })

    const bannerFile = {
      filename: 'banner.jpg',
      path: path.join(shopRoot, 'banner.jpg')
    }
    await fs.writeFile(bannerFile.path, 'banner')
    assert.equal(
      await archiveShopAssetUpload({ file: bannerFile, moduleName: 'h5_banners' }),
      '/uploads/shop/h5_banners/banner.jpg'
    )
    await fs.access(bannerFile.path)

    const templateFile = {
      filename: 'product.jpg',
      path: path.join(shopRoot, 'product.jpg')
    }
    await fs.writeFile(templateFile.path, 'product')
    const database = {
      query: async () => [[{
        brand_name: '苹果',
        model_name: '17promax',
        color_name: '橙色'
      }]]
    }
    assert.equal(
      await archiveShopTemplateUpload({ file: templateFile, templateId: 1, database }),
      '/uploads/shop/h5_newimages/苹果-17promax-橙色/product.jpg'
    )
    await fs.access(templateFile.path)
  })
})
