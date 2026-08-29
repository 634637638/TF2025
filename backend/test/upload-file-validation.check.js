const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateUploadedFileSignature } = require('../src/utils/upload-file-validation');

async function withUpload(bytes, originalname, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf2025-upload-test-'));
  const filePath = path.join(directory, 'upload');
  await fs.writeFile(filePath, Buffer.from(bytes));

  try {
    return await callback({ path: filePath, originalname });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('accepts supported image signatures with matching extensions', async () => {
  const jpeg = await withUpload([0xff, 0xd8, 0xff, 0xe0], 'photo.jpeg', file =>
    validateUploadedFileSignature(file, ['image'])
  );
  const png = await withUpload(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'photo.png',
    file => validateUploadedFileSignature(file, ['image'])
  );

  assert.equal(jpeg, true);
  assert.equal(png, true);
});

test('accepts supported PDF and MP4 signatures', async () => {
  const pdf = await withUpload(Buffer.from('%PDF-1.7\n'), 'contract.pdf', file =>
    validateUploadedFileSignature(file, ['pdf'])
  );
  const mp4 = await withUpload(
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
    'demo.mp4',
    file => validateUploadedFileSignature(file, ['video'])
  );

  assert.equal(pdf, true);
  assert.equal(mp4, true);
});

test('rejects spoofed extensions and disallowed content kinds', async () => {
  const spoofedImage = await withUpload([0xff, 0xd8, 0xff, 0xe0], 'photo.png', file =>
    validateUploadedFileSignature(file, ['image'])
  );
  const videoAsImage = await withUpload(
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
    'demo.mp4',
    file => validateUploadedFileSignature(file, ['image'])
  );
  const webmAsMp4 = await withUpload(
    [0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01],
    'demo.mp4',
    file => validateUploadedFileSignature(file, ['video'])
  );

  assert.equal(spoofedImage, false);
  assert.equal(videoAsImage, false);
  assert.equal(webmAsMp4, false);
});
