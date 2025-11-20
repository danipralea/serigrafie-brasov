import { test, expect } from '../fixtures/emulator-fixture';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page, testUsers }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in credentials using data-testid
    await page.locator('[data-testid="login-email-input"]').fill(testUsers.client.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.client.password);

    // Submit form
    await page.locator('[data-testid="login-submit-button"]').click();

    // Wait for dashboard to load
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);

    // Verify user menu button is visible
    await expect(page.locator('[data-testid="nav-user-menu"]')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in invalid credentials
    await page.locator('[data-testid="login-email-input"]').fill('invalid@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('wrongpassword');

    // Submit form
    await page.locator('[data-testid="login-submit-button"]').click();

    // Wait for error message
    await expect(page.locator('[data-testid="login-error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page, testUsers }) => {
    // Navigate directly to login page
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    // Login
    await page.locator('[data-testid="login-email-input"]').fill(testUsers.client.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.client.password);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

    // Open user menu
    await page.locator('[data-testid="nav-user-menu"]').click();

    // Click logout button
    await page.locator('[data-testid="nav-logout-button"]').click();

    // Verify we're redirected to login page
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });
});
