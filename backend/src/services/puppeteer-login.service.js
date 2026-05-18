/**
 * Puppeteer登录服务
 * 使用浏览器自动化绕过安全控件限制
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const log = require('../utils/log');
const { ensureLogDir } = require('../utils/log-paths');

class PuppeteerLoginService {
  constructor() {
    this.browser = null;
    this.cookiesDir = ensureLogDir('puppeteer-cookies');
    this.chromeAvailable = null; // 缓存检测结果
    this.chromePath = null; // 保存找到的路径
  }

  /**
   * 检查 Chrome 是否可用
   * @returns {Promise<boolean>}
   */
  async isChromeAvailable() {
    if (this.chromeAvailable !== null) {
      return this.chromeAvailable;
    }

    const chromePaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        log.debug(`✅ 找到 Chrome: ${chromePath}`);
        this.chromePath = chromePath;
        this.chromeAvailable = true;
        return true;
      }
    }

    log.debug('⚠️ 未找到系统 Chrome，将使用 Puppeteer 内置 Chromium');
    log.debug('💡 首次运行会自动下载 Chromium，请耐心等待...');
    this.chromeAvailable = false;
    return false;
  }

  /**
   * 启动浏览器
   */
  async launchBrowser() {
    if (this.browser) {
      return this.browser;
    }

    log.debug('🚀 启动无头浏览器...');

    // 先检查系统 Chrome
    const hasChrome = await this.isChromeAvailable();
    const executablePath = hasChrome ? this.chromePath : undefined;

    if (executablePath) {
      log.debug(`✅ 使用系统 Chrome: ${executablePath}`);
    } else {
      log.debug('⚠️ 未找到系统 Chrome，将使用 Puppeteer 内置 Chromium');
      log.debug('💡 建议安装系统 Chrome: sudo apt-get install -y google-chrome-stable');
    }

    // 启动浏览器配置
    const launchOptions = {
      headless: 'new',
      executablePath: executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
        // 云端环境: 使用单进程模式避免权限问题
        '--single-process',
        '--no-zygote',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-component-extensions-with-background-pages'
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      env: {
        ...process.env,
        MALLOC_ARENA_MAX: '2' // 减少内存使用
      }
    };

    this.browser = await puppeteer.launch(launchOptions);

    log.debug('✅ 浏览器已启动');
    return this.browser;
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      log.debug('✅ 浏览器已关闭');
    }
  }

  /**
   * 使用Puppeteer登录
   * @param {Object} config - 登录配置
   * @returns {Object} { success, cookies, error }
   */
  async login(config) {
    // 首先检查 Chrome 是否可用
    const hasChrome = await this.isChromeAvailable();
    if (!hasChrome) {
      log.debug('⚠️ Chrome 浏览器不可用，Puppeteer 登录跳过');
      return {
        success: false,
        cookies: null,
        error: 'Chrome 浏览器未安装或不可用（云端环境限制）'
      };
    }

    const page = await this.browser.newPage();

    try {
      // 设置用户代理
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      log.debug(`📄 访问登录页面: ${config.login_url}`);

      // 访问登录页面
      await page.goto(config.login_url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待页面加载完成（使用new Promise代替waitForTimeout）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 尝试绕过安全控件检查
      await page.evaluate(() => {
        // 设置canLogin为true
        window.canLogin = true;

        // 设置jiqima为空字符串或生成一个假值
        const jiqimaInput = document.getElementById('jiqima');
        if (jiqimaInput) {
          jiqimaInput.value = Date.now().toString();
        }
      });

      log.debug('📸 获取验证码...');

      // 获取验证码图片
      const captchaElement = await page.$('#imgVerify');
      if (!captchaElement) {
        throw new Error('未找到验证码图片元素');
      }

      // 截取验证码图片
      const captchaScreenshot = path.join(this.cookiesDir, `captcha-${Date.now()}.png`);
      await captchaElement.screenshot({ path: captchaScreenshot });
      log.debug(`✅ 验证码已保存: ${captchaScreenshot}`);

      // 使用OCR识别验证码
      const Tesseract = require('tesseract.js');
      log.debug('🔍 开始OCR识别验证码...');

      // 尝试多种识别策略
      const { data: { text: rawText } } = await Tesseract.recognize(captchaScreenshot, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            log.debug(`   识别进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      log.debug(`📝 OCR原始识别结果: "${rawText}"`);

      // 尝试多种方式提取4位数字
      let captchaCode = rawText.replace(/[^0-9]/g, '');

      // 如果直接提取失败，尝试从原始文本中找连续的4位数字
      if (captchaCode.length !== 4) {
        const fourDigitMatch = rawText.match(/\d{4}/);
        if (fourDigitMatch) {
          captchaCode = fourDigitMatch[0];
        }
      }

      // 如果还是失败，尝试提取所有数字并组合
      if (captchaCode.length !== 4 && captchaCode.length > 4) {
        captchaCode = captchaCode.substring(0, 4);
      }

      log.debug(`✅ 验证码识别结果: ${captchaCode}`);

      if (!captchaCode || captchaCode.length !== 4) {
        log.error(`❌ 验证码识别失败! 原始结果: "${rawText}", 提取后: "${captchaCode}"`);
        log.error(`💡 提示: 验证码图片保存在: ${captchaScreenshot}`);
        throw new Error(`验证码识别失败 (识别结果: "${rawText}")`);
      }

      // 填写表单
      log.debug('📝 填写登录表单...');

      await page.type('#dhhm', config.login_username);
      await page.type('#password', config.login_password);  // 修复: 使用#password而不是#pwd
      await page.type('#edtSign', captchaCode);

      // 点击登录按钮
      log.debug('🔐 提交登录...');
      await page.click('#bt_login');

      // 等待响应
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 15000
      }).catch(() => {
        // 可能没有跳转，继续检查当前状态
      });

      // 获取当前URL和cookies
      const currentUrl = page.url();
      const cookies = await page.cookies();

      log.debug(`当前URL: ${currentUrl}`);
      log.debug(`获取到 ${cookies.length} 个cookies`);

      // 检查是否登录成功
      const isLoggedIn = !currentUrl.includes('index.htm') || currentUrl.includes('goShopping');

      if (isLoggedIn) {
        // 转换cookies为字符串格式
        const cookieString = cookies
          .map(c => `${c.name}=${c.value}`)
          .join('; ');

        log.debug('✅ 登录成功!');

        return {
          success: true,
          cookies: cookieString,
          cookiesArray: cookies,
          error: null
        };
      } else {
        // 检查错误信息
        const errorText = await page.evaluate(() => {
          const alertMsg = document.querySelector('.alert-message');
          return alertMsg ? alertMsg.textContent : document.body.textContent;
        });

        throw new Error(errorText || '登录失败，原因未知');
      }

    } catch (error) {
      log.error('❌ 登录失败:', error.message);

      return {
        success: false,
        cookies: null,
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  /**
   * 使用已保存的cookies获取数据
   * @param {string} url - 目标URL
   * @param {Array} cookiesArray - cookies数组
   * @returns {string} 页面内容
   */
  async fetchData(url, cookiesArray) {
    const page = await this.browser.newPage();

    try {
      // 设置cookies
      await page.setCookie(...cookiesArray);

      log.debug(`📄 访问页面: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 获取页面内容
      const content = await page.content();

      log.debug(`✅ 获取到页面内容，长度: ${content.length} 字符`);

      return content;

    } finally {
      await page.close();
    }
  }
}

module.exports = PuppeteerLoginService;
