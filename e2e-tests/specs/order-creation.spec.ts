import { test, expect } from '../fixtures/emulator-fixture';

test.describe('Order Creation', () => {
  test.beforeEach(async ({ page, testUsers }) => {
    // Navigate directly to login page
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    // Login as client
    await page.locator('#email').fill(testUsers.client.email);
    await page.locator('#password').fill(testUsers.client.password);
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('client can view existing orders in dashboard', async ({ page }) => {
    // Wait for orders to load - check specifically within the table
    await expect(page.getByText(/test order/i).first()).toBeVisible({ timeout: 10000 });

    // Verify we're on dashboard with orders table visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('client can access place order page', async ({ page }) => {
    // Navigate to Place Order page
    await page.goto('/place-order');

    // Verify we're on the place order page
    await expect(page).toHaveURL('/place-order');

    // Verify page loaded with a form
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
  });

  test('admin can login successfully', async ({ page, testUsers }) => {
    // Logout and login as admin
    await page.getByRole('button', { name: new RegExp(testUsers.client.displayName) }).click();
    await page.getByRole('menuitem', { name: /logout|sign out|deconectare/i }).click();

    // Navigate to login and sign in as admin
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });
    await page.locator('#email').fill(testUsers.admin.email);
    await page.locator('#password').fill(testUsers.admin.password);
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

    // Verify admin is logged in
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(page.getByRole('button', { name: new RegExp(testUsers.admin.displayName) })).toBeVisible();
  });
});
