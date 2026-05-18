/**
 * HTTP 登录服务（带验证码识别）
 * 使用 HTTP POST 请求直接登录，使用 Tesseract.js 识别验证码
 * 不依赖 Puppeteer/Chrome，适合资源有限的云端服务器
 */

const axios = require('axios');
const cheerio = require('cheerio');
const log = require('../utils/log');
const {
  preprocessImageForOcr,
  recognizeTextWithTesseract,
  validateImageResponse
} = require('../utils/ocr-image');

class HttpLoginService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * 使用 HTTP POST 登录（带验证码识别）
   * @param {Object} config - 登录配置
   * @returns {Promise<Object>} 登录结果
   */
  async login(config) {
    // 🔥 云端环境优化：整体登录重试机制（包含重新获取验证码）
    const maxLoginAttempts = 3;

    for (let attempt = 1; attempt <= maxLoginAttempts; attempt++) {
      log.debug(`\n🔐 登录尝试 ${attempt}/${maxLoginAttempts}...`);

      const result = await this.performLogin(config, attempt);

      if (result.success) {
        log.debug(`✅ 登录成功（第 ${attempt} 次尝试）`);
        return result;
      }

      // 如果最后一次尝试也失败了，返回错误
      if (attempt === maxLoginAttempts) {
        log.error(`❌ 所有 ${maxLoginAttempts} 次登录尝试均失败`);
        return {
          success: false,
          error: result.error || '登录验证失败',
          debug: result.debug
        };
      }

      // 等待后重试
      log.debug(`⚠️ 第 ${attempt} 次登录失败，2秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * 执行单次登录尝试
   * @param {Object} config - 登录配置
   * @param {number} attemptNumber - 尝试次数（用于日志）
   * @returns {Promise<Object>} 登录结果
   */
  async performLogin(config, attemptNumber = 1) {
    try {
      log.debug(`🔐 执行第 ${attemptNumber} 次登录尝试...`);
      log.debug('  登录URL:', config.login_url);
      log.debug('  用户名:', config.login_username);

      // Cookie 存储
      const cookies = new Map();

      // 创建 axios 实例
      const axiosInstance = axios.create({
        withCredentials: true,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'keep-alive'
        },
        timeout: 30000,
        maxRedirects: 5
      });

      // 拦截器保存 cookies
      axiosInstance.interceptors.response.use(
        response => {
          if (response.headers['set-cookie']) {
            log.debug('📦 收到cookies，数量:', response.headers['set-cookie'].length);
            const cookieHeaders = Array.isArray(response.headers['set-cookie'])
              ? response.headers['set-cookie']
              : [response.headers['set-cookie']];
            cookieHeaders.forEach(cookie => {
              log.debug('   Cookie原始值:', cookie);
              const match = cookie.match(/^([^=]+)=([^;]+)/);
              if (match) {
                cookies.set(match[1], match[2]);
                log.debug('   解析后:', match[1], '=', match[2]);
              }
            });
          }
          return response;
        }
      );
      // 请求前自动附带 cookies（保持与登录页同一会话）
      axiosInstance.interceptors.request.use(requestConfig => {
        if (cookies.size > 0) {
          const cookieString = Array.from(cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
          requestConfig.headers = requestConfig.headers || {};
          if (!requestConfig.headers['Cookie']) {
            requestConfig.headers['Cookie'] = cookieString;
          }
        }
        return requestConfig;
      });

      // 第一步：获取登录页面
      log.debug('📄 步骤1: 获取登录页面...');
      const pageResponse = await axiosInstance.get(config.login_url);
      const $ = cheerio.load(pageResponse.data);

      // 提取表单参数
      const csrfToken = $('input[name="csrfmiddlewaretoken"], input[name="_token"], input[name="csrf_token"]').val();
      const viewState = $('input[name="__VIEWSTATE"]').val();
      const eventValidation = $('input[name="__EVENTVALIDATION"]').val();

      // 🔍 调试：显示所有表单字段
      log.debug('📋 页面表单字段分析:');
      $('input').each((i, el) => {
        const name = $(el).attr('name');
        const type = $(el).attr('type');
        const id = $(el).attr('id');
        if (name || id) {
          log.debug(`   [${i}] name="${name || ''}" id="${id || ''}" type="${type || 'text'}"`);
        }
      });

      log.debug('📋 提取的CSRF Token:', csrfToken || '无');
      log.debug('📋 提取的VIEWSTATE:', viewState ? '有' : '无');

      // 查找验证码图片
      const captchaImg = $('img[src*="captcha"], img[src*="code"], img[src*="verify"], img#imgVerify').first();
      const captchaSrc = captchaImg.attr('src');

      log.debug('📋 验证码图片元素数量:', $('img').length);
      log.debug('📋 找到的验证码图片src:', captchaSrc || '无');
      let captchaCode = '';

      if (captchaSrc) {
        log.debug('🔍 发现验证码图片，开始识别...');
        log.debug('   验证码src:', captchaSrc);

        // 构造验证码图片完整URL
        const captchaUrl = captchaSrc.startsWith('http')
          ? captchaSrc
          : new URL(captchaSrc, config.login_url).href;

        log.debug('   验证码完整URL:', captchaUrl);

        // 🔥 尝试多次识别验证码（最多5次，适应云端环境）
        let captchaAttempts = 0;
        const maxAttempts = 5;

        while (captchaAttempts < maxAttempts && !captchaCode) {
          captchaAttempts++;
          log.debug(`   🔄 第${captchaAttempts}次尝试识别验证码...`);

          // 识别验证码
          captchaCode = await this.recognizeCaptcha(captchaUrl, axiosInstance, config.login_url);

          if (captchaCode && captchaCode.length === 4) {
            log.debug('✅ 验证码识别成功:', captchaCode);
            break;
          } else if (captchaAttempts < maxAttempts) {
            log.debug('⚠️ 验证码识别失败，准备重试...');
            await new Promise(resolve => setTimeout(resolve, 1500)); // 等待1.5秒后重试
          }
        }

        if (!captchaCode || captchaCode.length !== 4) {
          log.debug('❌ 验证码识别失败，已尝试' + maxAttempts + '次');
          log.debug('💡 云端环境提示: 验证码识别可能不稳定，建议：');
          log.debug('   1. 检查 tesseract.js 是否正确安装');
          log.debug('   2. 检查网络连接是否稳定');
          log.debug('   3. 考虑使用固定验证码或白名单方案');
        } else {
          log.debug('✅ 验证码最终识别结果:', captchaCode);
        }
      } else {
        log.debug('ℹ️ 未发现验证码图片');
      }

      // 第二步：构造登录 POST 数据
      log.debug('📋 构造登录POST数据...');

      // 🔍 先定位登录表单（优先包含密码框的 form）
      const formWithPassword = $('form').filter((_, el) => $(el).find('input[type="password"]').length > 0).first();
      const $form = formWithPassword.length > 0 ? formWithPassword : $('form').first();
      const formAction = $form.attr('action') || config.login_url;
      const formMethod = ($form.attr('method') || 'post').toLowerCase();
      const loginActionUrl = formAction.startsWith('http')
        ? formAction
        : new URL(formAction, config.login_url).href;
      log.debug('📋 登录表单信息:', { action: formAction || '无', method: formMethod });

      // 🔍 收集表单字段
      const formFields = [];
      $form.find('input').each((_, el) => {
        const name = $(el).attr('name');
        const id = $(el).attr('id');
        const type = ($(el).attr('type') || 'text').toLowerCase();
        const value = $(el).attr('value');
        if (name || id) {
          formFields.push({ name, id, type, value });
        }
      });
      log.debug('📋 表单中的字段:', formFields.map(f => ({ name: f.name, id: f.id, type: f.type })));

      // 先用页面已有的 input 值初始化（保留隐藏字段/Token）
      const loginData = {};
      for (const field of formFields) {
        if (field.name) {
          loginData[field.name] = field.value || '';
        }
      }

      const normalize = (value) => (value || '').toLowerCase();
      const isCaptchaField = (field) => /captcha|verify|code|edtsign|sign|yzm|vcode|checkcode|seccode/.test(normalize(field.name) + ' ' + normalize(field.id));
      const isPasswordField = (field) => field.type === 'password' || /pass|pwd/.test(normalize(field.name) + ' ' + normalize(field.id));
      const isUsernameField = (field) => {
        const key = normalize(field.name) + ' ' + normalize(field.id);
        if (field.type === 'hidden' || isCaptchaField(field) || isPasswordField(field)) {
          return false;
        }
        return /user|login|account|name|uname|username|dhhm|mobile|phone|tel|email/.test(key);
      };

      const passwordField = formFields.find(isPasswordField);
      let usernameField = formFields.find(isUsernameField);
      const captchaField = formFields.find(isCaptchaField);
      const jiqimaField = formFields.find(f => /jiqima/.test(normalize(f.name) + ' ' + normalize(f.id)));

      // 如果没识别到用户名字段，选第一个非隐藏的文本输入（排除验证码）
      if (!usernameField) {
        usernameField = formFields.find(f => {
          const type = normalize(f.type);
          if (type === 'hidden' || type === 'password') return false;
          if (isCaptchaField(f)) return false;
          return type === 'text' || type === 'email' || type === 'tel' || type === '';
        });
      }

      log.debug('📋 字段识别结果:', {
        usernameField: usernameField?.name || usernameField?.id || '未识别',
        passwordField: passwordField?.name || passwordField?.id || '未识别',
        captchaField: captchaField?.name || captchaField?.id || '未识别',
        jiqimaField: jiqimaField?.name || jiqimaField?.id || '未识别'
      });

      // 填充用户名/密码
      if (usernameField?.name) {
        loginData[usernameField.name] = config.login_username;
      } else {
        loginData.username = config.login_username;
      }
      if (passwordField?.name) {
        loginData[passwordField.name] = config.login_password;
      } else {
        loginData.password = config.login_password;
      }

      // 添加验证码
      if (captchaCode) {
        if (captchaField?.name) {
          loginData[captchaField.name] = captchaCode;
        } else {
          loginData.captcha = captchaCode;
          loginData.code = captchaCode;
          loginData.verifycode = captchaCode;
          loginData.edtSign = captchaCode; // 添加常见的验证码字段名
        }
      }

      // 如果存在 jiqima 字段，填充为当前时间戳（模拟前端逻辑）
      if (jiqimaField?.name) {
        loginData[jiqimaField.name] = Date.now().toString();
      }

      // 添加 CSRF token（仅在未从表单初始化时补充）
      if (csrfToken && !loginData.csrfmiddlewaretoken && !loginData._token && !loginData.csrf_token) {
        loginData.csrfmiddlewaretoken = csrfToken;
        loginData._token = csrfToken;
        loginData.csrf_token = csrfToken;
      }

      // 添加 ASP.NET 参数（仅在未从表单初始化时补充）
      if (viewState && !loginData.__VIEWSTATE) {
        loginData.__VIEWSTATE = viewState;
      }
      if (eventValidation && !loginData.__EVENTVALIDATION) {
        loginData.__EVENTVALIDATION = eventValidation;
      }

      log.debug('📋 最终POST数据字段:', Object.keys(loginData));
      log.debug('📋 POST数据（隐藏密码）:', Object.entries(loginData).map(([k, v]) => {
        if (k.toLowerCase().includes('pass') || k.toLowerCase().includes('pwd')) {
          return `${k}=***`;
        }
        return `${k}=${v}`;
      }).join(', '));

      // 第三步：POST 登录请求
      log.debug('📤 步骤2: 发送登录请求...');
      const postHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': config.login_url,
        'Origin': new URL(config.login_url).origin
      };

      const loginResponse = formMethod === 'get'
        ? await axiosInstance.get(loginActionUrl, {
          params: loginData,
          headers: postHeaders
        })
        : await axiosInstance.post(
          loginActionUrl,
          new URLSearchParams(loginData),
          {
            headers: postHeaders
          }
        );

      const responseRaw = loginResponse.data;
      let responseText = '';
      if (typeof responseRaw === 'string') {
        responseText = responseRaw;
      } else if (Buffer.isBuffer(responseRaw)) {
        responseText = responseRaw.toString('utf8');
      } else if (responseRaw !== null && responseRaw !== undefined) {
        try {
          responseText = JSON.stringify(responseRaw);
        } catch (stringifyError) {
          responseText = String(responseRaw);
        }
      }

      log.debug('📄 登录响应状态:', loginResponse.status);
      log.debug('📄 登录响应头:', JSON.stringify(loginResponse.headers).substring(0, 300));
      log.debug('📄 登录响应数据长度:', responseText.length);
      log.debug('📄 登录响应数据前500字符:', responseText.substring(0, 500));

      // 检查登录是否成功
      const loginSuccess = this.checkLoginSuccess(responseText, loginResponse.status);

      if (loginSuccess) {
        log.debug('✅ HTTP 登录成功');
        log.debug('📦 收集到的cookies数量:', cookies.size);
        log.debug('📦 Cookies列表:', Array.from(cookies.entries()).map(([k, v]) => `${k}=${v.substring(0, 20)}...`).join(', '));

        // 格式化 cookies
        const cookieString = Array.from(cookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');

        log.debug('📦 最终Cookie字符串长度:', cookieString.length);
        log.debug('📦 最终Cookie字符串前200字符:', cookieString.substring(0, 200));

        return {
          success: true,
          cookies: cookieString,
          cookiesArray: Array.from(cookies.entries()).map(([name, value]) => ({ name, value }))
        };
      } else {
        // 如果验证码识别失败，提供详细的调试信息
        if (captchaCode) {
          log.debug('⚠️ 登录可能失败，验证码可能识别错误');
          log.debug('📋 使用的验证码:', captchaCode);
        }

        // 分析响应内容，找出失败原因
        const $ = cheerio.load(responseText || '');
        const errorSelectors = ['.error', '.alert-danger', '.login-error', '#error', '.message.error'];
        for (const selector of errorSelectors) {
          const errorElement = $(selector);
          if (errorElement.length > 0) {
            const errorText = errorElement.text().trim();
            if (errorText) {
              log.debug('📋 页面错误信息:', errorText);
            }
          }
        }

        log.error('❌ HTTP 登录失败');
        return {
          success: false,
          error: '登录验证失败',
          debug: {
            captchaUsed: captchaCode,
            responseStatus: loginResponse.status,
            hasErrorElement: errorSelectors.some(s => $(s).length > 0)
          }
        };
      }

    } catch (error) {
      log.error('❌ HTTP 登录失败:', error.message);

      // 如果是网络错误，提供更详细的信息
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: '无法连接到登录服务器，请检查网络或URL是否正确'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 使用 Tesseract.js 识别验证码
   * @param {string} imageUrl - 验证码图片URL
   * @param {Object} axiosInstance - axios实例
   * @param {string} refererUrl - Referer URL
   * @returns {Promise<string>} 识别的验证码
   */
  async recognizeCaptcha(imageUrl, axiosInstance, refererUrl) {
    try {
      // 下载验证码图片
      const imgResponse = await axiosInstance.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Referer': refererUrl || imageUrl
        },
        timeout: 15000
      });

      const { buffer: imageBuffer, format } = validateImageResponse(imgResponse, log);
      const { buffer: processedBuffer, metadata } = await preprocessImageForOcr(imageBuffer);

      log.debug(`  🧹 验证码预处理完成: format=${format}, original=${metadata.width}x${metadata.height}, processedBytes=${processedBuffer.length}`);

      // 🔥 云端环境优化：使用多个策略识别验证码
      const strategies = [
        // 策略1: 标准识别
        {
          name: '标准识别',
          config: {}
        },
        // 策略2: 只识别数字
        {
          name: '数字模式',
          config: {
            tessedit_char_whitelist: '0123456789'
          }
        }
      ];

      let bestResult = null;
      let bestConfidence = 0;

      for (const strategy of strategies) {
        try {
          log.debug(`  📋 尝试${strategy.name}...`);
          const result = await recognizeTextWithTesseract(processedBuffer, {
            logger: m => {
              if (m.status === 'recognizing text') {
                log.debug(`  ${strategy.name}进度: ${Math.round(m.progress * 100)}%`);
              }
            },
            params: strategy.config
          });

          // 清理识别结果：只保留数字
          let captchaText = result.data.text.replace(/[^0-9]/g, '').trim();

          log.debug(`  ${strategy.name}原始识别:`, result.data.text.trim());
          log.debug(`  ${strategy.name}清理后:`, captchaText);
          log.debug(`  ${strategy.name}置信度:`, result.data.confidence);

          // 验证码通常是4位数字
          if (captchaText.length >= 4) {
            captchaText = captchaText.substring(0, 4);
          }

          // 如果置信度更高，使用这个结果
          if (result.data.confidence > bestConfidence && captchaText.length === 4) {
            bestConfidence = result.data.confidence;
            bestResult = captchaText;
            log.debug(`  ✅ ${strategy.name}识别成功，置信度: ${bestConfidence}`);
          }
        } catch (strategyError) {
          log.debug(`  ⚠️ ${strategy.name}失败:`, strategyError.message);
        }
      }

      // 如果有高置信度结果，返回
      if (bestResult) {
        return bestResult;
      }

      // 如果所有策略都失败，返回最后尝试的结果
      log.debug('  ⚠️ 所有识别策略都未获得4位数字');
      return bestResult || null;

    } catch (error) {
      log.error('  验证码识别失败:', error.message);
      log.error('  错误详情:', error.stack?.substring(0, 200) || '无堆栈');
      return null;
    }
  }

  /**
   * 检查登录是否成功
   */
  checkLoginSuccess(html, status) {
    log.debug('🔍 检查登录结果...');
    log.debug('   HTTP状态码:', status);

    // 🔥 优先检查 JSON 响应（API 返回格式）
    if (html && html.trim().startsWith('{')) {
      log.debug('   检测到JSON响应');
      try {
        const jsonData = JSON.parse(html);
        log.debug('   JSON数据:', jsonData);

        // 检查 code 字段：0 表示成功，-99 表示验证码错误等
        if (jsonData.code === 0 || jsonData.code === '0') {
          log.debug('   ✓ JSON响应显示登录成功 (code=0)');
          return true;
        }

        // 检查是否有错误码
        if (jsonData.code === -99 || jsonData.code === '-99') {
          log.debug('   ✗ JSON响应显示验证码错误 (code=-99)');
          return false;
        }

        // 其他错误码
        if (jsonData.code && jsonData.code !== 0) {
          log.debug('   ✗ JSON响应显示登录失败 (code=' + jsonData.code + ')');
          return false;
        }

        // 如果没有 code 字段，检查 message
        if (jsonData.message) {
          const successKeywords = ['成功', 'success', '登陆成功'];
          const failKeywords = ['失败', '错误', 'error', '验证码', '密码错误'];

          const lowerMessage = jsonData.message.toLowerCase();
          if (successKeywords.some(kw => lowerMessage.includes(kw))) {
            log.debug('   ✓ JSON消息显示登录成功');
            return true;
          }
          if (failKeywords.some(kw => lowerMessage.includes(kw))) {
            log.debug('   ✗ JSON消息显示登录失败');
            return false;
          }
        }
      } catch (parseError) {
        log.debug('   ⚠️ JSON解析失败，尝试HTML解析');
      }
    }

    // 重定向通常表示登录成功
    if (status === 302 || status === 301) {
      log.debug('   ✓ 检测到重定向，登录可能成功');
      return true;
    }

    const $ = cheerio.load(html);

    // 检查页面标题，如果还停留在登录页面，说明登录失败
    const title = $('title').text().toLowerCase();
    log.debug('   页面标题:', title);
    if (title.includes('登录') || title.includes('login')) {
      log.debug('   ✗ 页面标题仍包含"登录"，登录失败');
      return false;
    }

    // 检查是否有错误消息
    const errorSelectors = [
      '.error',
      '.alert-danger',
      '.login-error',
      '#error',
      '.message.error',
      'div[class*="error"]',
      'span[class*="error"]'
    ];

    for (const selector of errorSelectors) {
      if ($(selector).length > 0) {
        const errorText = $(selector).text().trim();
        if (errorText &&
!['登录成功', 'success'].includes(errorText)
) {
          log.debug('  ✗ 发现错误元素:', errorText);
          return false;
        }
      }
    }

    // 检查页面内容
    const bodyText = $('body').text().toLowerCase();
    const errorKeywords = ['密码错误', '用户名错误', '验证码错误', '登录失败'];

    for (const keyword of errorKeywords) {
      if (bodyText.includes(keyword)) {
        log.debug('  ✗ 发现错误关键词:', keyword);
        return false;
      }
    }

    // 如果页面包含登录表单，说明还在登录页面
    const loginForm = $('form[action*="login"], form[id*="login"], input[type="password"]');
    if (loginForm.length > 0) {
      log.debug('   ✗ 页面仍包含登录表单，登录失败');
      return false;
    }

    // 🔥 检查登录成功的明确标志
    // 如果页面包含以下元素，说明登录成功
    const successIndicators = [
      'a[href*="logout"]',           // 登出链接
      'a[href*="logout"]',           // 登出按钮
      '.user-info',                  // 用户信息
      '.username',                   // 用户名显示
      '[class*="user"]',             // 用户相关元素
      '[id*="user"]'                 // 用户相关元素
    ];

    let hasSuccessIndicator = false;
    for (const selector of successIndicators) {
      if ($(selector).length > 0) {
        log.debug(`   ✓ 发现登录成功标志: ${selector}`);
        hasSuccessIndicator = true;
        break;
      }
    }

    // 如果没有明确的成功标志，且页面包含数据表格或列表，可能是成功
    if (!hasSuccessIndicator) {
      const dataTable = $('table, .list, .grid, .data-table');
      if (dataTable.length > 0) {
        log.debug('   ✓ 发现数据表格，可能登录成功');
        hasSuccessIndicator = true;
      }
    }

    // 最终判断：如果没有任何成功标志，默认失败
    if (!hasSuccessIndicator) {
      log.debug('   ✗ 未发现登录成功的明确标志，默认判断为失败');
      log.debug('   💡 建议: 检查登录凭据或目标网站结构');
      return false;
    }

    log.debug('   ✓ 登录成功检查通过');
    return true;
  }
}

module.exports = new HttpLoginService();
