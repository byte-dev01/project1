const { chromium } = require('playwright-extra');
const stealth = require('playwright-extra-plugin-stealth')();
// 使用stealth插件
chromium.use(stealth);
const crypto = require('crypto');
const fs = require('fs/promises');

class MedicalAutomationFramework {
    constructor(config = {}) {
        this.config = {
            minDelay: 1000,
            maxDelay: 7000,
            typingSpeed: { min: 60, max: 120 },
            mouseMovement: true,
            sessionLength: { min: 15, max: 45 }, // minutes
            dailyLimit: 30, // requests per day
            hourlyLimit: 5,  // requests per hour
            ...config
        };
        this.sessionMetrics = {
            startTime: Date.now(),
            actions: 0,
            dailyCount: 0,
            hourlyCount: 0,
            lastRequest: null,
            sessionId: crypto.randomUUID()
        };
        
        this.auditLog = [];
        this.rateLimiter = new Map(); // Track request timing
    }
        async checkRateLimits() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        
        // Clean old entries
        for (const [timestamp, count] of this.rateLimiter.entries()) {
            if (now - timestamp > oneDay) {
                this.rateLimiter.delete(timestamp);
            }
        }
        
        // Count recent requests
        const hourlyRequests = Array.from(this.rateLimiter.entries())
            .filter(([timestamp]) => now - timestamp < oneHour)
            .reduce((sum, [, count]) => sum + count, 0);
            
        const dailyRequests = Array.from(this.rateLimiter.values())
            .reduce((sum, count) => sum + count, 0);
            
        if (hourlyRequests >= this.config.hourlyLimit) {
            const waitTime = oneHour - (now - Math.max(...Array.from(this.rateLimiter.keys())));
            throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 60000)} minutes.`);
        }
        
        if (dailyRequests >= this.config.dailyLimit) {
            throw new Error('Daily request limit reached. Try again tomorrow.');
        }
        
        // Record this request
        const hourKey = Math.floor(now / oneHour) * oneHour;
        this.rateLimiter.set(hourKey, (this.rateLimiter.get(hourKey) || 0) + 1);
        
        return true;
    }

    // Enhanced audit logging
    async logAction(action, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionMetrics.sessionId,
            action,
            userAgent: await this.getCurrentUserAgent(),
            clinicId: this.config.clinicInfo.id,
            userId: this.config.clinicInfo.userId,
            ...details
        };
        
        this.auditLog.push(logEntry);
        
        if (this.config.auditMode) {
            await fs.appendFile(
                `audit_log_${new Date().toISOString().split('T')[0]}.json`,
                JSON.stringify(logEntry) + '\n'
            );
        }
    }


    // 高斯分布延迟（更自然）
    async gaussianDelay(mean = 1500, stdDev = 500) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const delay = Math.max(300, mean + z0 * stdDev);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 模拟鼠标路径
    async humanLikeMouseMove(page, targetX, targetY) {
        const steps = 20 + Math.floor(Math.random() * 10);
        const currentPosition = await page.evaluate(() => ({
            x: window.mouseX || 0,
            y: window.mouseY || 0
        }));

        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            // 贝塞尔曲线运动
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;
            
            const x = currentPosition.x + (targetX - currentPosition.x) * easeProgress;
            const y = currentPosition.y + (targetY - currentPosition.y) * easeProgress;
            
            // 添加微小抖动
            const jitterX = (Math.random() - 0.5) * 2;
            const jitterY = (Math.random() - 0.5) * 2;
            
            await page.mouse.move(x + jitterX, y + jitterY);
            await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        }
    }
    
    // 智能输入（包含错误和修正）
    async intelligentType(page, selector, text) {
        const element = await page.$(selector);
        const box = await element.boundingBox();
        
        // 移动到输入框
        if (this.config.mouseMovement) {
            await this.humanLikeMouseMove(page, 
                box.x + box.width * 0.3, 
                box.y + box.height * 0.5
            );
        }

        await page.click(selector);
        await this.gaussianDelay(500, 150);

        // 清空现有内容（模拟Ctrl+A, Delete）
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await this.gaussianDelay(100, 30);
        await page.keyboard.press('Delete');

        // 输入文本，偶尔出错
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 5%概率输入错误
            if (Math.random() < 0.05 && i > 0 && i < text.length - 1) {
                const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
                await page.keyboard.type(wrongChar);
                await this.gaussianDelay(150, 50);
                
                // 发现错误并修正
                await this.gaussianDelay(300, 100);
                await page.keyboard.press('Backspace');
                await this.gaussianDelay(200, 50);
            }
            
            await page.keyboard.type(char);
            
            // 可变打字速度
            const baseDelay = 1000 / ((this.config.typingSpeed.min + this.config.typingSpeed.max) / 2);
            await this.gaussianDelay(baseDelay, baseDelay * 0.3);
        }
    }

    // 智能等待（监测页面活动）
    async smartWait(page, options = {}) {
        const maxWait = options.maxWait || 30000;
        const stable = options.stable || 500;
        
        await Promise.race([
            page.waitForLoadState('networkidle'),
            page.waitForTimeout(maxWait)
        ]);

        // 等待DOM稳定
        let previousHTML = await page.content();
        let stableTime = 0;
        
        while (stableTime < stable) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const currentHTML = await page.content();
            
            if (currentHTML === previousHTML) {
                stableTime += 100;
            } else {
                stableTime = 0;
                previousHTML = currentHTML;
            }
            
            if (Date.now() - this.sessionMetrics.startTime > maxWait) break;
        }
    }

    // 创建指纹随机化的浏览器
    async createStealthBrowser() {
        const viewport = this.getRandomViewport();
        
        const browser = await chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox',
                `--window-size=${viewport.width},${viewport.height}`,
            ],
        });

        const context = await browser.newContext({
            viewport,
            userAgent: this.getRandomUserAgent(),
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            permissions: [],
            deviceScaleFactor: Math.random() * 0.5 + 1,
            hasTouch: false,
            colorScheme: 'light',
        });

        // 注入反检测脚本
        await context.addInitScript(() => {
            // 隐藏webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // 模拟真实的navigator
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin' },
                    { name: 'Chrome PDF Viewer' },
                    { name: 'Native Client' }
                ]
            });

            // 添加鼠标位置跟踪
            window.mouseX = 0;
            window.mouseY = 0;
            document.addEventListener('mousemove', (e) => {
                window.mouseX = e.clientX;
                window.mouseY = e.clientY;
            });
        });

        const page = await context.newPage();
        
        // 添加随机的浏览历史假象
        await this.simulateBrowsingHistory(page);
        
        return { browser, context, page };
    }

    // 获取随机视口
    getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 },
            { width: 1600, height: 900 }
        ];
        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    // 获取随机UA
    getRandomUserAgent() {
        const versions = ['120.0.0.0', '119.0.0.0', '118.0.0.0'];
        const version = versions[Math.floor(Math.random() * versions.length)];
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }

    // 模拟浏览历史
    async simulateBrowsingHistory(page) {
        // 设置假的referrer
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/search?q=medical+records+software'
        });
    }

    
    
    
    // 智能表单处理
    async handleForm(page, formData) {
        for (const [fieldName, value] of Object.entries(formData)) {
            const selector = `[name="${fieldName}"], #${fieldName}, [id*="${fieldName}"]`;
            
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                const elementType = await page.$eval(selector, el => el.tagName.toLowerCase());
                
                if (elementType === 'select') {
                    await this.gaussianDelay();
                    await page.selectOption(selector, value);
                } else if (elementType === 'input' || elementType === 'textarea') {
                    await this.intelligentType(page, selector, value);
                }
                
                // 随机验证行为
                if (Math.random() < 0.3) {
                    await page.keyboard.press('Tab');
                    await this.gaussianDelay(800, 200);
                    await page.keyboard.down('Shift');
                    await page.keyboard.press('Tab');
                    await page.keyboard.up('Shift');
                }
                
            } catch (error) {
                console.warn(`Field ${fieldName} not found, skipping...`);
            }
            
            await this.gaussianDelay(1500, 500);
        }
    }
}


