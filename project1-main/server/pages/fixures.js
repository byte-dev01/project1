
/*

export const test = base.extend({
  medicalRecords: async ({ page }, use) => {
    class MedicalRecordsAutomation extends MedicalAutomationFramework {
        async login(credentials) {
            // 导航到登录页
            await page.goto('https://example.com/login', {
                waitUntil: 'domcontentloaded'
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
                await loginButton.click();
                } else {
                    return (console.log('error'))
                }
                
                await this.smartWait(page);
                return page;
            } catch (error) {
                console.error('Login failed:', error);
                throw error;
            }
        }
        const automation = new MedicalRecordsAutomation(page);
        await use(automation);
    }
    });
module.exports = { MedicalRecordsAutomation};
*/
export const test = base.extend({
  database: async ({}, use) => {
    const db = await createTestDatabase();
    await use(db);
    await db.destroy();
  },
  
  apiClient: async ({ database }, use) => {
    // This fixture DEPENDS on database fixture
    const client = new ApiClient(database.connectionString);
    await use(client);
    await client.cleanup();
  },
  
  testUser: async ({ apiClient }, use) => {
    // This depends on apiClient, which depends on database
    const user = await apiClient.createUser({ name: 'Test User' });
    await use(user);
    await apiClient.deleteUser(user.id);

  }
});