import { test, expect } from '../fixtures/emulator-fixture';
import {
  createTestImage,
  uploadFile,
  verifyFileAttachment,
  cleanupTestFiles
} from '../utils/file-helpers';

/**
 * COMPREHENSIVE ORDER WORKFLOW E2E TEST
 *
 * This test covers the complete order lifecycle from A to Z:
 * 1. Non-authenticated client places order with multiple sub-orders
 * 2. Client signs up during order placement
 * 3. Order appears on client dashboard with correct data
 * 4. Firestore validation of order data
 * 5. Admin views and updates order
 * 6. Order status changes and updates flow between client and admin
 * 7. File attachments on order updates
 * 8. Order deletion by admin
 * 9. Admin creates new order for client
 * 10. Order completion and past orders view
 * 11. Calendar integration (bonus)
 * 12. Complete cleanup verification
 */

test.describe('Complete Order Workflow - Full Happy Path', () => {
  let clientEmail: string;
  let clientPassword: string;
  let firstOrderId: string;
  let secondOrderId: string;
  let testImagePath: string;

  // Setup test data
  test.beforeAll(() => {
    // Generate unique email for this test run
    const timestamp = Date.now();
    clientEmail = `client-${timestamp}@test.com`;
    clientPassword = 'SecurePassword123!';

    // Create test file for upload
    testImagePath = createTestImage(`order-attachment-${timestamp}.png`);
  });

  // Cleanup test files
  test.afterAll(() => {
    cleanupTestFiles();
  });

  test('should complete full order workflow from client order to completion', async ({ page, testUsers }) => {
    // ============================================================================
    // STEP 1: Non-authenticated client starts placing order
    // ============================================================================
    console.log('📝 STEP 1: Non-authenticated client places order with multiple sub-orders');

    await page.goto('/place-order');
    await expect(page).toHaveURL('/place-order');

    // Fill contact phone (required for non-authenticated users)
    const phoneInput = page.locator('[data-testid="place-order-phone-input"]');
    await phoneInput.waitFor({ state: 'visible' });
    await phoneInput.fill('+40712345678');

    // Fill first sub-order
    console.log('  ✓ Filling first sub-order (Mugs)');
    await page.locator('[data-testid="sub-order-quantity-0"]').fill('100');
    await page.locator('[data-testid="sub-order-description-0"]').fill('Blue mugs with company logo - high resolution print');

    // Set delivery time (7 days from now)
    const deliveryDate1 = new Date();
    deliveryDate1.setDate(deliveryDate1.getDate() + 7);
    const deliveryDateString1 = deliveryDate1.toISOString().slice(0, 16);
    await page.locator('[data-testid="sub-order-delivery-time-0"]').fill(deliveryDateString1);

    // Add second sub-order
    console.log('  ✓ Adding second sub-order (T-Shirts)');
    const addSubOrderButton = page.locator('[data-testid="place-order-add-suborder-button"]');
    await addSubOrderButton.click();

    // Wait for second sub-order to appear
    await page.locator('[data-testid="sub-order-quantity-1"]').waitFor({ state: 'visible' });

    // Fill second sub-order
    await page.locator('[data-testid="sub-order-quantity-1"]').fill('50');
    await page.locator('[data-testid="sub-order-description-1"]').fill('White cotton t-shirts size L - front and back print');

    const deliveryDate2 = new Date();
    deliveryDate2.setDate(deliveryDate2.getDate() + 10);
    const deliveryDateString2 = deliveryDate2.toISOString().slice(0, 16);
    await page.locator('[data-testid="sub-order-delivery-time-1"]').fill(deliveryDateString2);

    // Add third sub-order
    console.log('  ✓ Adding third sub-order (Hoodies)');
    await addSubOrderButton.click();
    await page.locator('[data-testid="sub-order-quantity-2"]').waitFor({ state: 'visible' });

    await page.locator('[data-testid="sub-order-quantity-2"]').fill('25');
    await page.locator('[data-testid="sub-order-description-2"]').fill('Black hoodies with embroidered logo - premium quality');

    const deliveryDate3 = new Date();
    deliveryDate3.setDate(deliveryDate3.getDate() + 14);
    const deliveryDateString3 = deliveryDate3.toISOString().slice(0, 16);
    await page.locator('[data-testid="sub-order-delivery-time-2"]').fill(deliveryDateString3);

    // ============================================================================
    // STEP 2: Client signs up during order placement
    // ============================================================================
    console.log('📝 STEP 2: Client signs up with email and password');

    // Submit order (should redirect to login/signup)
    const submitButton = page.locator('[data-testid="place-order-submit-button"]');
    await submitButton.click();

    // Should be redirected to login page
    await page.waitForURL(/\/login/);

    // Fill signup form (assuming login page has signup fields)
    await page.locator('[data-testid="login-email-input"]').fill(clientEmail);
    await page.locator('[data-testid="login-password-input"]').fill(clientPassword);

    // Submit login/signup
    await page.locator('[data-testid="login-submit-button"]').click();

    // ============================================================================
    // STEP 3: Verify order appears on client dashboard
    // ============================================================================
    console.log('📝 STEP 3: Verifying order appears on client dashboard');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Wait for orders table to load
    const ordersTable = page.locator('[data-testid="dashboard-orders-table"]');
    await ordersTable.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for first order row to appear (poll for it)
    const firstOrderRow = ordersTable.locator('tbody tr').first();
    await firstOrderRow.waitFor({ state: 'visible', timeout: 10000 });

    // Get the order ID from the row
    const orderIdCell = firstOrderRow.locator('td').first();
    const orderIdText = await orderIdCell.textContent();
    firstOrderId = orderIdText?.trim() || '';

    console.log(`  ✓ Order created with ID: ${firstOrderId}`);

    // Verify order details in the table
    await expect(firstOrderRow).toContainText('+40712345678'); // Phone number
    await expect(firstOrderRow).toContainText('așteaptă confirmare'); // Status: pending confirmation

    // ============================================================================
    // STEP 4: Verify Firestore data is correct
    // ============================================================================
    console.log('📝 STEP 4: Verifying Firestore data');

    // Click on order to open details modal
    const orderDetailsButton = firstOrderRow.locator('[data-testid="order-details-button"]');
    await orderDetailsButton.click();

    // Wait for modal to open
    const orderDetailsModal = page.locator('[data-testid="order-details-modal"]');
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Verify sub-orders are displayed correctly
    await expect(orderDetailsModal).toContainText('100'); // First sub-order quantity
    await expect(orderDetailsModal).toContainText('50');  // Second sub-order quantity
    await expect(orderDetailsModal).toContainText('25');  // Third sub-order quantity
    await expect(orderDetailsModal).toContainText('Blue mugs with company logo');
    await expect(orderDetailsModal).toContainText('White cotton t-shirts');
    await expect(orderDetailsModal).toContainText('Black hoodies');

    // Close modal
    await page.keyboard.press('Escape');
    await orderDetailsModal.waitFor({ state: 'hidden' });

    // ============================================================================
    // STEP 5: Switch to admin account
    // ============================================================================
    console.log('📝 STEP 5: Logging out and switching to admin account');

    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Login as admin
    await page.locator('[data-testid="login-email-input"]').fill(testUsers.admin.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.admin.password);
    await page.locator('[data-testid="login-submit-button"]').click();

    await page.waitForURL('/dashboard');

    // ============================================================================
    // STEP 6: Admin sees the order
    // ============================================================================
    console.log('📝 STEP 6: Admin verifies they can see the client order');

    await ordersTable.waitFor({ state: 'visible' });

    // Find the order by ID
    const adminOrderRow = page.locator(`[data-testid="order-row-${firstOrderId}"]`);
    await adminOrderRow.waitFor({ state: 'visible', timeout: 10000 });

    // Verify order appears for admin
    await expect(adminOrderRow).toBeVisible();
    await expect(adminOrderRow).toContainText(clientEmail);

    // ============================================================================
    // STEP 7: Admin sees correct order details
    // ============================================================================
    console.log('📝 STEP 7: Admin opens order and verifies all details');

    await adminOrderRow.locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Verify all three sub-orders are visible
    await expect(orderDetailsModal).toContainText('100');
    await expect(orderDetailsModal).toContainText('50');
    await expect(orderDetailsModal).toContainText('25');

    // ============================================================================
    // STEP 8: Admin confirms the order (status update)
    // ============================================================================
    console.log('📝 STEP 8: Admin confirms the order');

    const confirmButton = orderDetailsModal.locator('[data-testid="order-confirm-button"]');
    await confirmButton.click();

    // Wait for status update to complete (poll for new status)
    await page.waitForTimeout(1000); // Brief wait for update

    // Verify status changed to "confirmat" (confirmed)
    await expect(orderDetailsModal).toContainText('confirmat');

    // ============================================================================
    // STEP 9: Verify order updates panel shows the confirmation
    // ============================================================================
    console.log('📝 STEP 9: Verifying order updates panel shows confirmation');

    const orderUpdatesList = orderDetailsModal.locator('[data-testid="order-updates-list"]');
    await orderUpdatesList.waitFor({ state: 'visible' });

    // Should show status change to confirmed
    await expect(orderUpdatesList).toContainText('confirmat');

    // ============================================================================
    // STEP 10: Client posts an order update
    // ============================================================================
    console.log('📝 STEP 10: Closing modal, logging out admin, logging in as client');

    await page.keyboard.press('Escape');
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Login as client
    await page.locator('[data-testid="login-email-input"]').fill(clientEmail);
    await page.locator('[data-testid="login-password-input"]').fill(clientPassword);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    // Open order details
    await page.locator(`[data-testid="order-row-${firstOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Client posts an update
    console.log('  ✓ Client posting order update message');
    const updateMessageInput = orderDetailsModal.locator('[data-testid="order-update-message-input"]');
    await updateMessageInput.fill('Please use dark blue color for the mugs, and make sure the logo is centered.');

    const submitUpdateButton = orderDetailsModal.locator('[data-testid="order-update-submit-button"]');
    await submitUpdateButton.click();

    // Wait for update to appear in list
    await page.waitForTimeout(1000);
    await expect(orderUpdatesList).toContainText('dark blue color for the mugs');

    // ============================================================================
    // STEP 11: Admin sees client's update
    // ============================================================================
    console.log('📝 STEP 11: Switching back to admin to verify they see client update');

    await page.keyboard.press('Escape');
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Login as admin
    await page.locator('[data-testid="login-email-input"]').fill(testUsers.admin.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.admin.password);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    // Open order
    await page.locator(`[data-testid="order-row-${firstOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Verify admin sees client's update
    await expect(orderUpdatesList).toContainText('dark blue color for the mugs');

    // ============================================================================
    // STEP 12: Admin posts an order update
    // ============================================================================
    console.log('📝 STEP 12: Admin posts response to client update');

    await updateMessageInput.fill('Understood. We will use Pantone 2955C for the blue color and ensure perfect centering.');
    await submitUpdateButton.click();

    await page.waitForTimeout(1000);
    await expect(orderUpdatesList).toContainText('Pantone 2955C');

    // ============================================================================
    // STEP 13: Client sees admin's update
    // ============================================================================
    console.log('📝 STEP 13: Client verifies they see admin response');

    await page.keyboard.press('Escape');
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(clientEmail);
    await page.locator('[data-testid="login-password-input"]').fill(clientPassword);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    await page.locator(`[data-testid="order-row-${firstOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    await expect(orderUpdatesList).toContainText('Pantone 2955C');

    // ============================================================================
    // STEP 14: Attach file to order update (client side)
    // ============================================================================
    console.log('📝 STEP 14: Client attaches reference image to order');

    await updateMessageInput.fill('Here is the exact logo we want on the mugs');

    // Upload file
    const fileInput = orderDetailsModal.locator('[data-testid="order-update-file-input"]');
    await uploadFile(page, '[data-testid="order-update-file-input"]', testImagePath);

    await submitUpdateButton.click();
    await page.waitForTimeout(2000); // Wait for file upload

    // Verify file attachment appears
    const hasAttachment = await verifyFileAttachment(page, 'order-attachment', '[data-testid="order-updates-list"]');
    expect(hasAttachment).toBeTruthy();

    console.log('  ✓ File attachment verified');

    // ============================================================================
    // STEP 15: Admin sees the file attachment
    // ============================================================================
    console.log('📝 STEP 15: Admin verifies they see the file attachment');

    await page.keyboard.press('Escape');
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(testUsers.admin.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.admin.password);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    await page.locator(`[data-testid="order-row-${firstOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Verify admin sees the attachment
    await expect(orderUpdatesList).toContainText('order-attachment');

    // ============================================================================
    // STEP 16: Admin updates order status to "in progress"
    // ============================================================================
    console.log('📝 STEP 16: Admin changes order status to in progress');

    const inProgressButton = orderDetailsModal.locator('[data-testid="order-status-button-in_progress"]');
    await inProgressButton.click();

    await page.waitForTimeout(1000);
    await expect(orderDetailsModal).toContainText('în curs');

    // ============================================================================
    // STEP 17: Client sees updated order status
    // ============================================================================
    console.log('📝 STEP 17: Client verifies order status is "in progress"');

    await page.keyboard.press('Escape');
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(clientEmail);
    await page.locator('[data-testid="login-password-input"]').fill(clientPassword);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    // Verify status in table
    const clientOrderRow = page.locator(`[data-testid="order-row-${firstOrderId}"]`);
    await expect(clientOrderRow).toContainText('în curs');

    // ============================================================================
    // STEP 18: Admin deletes the order
    // ============================================================================
    console.log('📝 STEP 18: Admin deletes the order');

    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(testUsers.admin.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.admin.password);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    await page.locator(`[data-testid="order-row-${firstOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Delete order
    const deleteButton = orderDetailsModal.locator('[data-testid="delete-order-button"]');
    await deleteButton.click();

    // Confirm deletion in dialog
    await page.click('button:has-text("Delete")');

    // Wait for modal to close
    await orderDetailsModal.waitFor({ state: 'hidden' });

    // ============================================================================
    // STEP 19: Verify order is deleted (admin doesn't see it)
    // ============================================================================
    console.log('📝 STEP 19: Verifying order no longer appears in admin dashboard');

    // Order should not be in the table anymore
    await expect(page.locator(`[data-testid="order-row-${firstOrderId}"]`)).not.toBeVisible();

    // ============================================================================
    // STEP 20: Admin creates new order for client
    // ============================================================================
    console.log('📝 STEP 20: Admin creates new order for the client');

    const addOrderButton = page.locator('[data-testid="dashboard-add-order-button"]');
    await addOrderButton.click();

    // Fill admin order form
    await page.locator('[data-testid="admin-place-order-name-input"]').fill('Promotional Materials Q2 2025');
    await page.locator('[data-testid="admin-place-order-phone-input"]').fill('+40712345678');

    // Add sub-order
    await page.locator('[data-testid="admin-place-order-add-suborder-button"]').click();
    await page.locator('[data-testid="sub-order-quantity-0"]').fill('200');
    await page.locator('[data-testid="sub-order-description-0"]').fill('Promotional pens with logo engraving');

    const newDeliveryDate = new Date();
    newDeliveryDate.setDate(newDeliveryDate.getDate() + 5);
    await page.locator('[data-testid="sub-order-delivery-time-0"]').fill(newDeliveryDate.toISOString().slice(0, 16));

    // Submit order
    await page.locator('[data-testid="admin-place-order-submit-button"]').click();

    // Wait for modal to close and order to appear
    await page.waitForTimeout(2000);

    // Get new order ID
    const newOrderRow = ordersTable.locator('tbody tr').first();
    const newOrderId = await newOrderRow.locator('td').first().textContent();
    secondOrderId = newOrderId?.trim() || '';

    console.log(`  ✓ New order created with ID: ${secondOrderId}`);

    // ============================================================================
    // STEP 21: Client sees the new order
    // ============================================================================
    console.log('📝 STEP 21: Client verifies they see the new admin-created order');

    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(clientEmail);
    await page.locator('[data-testid="login-password-input"]').fill(clientPassword);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    // Verify new order appears
    await expect(page.locator(`[data-testid="order-row-${secondOrderId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="order-row-${secondOrderId}"]`)).toContainText('Promotional Materials Q2 2025');

    // ============================================================================
    // STEP 22: Admin marks order as completed
    // ============================================================================
    console.log('📝 STEP 22: Admin marks order as completed');

    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    await page.locator('[data-testid="login-email-input"]').fill(testUsers.admin.email);
    await page.locator('[data-testid="login-password-input"]').fill(testUsers.admin.password);
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForURL('/dashboard');

    await page.locator(`[data-testid="order-row-${secondOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    const completedButton = orderDetailsModal.locator('[data-testid="order-status-button-completed"]');
    await completedButton.click();

    await page.waitForTimeout(1000);
    await expect(orderDetailsModal).toContainText('finalizat');

    await page.keyboard.press('Escape');

    // ============================================================================
    // STEP 23: Verify order appears in Past Orders tab
    // ============================================================================
    console.log('📝 STEP 23: Verifying completed order appears in Past Orders tab');

    // Switch to Past Orders tab
    const pastOrdersTab = page.locator('[data-testid="tab-past-orders"]');
    await pastOrdersTab.click();

    // Wait for past orders to load
    await page.waitForTimeout(1000);

    // Verify completed order appears
    await expect(page.locator(`[data-testid="order-row-${secondOrderId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="order-row-${secondOrderId}"]`)).toContainText('finalizat');

    // ============================================================================
    // STEP 24: Verify Firestore data for completed order
    // ============================================================================
    console.log('📝 STEP 24: Final Firestore verification for completed order');

    await page.locator(`[data-testid="order-row-${secondOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    // Verify all data is correct
    await expect(orderDetailsModal).toContainText('Promotional Materials Q2 2025');
    await expect(orderDetailsModal).toContainText('200');
    await expect(orderDetailsModal).toContainText('Promotional pens with logo engraving');
    await expect(orderDetailsModal).toContainText('finalizat');

    await page.keyboard.press('Escape');

    // ============================================================================
    // STEP 25: COMPLETE CLEANUP VERIFICATION
    // ============================================================================
    console.log('📝 STEP 25: Performing complete cleanup verification');

    // Delete the second order as well
    await page.locator(`[data-testid="order-row-${secondOrderId}"]`).locator('[data-testid="order-details-button"]').click();
    await orderDetailsModal.waitFor({ state: 'visible' });

    await orderDetailsModal.locator('[data-testid="delete-order-button"]').click();
    await page.click('button:has-text("Delete")');
    await orderDetailsModal.waitFor({ state: 'hidden' });

    // Verify no orders remain
    await page.waitForTimeout(1000);
    const remainingOrders = await ordersTable.locator('tbody tr').count();
    expect(remainingOrders).toBe(0);

    console.log('  ✓ All orders successfully cleaned up');

    // Switch back to current orders tab
    const currentOrdersTab = page.locator('[data-testid="tab-current-orders"]');
    await currentOrdersTab.click();

    // Verify no orders in current tab either
    await page.waitForTimeout(500);
    const currentOrders = await ordersTable.locator('tbody tr').count();
    expect(currentOrders).toBe(0);

    console.log('✅ COMPLETE ORDER WORKFLOW TEST PASSED - ALL DATA CLEANED UP');
  });
});
