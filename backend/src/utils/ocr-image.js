const sharp = require('sharp');
const Tesseract = require('tesseract.js');

function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'gif';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    return 'bmp';
  }
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return 'tiff';
  }

  return null;
}

function getBufferPreview(buffer, maxLength = 120) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return '';
  }

  return buffer
    .subarray(0, maxLength)
    .toString('utf8')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateImageResponse(response, log) {
  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  const imageBuffer = Buffer.isBuffer(response?.data) ? response.data : Buffer.from(response?.data || []);
  const detectedFormat = detectImageFormat(imageBuffer);

  if (response?.status && response.status >= 400) {
    throw new Error(`验证码响应异常，HTTP ${response.status}`);
  }

  if (imageBuffer.length < 32) {
    throw new Error(`验证码响应过小，只有 ${imageBuffer.length} 字节`);
  }

  if (contentType && !contentType.startsWith('image/') && !detectedFormat) {
    const preview = getBufferPreview(imageBuffer);
    throw new Error(`验证码响应不是图片，content-type=${contentType || 'unknown'}，响应片段=${preview || '(empty)'}`);
  }

  if (!detectedFormat) {
    const preview = getBufferPreview(imageBuffer);
    throw new Error(`无法识别验证码图片格式，响应片段=${preview || '(binary)'}`);
  }

  if (log) {
    log.debug(`🖼️ 验证码响应校验通过: format=${detectedFormat}, size=${imageBuffer.length} bytes, content-type=${contentType || 'unknown'}`);
  }

  return {
    buffer: imageBuffer,
    contentType,
    format: detectedFormat
  };
}

async function preprocessImageForOcr(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata || !metadata.width || !metadata.height) {
    throw new Error('图片缺少尺寸信息');
  }

  const width = Math.max(metadata.width * 2, metadata.width);
  const height = Math.max(metadata.height * 2, metadata.height);

  const processedBuffer = await sharp(imageBuffer)
    .resize(width, height, { fit: 'fill' })
    .grayscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();

  return {
    buffer: processedBuffer,
    metadata
  };
}

async function recognizeTextWithTesseract(imageBuffer, { logger, params = {} } = {}) {
  const worker = await Tesseract.createWorker('eng', 1, { logger });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '7',
      preserve_interword_spaces: '0',
      ...params
    });

    return await worker.recognize(imageBuffer);
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  detectImageFormat,
  getBufferPreview,
  preprocessImageForOcr,
  recognizeTextWithTesseract,
  validateImageResponse
};
