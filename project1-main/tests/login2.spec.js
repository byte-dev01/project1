// tests/workflow.spec.js
import { test, expect } from '@playwright/test';
let sharedData = {};

test.describe('OfficeAlly log-in workflow', () => {

  test.beforeAll(async ({ browser }) => {
    console.log('🚀 Setting up test suite...');
    const page = await browser.newPage();
    
    // One-time expensive setup
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
    
    // Wait for login to complete
    await page.waitForURL('/pm.officeally.com/pm/Appointments');
    
    // Save authentication state
    sharedData.cookies = await page.context().cookies();
    sharedData.localStorage = await page.evaluate(() => localStorage.getItem('authToken'));
    
    await page.close();
    console.log('✅ Setup complete');
  });

  test.beforeEach(async ({ page }) => {
    console.log('🔄 Preparing test with logged-in state...');
    
    // Restore authentication for each test
    await page.context().addCookies(sharedData.cookies);
    if (sharedData.localStorage) {
      await page.addInitScript((token) => {
        localStorage.setItem('authToken', token);
      }, sharedData.localStorage);
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      // Take screenshot on failure
      await page.screenshot({ 
        path: `screenshots/${testInfo.title}-failed.png` 
      });
    }
  });

  test.afterAll(async ({ browser }) => {
    console.log('🧹 Cleaning up test suite...');
    // Any final cleanup
  });
/*
  // Now all tests start with user already logged in
  test('should view product catalog', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('.product-grid')).toBeVisible();
    await expect(page.locator('.user-menu')).toContainText('testuser');
  });

  test('should add item to cart', async ({ page }) => {
    await page.goto('/products');
    await page.click('[data-product="laptop"]');
    await page.click('#add-to-cart');
    
    await expect(page.locator('.cart-count')).toContainText('1');
  });

  test('should complete checkout', async ({ page }) => {
    // User is already logged in, cart might have items from previous test
    await page.goto('/cart');
    await page.click('#checkout');
    await page.fill('#credit-card', '4111111111111111');
    await page.click('#complete-order');
    
    await expect(page.locator('.success-message')).toBeVisible();
  });
  */
});