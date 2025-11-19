# Complete Order Workflow E2E Test

## Overview

This test (`complete-order-flow.spec.ts`) is the **most comprehensive e2e test** for the Serigrafie Brasov application. It validates the **entire order lifecycle** from A to Z.

## What This Test Covers

### ✅ **25 Test Steps - Full Happy Path**

1. **Non-authenticated client places order** (3 sub-orders with different products)
2. **Client signs up** during order placement
3. **Order appears on client dashboard** with correct data
4. **Firestore data validation** (all order details correct)
5. **Admin login** and access verification
6. **Admin sees client order** in their dashboard
7. **Admin views complete order details** (all sub-orders visible)
8. **Admin confirms order** (status change to "confirmed")
9. **Order updates panel** shows confirmation
10. **Client posts order update** with message
11. **Admin sees client's update** immediately
12. **Admin responds** to client update
13. **Client sees admin's response** immediately
14. **Client attaches file** to order update (image upload)
15. **Admin sees file attachment** in updates
16. **Admin changes status** to "in progress"
17. **Client sees updated status** in real-time
18. **Admin deletes order** (first order cleanup)
19. **Order disappears** from admin dashboard
20. **Admin creates new order** for the client
21. **Client sees new order** immediately
22. **Admin marks order as completed**
23. **Final Firestore verification** for completed order
24. **Order appears in Past Orders tab** correctly
25. **Complete cleanup** - all test data removed

### 🎯 **Key Features Tested**

- ✅ **Multi-sub-order creation** (3 sub-orders with different delivery dates)
- ✅ **Authentication flow** (signup during order placement)
- ✅ **Role-based access** (client vs admin permissions)
- ✅ **Real-time updates** (order status changes visible to both parties)
- ✅ **Bidirectional communication** (client ↔ admin updates)
- ✅ **File attachments** (image upload with verification)
- ✅ **Order status lifecycle** (pending → confirmed → in progress → completed)
- ✅ **Order management** (create, update, delete)
- ✅ **Admin-created orders** (on behalf of clients)
- ✅ **Past orders view** (completed orders tab)
- ✅ **Complete data cleanup** (zero residual data after test)

## Test Data

### Users Created
- **New Client**: `client-{timestamp}@test.com` (unique per test run)
- **Existing Admin**: Uses `testUsers.admin` from fixtures

### Orders Created
- **First Order**: 3 sub-orders (Mugs, T-Shirts, Hoodies) - Created by client, then deleted by admin
- **Second Order**: 1 sub-order (Promotional pens) - Created by admin, marked as completed

### Files
- **Test Image**: Auto-generated PNG file for attachment testing
- **Auto-cleanup**: All files removed after test completion

## Running the Test

### Prerequisites

```bash
# Ensure Firebase emulators are installed
firebase setup:emulators:firestore

# Ensure dependencies are installed
npm install
```

### Run Commands

```bash
# Run this specific test only
npx playwright test complete-order-flow

# Run in headed mode (see browser)
npx playwright test complete-order-flow --headed

# Run in UI mode (interactive debugging)
npx playwright test complete-order-flow --ui

# Run in debug mode (step through)
npx playwright test complete-order-flow --debug
```

### Expected Duration
- **Headless mode**: ~60-90 seconds
- **Headed mode**: ~90-120 seconds

## Test Structure

```typescript
test.describe('Complete Order Workflow - Full Happy Path', () => {
  test.beforeAll() // Setup test data and files
  test.afterAll()  // Cleanup test files

  test('should complete full order workflow...', async ({ page, testUsers }) => {
    // 25 comprehensive steps with detailed logging
  })
});
```

## Verification Points

### Data Integrity Checks
- ✅ Order IDs match between client and admin views
- ✅ Phone numbers persisted correctly
- ✅ Sub-order quantities and descriptions exact
- ✅ Delivery dates preserved
- ✅ Order status changes synchronized
- ✅ File attachments accessible to both parties

### UI Verification
- ✅ All elements loaded (no timeouts)
- ✅ Modals open/close correctly
- ✅ Tabs switch properly
- ✅ Buttons respond correctly
- ✅ Forms submit successfully

### Cleanup Verification
- ✅ Zero orders remaining after test
- ✅ No orphaned updates
- ✅ No residual files
- ✅ Clean emulator state for next test

## Debugging

### Console Logs
The test includes **detailed step-by-step logging**:

```
📝 STEP 1: Non-authenticated client places order with multiple sub-orders
  ✓ Filling first sub-order (Mugs)
  ✓ Adding second sub-order (T-Shirts)
  ✓ Adding third sub-order (Hoodies)
📝 STEP 2: Client signs up with email and password
  ✓ Order created with ID: ord_abc123
...
✅ COMPLETE ORDER WORKFLOW TEST PASSED - ALL DATA CLEANED UP
```

### Common Issues

**Issue**: Test times out waiting for element
- **Solution**: Check that `data-testid` attributes are present in components
- **Verify**: Run `npx playwright codegen http://localhost:5173` to inspect elements

**Issue**: Order not appearing in dashboard
- **Solution**: Check Firestore emulator is running on port 8080
- **Verify**: Visit http://localhost:4000 (Emulator UI)

**Issue**: File upload fails
- **Solution**: Check Storage emulator is running on port 9199
- **Verify**: Test file creation in `test.beforeAll()`

## Best Practices Used

### ✅ **No Timeouts**
```typescript
// ❌ BAD
await page.waitForTimeout(5000);

// ✅ GOOD
await element.waitFor({ state: 'visible', timeout: 10000 });
```

### ✅ **Poll Instead of Sleep**
```typescript
// ❌ BAD
await page.waitForTimeout(1000);

// ✅ GOOD
await page.waitForSelector('[data-testid="element"]', { state: 'visible' });
```

### ✅ **Descriptive Names**
```typescript
// ❌ BAD
const btn = page.locator('button');

// ✅ GOOD
const submitOrderButton = page.locator('[data-testid="place-order-submit-button"]');
```

### ✅ **Data TestIDs Only**
```typescript
// ❌ BAD (fragile)
await page.click('button:has-text("Submit")');

// ✅ GOOD (reliable)
await page.click('[data-testid="place-order-submit-button"]');
```

### ✅ **Complete Cleanup**
Every order, update, and file created during the test is **explicitly deleted** before test completion.

## Future Enhancements

These can be added as separate tests:

1. **Calendar Integration**: Verify orders appear on calendar with correct dates
2. **Order Filtering**: Test status/product filters
3. **Order Search**: Test search functionality
4. **Invoice Generation**: Test PDF download
5. **Notifications**: Test real-time notifications
6. **Validation**: Test form validation errors
7. **Permission Boundaries**: Test unauthorized access attempts

## Success Criteria

The test passes when:
- ✅ All 25 steps execute without errors
- ✅ All assertions pass
- ✅ No elements timeout
- ✅ Complete cleanup verified
- ✅ Console log shows: "✅ COMPLETE ORDER WORKFLOW TEST PASSED"

## Maintenance

### Updating the Test

When adding new features:
1. Add `data-testid` to new UI elements
2. Add verification steps to appropriate section
3. Update cleanup logic if new data is created
4. Run test locally before committing

### Test ID Naming Convention

Follow this pattern for consistency:
- `{page}-{element}-{action}` (e.g., `dashboard-add-order-button`)
- `{component}-{element}-{index}` (e.g., `sub-order-quantity-0`)
- Use kebab-case (e.g., `order-details-modal`)

---

**This is the gold standard e2e test for the application.** All future tests should follow similar patterns for comprehensive coverage and reliable execution.
