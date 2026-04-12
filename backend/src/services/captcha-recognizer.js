/**
 * 验证码识别模块
 * 使用Tesseract.js识别数字验证码
 */

const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const log = require('../utils/log');

class CaptchaRecognizer {
  constructor() {
    // 验证码图片缓存目录
    this.cacheDir = path.join(__dirname, '../../logs/captcha-cache');
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  /**
   * 获取验证码图片
   * @param {string} captchaUrl - 验证码图片URL
   * @param {string} referer - referer头
   * @returns {Buffer} 图片数据
   */
  async fetchCaptchaImage(captchaUrl, referer = '') {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };

    if (referer) {
      headers['Referer'] = referer;
    }

    const response = await axios.get(captchaUrl, {
      headers,
      responseType: 'arraybuffer',
      validateStatus: (status) => status < 500
    });

    return Buffer.from(response.data);
  }

  /**
   * 识别验证码
   * @param {string} captchaUrl - 验证码图片URL
   * @param {string} referer - referer头
   * @returns {string} 识别结果
   */
  async recognize(captchaUrl, referer = '') {
    try {
      log.debug('🔍 开始识别验证码...');

      // 1. 获取验证码图片
      const imageBuffer = await this.fetchCaptchaImage(captchaUrl, referer);

      // 2. 保存图片到缓存（用于调试）
      const timestamp = Date.now();
      const cachePath = path.join(this.cacheDir, `captcha-${timestamp}.jpg`);
      fs.writeFileSync(cachePath, imageBuffer);
      log.debug(`📸 验证码已保存: ${cachePath}`);

      // 3. 使用Tesseract识别
      // 由于是数字验证码，设置识别白名单为数字
      const result = await Tesseract.recognize(
        imageBuffer,
        'eng',  // 使用英文语言包（数字识别）
        {
          logger: (m) => {
            // 只在关键步骤输出日志
            if (m.status === 'recognizing text') {
              log.debug(`   识别进度: ${Math.round(m.progress * 100)}%`);
            }
          },
          // 优化参数以提高数字识别准确率
          options: {
            tessedit_char_whitelist: '0123456789',  // 只识别数字
            tessedit_pageseg_mode: '7',  // 单行文本模式
            preserve_interword_spaces: '0',
          }
        }
      );

      const rawText = result.data.text;
      log.debug(`📝 原始识别结果: "${rawText}"`);

      // 4. 清理识别结果：提取数字，去除空格和换行
      let code = rawText.replace(/[^0-9]/g, '');

      // 5. 验证码长度验证（通常4位）
      if (code.length === 0) {
        log.warn('⚠️ 未能识别出数字，返回空字符串');
        return '';
      } else if (code.length < 4) {
        log.warn(`⚠️ 识别结果过短 (${code.length}位)，可能不准确`);
      } else if (code.length > 4) {
        // 如果识别出多位，取前4位
        code = code.substring(0, 4);
        log.warn(`⚠️ 识别结果过长，截取前4位: ${code}`);
      }

      log.debug(`✅ 识别结果: ${code}`);
      return code;

    } catch (error) {
      log.error('❌ 验证码识别失败:', error.message);
      return '';
    }
  }

  /**
   * 批量识别验证码（用于测试）
   * @param {number} count - 识别次数
   * @param {string} captchaUrl - 验证码URL模板
   */
  async batchRecognize(count = 5, captchaUrl = 'https://81119.byb2b.cn/image.jsp?t=') {
    log.debug(`\n🔄 开始批量识别测试 (${count}次)`);

    const results = [];
    for (let i = 0; i < count; i++) {
      log.debug(`\n--- 第 ${i + 1}/${count} 次识别 ---`);
      const url = `${captchaUrl}${Date.now()}`;
      const code = await this.recognize(url, 'https://81119.byb2b.cn/index.htm?ykflag=Y');
      results.push({
        index: i + 1,
        code: code,
        success: code.length === 4,
        timestamp: new Date().toISOString()
      });

      // 等待1秒再进行下一次
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 输出统计
    log.debug('\n' + '='.repeat(60));
    log.debug('识别结果统计:');
    log.debug('='.repeat(60));
    results.forEach(r => {
      log.debug(`${r.index}. ${r.code || '(失败)'} ${r.success ? '✅' : '❌'}`);
    });

    const successCount = results.filter(r => r.success).length;
    log.debug(`\n成功率: ${successCount}/${count} (${Math.round(successCount/count*100)}%)`);

    return results;
  }
}

module.exports = CaptchaRecognizer;