// 使用示例
class MedicalRecordsAutomation extends MedicalAutomationFramework {
    async login(credentials) {
        const { page } = await this.createStealthBrowser();
        
        try {
            // 导航到登录页

            test('test', async ({ page }) => {
            await page.goto('https://cms.officeally.com/');
            await page.getByRole('button', { name: 'Log in' }).click();
            await page.getByRole('button', { name: 'Log in' }).click();
            await page.getByRole('button', { name: 'Log in' }).click();
            const page1Promise = page.waitForEvent('popup');
            await page.getByRole('link', { name: 'Office Ally Practice Mate Medium-Sized Logo in Shades of Blue Practice Mate Log' }).click();
            const page1 = await page1Promise;
            await page1.getByRole('textbox', { name: 'Username' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Username' }).fill('R');
            await page1.getByRole('textbox', { name: 'Username' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Username' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Username' }).fill('RLI032');
            await page1.getByRole('textbox', { name: 'Password' }).click();
            await page1.getByRole('textbox', { name: 'Password' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Password' }).fill('');
            await page1.getByRole('textbox', { name: 'Password' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Password' }).fill('P');
            await page1.getByRole('textbox', { name: 'Password' }).press('CapsLock');
            await page1.getByRole('textbox', { name: 'Password' }).fill('Password01!');
            await page1.getByRole('button', { name: 'Continue' }).click();
            await page1.getByRole('link', { name: '<<LOGOUT' }).click();
            });            
            await this.smartWait(page);
            
            // 智能填写表单
            await this.handleForm(page, {
                username: credentials.username,
                password: credentials.password
            });
            
            // 查找并点击登录按钮
            const loginButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login")');
            if (loginButton) {
                const box = await loginButton.boundingBox();
                await this.humanLikeMouseMove(page, box.x + box.width/2, box.y + box.height/2);
                await this.gaussianDelay(800, 200);
                await loginButton.click();
            }
            
            await this.smartWait(page);
            
            return page;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }
}

module.exports = { MedicalRecordsAutomation };
