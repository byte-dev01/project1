const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// 使用stealth插件
chromium.use(stealth);

class MedicalAutomationStealth {
    constructor(config = {}) {
        this.config = {
            headless: false,
            slowMo: 50,
            ...config
        };
    }

    // 保留人性化操作（这是Google也检测不到的）
    async humanDelay(min = 800, max = 2000) {
        const delay = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async humanType(page, selector, text) {
        await page.click(selector);
        await this.humanDelay(300, 600);
        
        // 随机决定是否先清空
        if (Math.random() > 0.7) {
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await this.humanDelay(100, 200);
        }
        
        // 变速打字
        for (const char of text) {
            await page.keyboard.type(char);
            // 模拟打字节奏
            if (char === ' ' || Math.random() < 0.1) {
                await this.humanDelay(100, 300);
            } else {
                await this.humanDelay(50, 150);
            }
        }
    }

    async createStealthBrowser() {
        // playwright-extra处理所有反检测
        const browser = await chromium.launch({
            headless: this.config.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list'
            ]
        });

        const context = await browser.newContext({
            // 随机化指纹
            viewport: this.getRandomViewport(),
            userAgent: this.getRandomUserAgent(),
            locale: 'en-US',
            timezoneId: this.getRandomTimezone(),
            // 权限设置
            permissions: [],
            geolocation: null,
            // 模拟真实设备
            deviceScaleFactor: window.devicePixelRatio || 1,
            isMobile: false,
            hasTouch: false,
        });

        // 添加额外的evasions
        await context.addInitScript(() => {
            // 模拟真实的浏览器环境
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // 添加真实的Chrome对象
            if (!window.chrome) {
                window.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                };
            }
        });

        const page = await context.newPage();
        
        // 设置额外的headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        return { browser, context, page };
    }

    // 随机配置生成器
    getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 }
        ];
        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    getRandomUserAgent() {
        const versions = ['120.0.0.0', '121.0.0.0', '119.0.0.0'];
        const version = versions[Math.floor(Math.random() * versions.length)];
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }

    getRandomTimezone() {
        const timezones = [
            'America/Los_Angeles',
            'America/Chicago', 
            'America/New_York',
            'America/Denver'
        ];
        return timezones[Math.floor(Math.random() * timezones.length)];
    }

    // 智能登录
    async login(url, credentials) {
        const { page } = await this.createStealthBrowser();
        
        console.log('Navigating to login page...');
        await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        // 等待页面稳定
        await this.humanDelay(2000, 3000);

        // 查找用户名输入框（多种可能的选择器）
        const usernameSelectors = [
            'input[name="username"]',
            'input[name="user"]', 
            'input[name="email"]',
            'input[type="text"]',
            '#username',
            '#user'
        ];

        let usernameField = null;
        for (const selector of usernameSelectors) {
            try {
                usernameField = await page.waitForSelector(selector, { timeout: 1000 });
                if (usernameField) break;
            } catch (e) {
                continue;
            }
        }

        if (usernameField) {
            await this.humanType(page, usernameField, credentials.username);
        }

        await this.humanDelay(1000, 2000);

        // 查找密码输入框
        const passwordField = await page.waitForSelector('input[type="password"]');
        await this.humanType(page, passwordField, credentials.password);

        await this.humanDelay(1000, 1500);

        // 查找登录按钮
        const loginButton = await page.waitForSelector(
            'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")'
        );

        // 人性化点击
        const box = await loginButton.boundingBox();
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await this.humanDelay(300, 600);
        await loginButton.click();

        // 等待登录完成
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        
        console.log('Login completed successfully');
        return page;
    }
}

// 导出
module.exports = MedicalAutomationStealth;

// 使用示例
async function main() {
    const automation = new MedicalAutomationStealth({
        headless: false,  // 显示浏览器
        slowMo: 50       // 放慢操作
    });

    try {
        const page = await automation.login('https://example.com/login', {
            username: 'your_username',
            password: 'your_password'
        });

        // 继续你的自动化任务...
        
    } catch (error) {
        console.error('Automation failed:', error);
    }
}

// 如果直接运行
if (require.main === module) {
    main();
}
