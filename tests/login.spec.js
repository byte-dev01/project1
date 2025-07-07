const { test, expect } = require('@playwright/test');
const { MedicalRecordsAutomation } = require('../server/pages/MedicalAutomationFramework.js');

test.describe('Medical Records Login', () => {
  test('user can log in successfully using automation framework', async ({ page }) => {
    // Create an instance of the automation framework
    const automation = new MedicalRecordsAutomation(page, {
      mouseMovement: true,
      typingSpeed: { min: 80, max: 150 },
      auditMode: true
    });
    
    // Perform login with the framework's intelligent typing and human-like behavior
    const loggedInPage = await automation.loginWithPlaywright(
      page, 
      'RLI032', 
      'Password01!'
    );
    
    // Verify login was successful
    await expect(loggedInPage).toHaveURL(/.*practicemate.*/);
    
    // Optional: Check for logout link as confirmation
    await expect(loggedInPage.getByRole('link', { name: '<<LOGOUT' })).toBeVisible();
  });

  test('standard Playwright login (without automation framework)', async ({ page }) => {
    // This is a standard Playwright test without the automation framework
    await page.goto('https://cms.officeally.com/');
    
    // Click initial login
    await page.getByRole('button', { name: 'Log in' }).click();
    
    // Handle popup
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Office Ally Practice Mate Medium-Sized Logo in Shades of Blue Practice Mate Log' }).click();
    const page1 = await page1Promise;
    
    // Fill credentials
    await page1.getByRole('textbox', { name: 'Username' }).fill('RLI032');
    await page1.getByRole('textbox', { name: 'Password' }).fill('Password01!');
    
    // Submit
    await page1.getByRole('button', { name: 'Continue' }).click();
    
    // Verify
    await expect(page1.getByRole('link', { name: '<<LOGOUT' })).toBeVisible();
  });

  test('login with rate limiting check', async ({ page }) => {
    const automation = new MedicalRecordsAutomation(page, {
      hourlyLimit: 5,
      dailyLimit: 30
    });
    
    try {
      // Check rate limits before attempting login
      await automation.checkRateLimits();
      
      // Proceed with login
      const loggedInPage = await automation.loginWithPlaywright(
        page,
        'RLI032',
        'Password01!'
      );
      
      await expect(loggedInPage.getByRole('link', { name: '<<LOGOUT' })).toBeVisible();
    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        console.log('Rate limit reached, test skipped');
        test.skip();
      } else {
        throw error;
      }
    }
  });
});

// Example of using the framework standalone (outside of Playwright Test)
async function standaloneExample() {
  const automation = new MedicalRecordsAutomation(null, {
    mouseMovement: true,
    auditMode: true
  });
  
  try {
    // This will create its own browser instance
    const page = await automation.login({
      username: 'RLI032',
      password: 'Password01!'
    });
    
    console.log('Login successful!');
    
    // Do more automation tasks...
    
    // Don't forget to close the browser
    await page.context().browser().close();
  } catch (error) {
    console.error('Automation failed:', error);
  }
}

// Export for use in other test files
module.exports = { standaloneExample };

