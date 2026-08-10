import { test, expect } from '../fixtures/emulator-fixture';

/**
 * Editing an existing order: the order is supplemented with another item, and
 * the invoice of the finished order is downloaded.
 */
test.describe('Order Editing', () => {
  const orderId = 'test-order-1';

  test.beforeEach(async ({ page, testUsers }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form', { timeout: 10000 });

    await page.locator('#email').fill(testUsers.admin.email);
    await page.locator('#password').fill(testUsers.admin.password);
    await page.getByRole('button', { name: /autentifică-te|sign in/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('admin can add another item to an existing order', async ({ page }) => {
    await page.locator(`[data-testid="order-row-${orderId}"]`).click();

    const modal = page.locator('[data-testid="order-details-modal"]');
    await modal.waitFor({ state: 'visible' });

    await modal.locator('[data-testid="order-edit-button"]').click();
    await modal.locator('[data-testid="order-edit-add-item-button"]').click();

    const newItem = modal.locator('[data-testid="order-edit-new-item-0"]');
    await expect(newItem).toBeVisible();

    // Product type (autocomplete)
    const productTypeInput = newItem.locator('input[type="text"]').first();
    await productTypeInput.click();
    await productTypeInput.fill('T-Shirts');
    await page.locator('button', { hasText: 'T-Shirts' }).first().click();

    // Quantity
    await newItem.locator('[data-testid="sub-order-quantity-1"]').fill('25');

    // One customisation position with its measurements
    await newItem.locator('[data-testid="sub-order-1-position-input"]').fill('Piept');
    await newItem.locator('[data-testid="sub-order-1-position-add-button"]').click();
    await newItem.locator('[data-testid="sub-order-1-position-0-quantity"]').fill('25');

    await newItem.locator('[data-testid="sub-order-delivery-time-1"]').fill('2026-12-15T14:00');

    await modal.locator('[data-testid="order-edit-save-button"]').click();

    // The saved item is now part of the order
    await expect(modal.getByRole('heading', { name: 'Articol #2' })).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText('T-Shirts').first()).toBeVisible();

    // ...and it survives a reload
    await page.reload();
    await page.locator(`[data-testid="order-row-${orderId}"]`).click();
    await modal.waitFor({ state: 'visible' });
    await expect(modal.getByRole('heading', { name: 'Articol #2' })).toBeVisible({ timeout: 15000 });
  });

  test('admin can download the invoice of a finished order', async ({ page }) => {
    await page.locator(`[data-testid="order-row-${orderId}"]`).click();

    const modal = page.locator('[data-testid="order-details-modal"]');
    await modal.waitFor({ state: 'visible' });

    // Every item has to be finished before the order can be: the first
    // "finalizat" button belongs to the item, the last one to the order.
    await modal.getByRole('button', { name: 'finalizat', exact: true }).first().click();
    await page.waitForTimeout(1500);
    await modal.locator('[data-testid="order-status-button-completed"]').click();
    await page.waitForTimeout(1500);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await modal.getByRole('button', { name: /descarcă factur/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^Factura_.*\.pdf$/);
  });
});
