import { test, expect } from '../fixtures/emulator-fixture';

test.describe('Order Creation', () => {
  test.beforeEach(async ({ page, testUsers }) => {
    // Login as client
    await page.goto('/');
    await page.getByRole('button', { name: /sign in|login|conectare/i }).click();
    await page.getByPlaceholder(/email/i).fill(testUsers.client.email);
    await page.getByPlaceholder(/password|parol/i).fill(testUsers.client.password);
    await page.getByRole('button', { name: /sign in|login|conectare/i }).last().click();
    await page.waitForURL(/.*dashboard.*/);
  });

  test('client can view existing orders in dashboard', async ({ page }) => {
    // Wait for orders to load
    await expect(page.getByText(/test order/i)).toBeVisible({ timeout: 10000 });

    // Verify order details are displayed
    await expect(page.getByText(/test client/i)).toBeVisible();
    await expect(page.getByText(/pending|în așteptare/i)).toBeVisible();
  });

  test('client can place a new order from PlaceOrder page', async ({ page }) => {
    // Navigate to Place Order page
    await page.goto('/place-order');

    // Fill in contact phone
    await page.getByLabel(/contact.*phone|telefon/i).fill('+40987654321');

    // Select product type
    await page.getByPlaceholder(/product.*type|tip.*produs/i).click();
    await page.getByPlaceholder(/product.*type|tip.*produs/i).fill('Mugs');
    await page.getByText('Mugs').first().click();

    // Fill in quantity
    await page.getByLabel(/quantity|cantitate/i).fill('50');

    // Fill in delivery time
    await page.getByLabel(/delivery.*time|termen.*livrare/i).fill('2025-12-15');

    // Fill in description
    await page.getByLabel(/description|descriere/i).fill('Custom printed mugs for event');

    // Submit order
    await page.getByRole('button', { name: /submit|trimite|plasează/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard.*/);

    // Verify success message or new order appears
    await expect(page.getByText(/success|succes|created|creat/i)).toBeVisible({ timeout: 5000 });
  });

  test('admin can create order with order name', async ({ page, testUsers }) => {
    // Logout and login as admin
    await page.getByRole('button', { name: testUsers.client.displayName }).click();
    await page.getByRole('menuitem', { name: /logout|sign out|deconectare/i }).click();

    await page.goto('/');
    await page.getByRole('button', { name: /sign in|login|conectare/i }).click();
    await page.getByPlaceholder(/email/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/password|parol/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /sign in|login|conectare/i }).last().click();
    await page.waitForURL(/.*dashboard.*/);

    // Click "New Order" button
    await page.getByRole('button', { name: /new.*order|comandă.*nouă/i }).click();

    // Fill in order name (admin/team only)
    await page.getByLabel(/order.*name|denumire.*comandă/i).fill('Corporate Event Mugs');

    // Select a client (admins need to select client)
    // This depends on your UI - adjust selector as needed
    const clientSelector = page.getByLabel(/client|select.*client/i);
    if (await clientSelector.isVisible()) {
      await clientSelector.click();
      await page.getByText(/test client/i).click();
    }

    // Fill in contact phone
    await page.getByLabel(/contact.*phone|telefon/i).fill('+40123456789');

    // Select product type
    await page.getByPlaceholder(/product.*type|tip.*produs/i).click();
    await page.getByPlaceholder(/product.*type|tip.*produs/i).fill('T-Shirts');
    await page.getByText('T-Shirts').first().click();

    // Fill in quantity
    await page.getByLabel(/quantity|cantitate/i).fill('100');

    // Fill in delivery time
    await page.getByLabel(/delivery.*time|termen.*livrare/i).fill('2025-12-20');

    // Submit order
    await page.getByRole('button', { name: /submit|save|salvează/i }).click();

    // Verify order was created
    await expect(page.getByText(/corporate event mugs/i)).toBeVisible({ timeout: 10000 });
  });

  test('validates required fields', async ({ page }) => {
    // Navigate to Place Order page
    await page.goto('/place-order');

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /submit|trimite|plasează/i }).click();

    // Should see validation errors
    await expect(page.getByText(/required|obligatoriu/i)).toBeVisible({ timeout: 2000 });
  });
});
