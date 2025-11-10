import { test, expect } from '../fixtures/emulator-fixture';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page, testUsers }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in credentials using input IDs
    await page.locator('#email').fill(testUsers.client.email);
    await page.locator('#password').fill(testUsers.client.password);

    // Submit form - handle both Romanian and English
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();

    // Wait for dashboard to load
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);

    // Verify user menu button is visible (check for the user menu specifically)
    await expect(page.getByRole('button', { name: new RegExp(testUsers.client.displayName) })).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in invalid credentials
    await page.locator('#email').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');

    // Submit form - handle both Romanian and English
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();

    // Wait for error message - check for Romanian or English
    await expect(page.getByText(/invalid|incorrect|wrong|error|greșit|incorect/i)).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page, testUsers }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    // Login
    await page.locator('#email').fill(testUsers.client.email);
    await page.locator('#password').fill(testUsers.client.password);
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

    // Logout - click on user menu button
    await page.getByRole('button', { name: new RegExp(testUsers.client.displayName) }).click();

    // Click logout menu item - handle both Romanian and English
    await page.getByRole('menuitem', { name: /logout|sign out|deconectare/i }).click();

    // Verify we're redirected to login page (not landing page)
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });
});
