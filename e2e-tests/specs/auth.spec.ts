import { test, expect } from '../fixtures/emulator-fixture';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page, testUsers }) => {
    // Navigate to app
    await page.goto('/');

    // Click login button
    await page.getByRole('button', { name: /sign in|login|conectare/i }).click();

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(testUsers.client.email);
    await page.getByPlaceholder(/password|parol/i).fill(testUsers.client.password);

    // Submit form
    await page.getByRole('button', { name: /sign in|login|conectare/i }).last().click();

    // Wait for dashboard to load
    await page.waitForURL(/.*dashboard.*/);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);

    // Verify user menu is visible
    await expect(page.getByText(testUsers.client.displayName)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Click login button
    await page.getByRole('button', { name: /sign in|login|conectare/i }).click();

    // Fill in invalid credentials
    await page.getByPlaceholder(/email/i).fill('invalid@test.com');
    await page.getByPlaceholder(/password|parol/i).fill('wrongpassword');

    // Submit form
    await page.getByRole('button', { name: /sign in|login|conectare/i }).last().click();

    // Wait for error message
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page, testUsers }) => {
    // Login first
    await page.goto('/');
    await page.getByRole('button', { name: /sign in|login|conectare/i }).click();
    await page.getByPlaceholder(/email/i).fill(testUsers.client.email);
    await page.getByPlaceholder(/password|parol/i).fill(testUsers.client.password);
    await page.getByRole('button', { name: /sign in|login|conectare/i }).last().click();
    await page.waitForURL(/.*dashboard.*/);

    // Logout
    await page.getByRole('button', { name: testUsers.client.displayName }).click();
    await page.getByRole('menuitem', { name: /logout|sign out|deconectare/i }).click();

    // Verify we're back on landing page
    await expect(page).toHaveURL('/');
  });
});
