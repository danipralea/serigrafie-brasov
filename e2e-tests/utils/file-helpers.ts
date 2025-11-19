import { Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Create a test file for upload testing
 */
export function createTestFile(fileName: string, content: string): string {
  const testFilesDir = path.join(__dirname, '../fixtures/test-files');

  // Create directory if it doesn't exist
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  const filePath = path.join(testFilesDir, fileName);
  fs.writeFileSync(filePath, content);

  return filePath;
}

/**
 * Create a test image file for upload testing
 */
export function createTestImage(fileName: string = 'test-image.png'): string {
  const testFilesDir = path.join(__dirname, '../fixtures/test-files');

  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  const filePath = path.join(testFilesDir, fileName);

  // Create a simple 1x1 PNG image (smallest valid PNG)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
    0x1f, 0x15, 0xc4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0a, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed image data
    0x0d, 0x0a, 0x2d, 0xb4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82  // CRC
  ]);

  fs.writeFileSync(filePath, pngBuffer);

  return filePath;
}

/**
 * Create a test PDF file
 */
export function createTestPDF(fileName: string = 'test-document.pdf'): string {
  const testFilesDir = path.join(__dirname, '../fixtures/test-files');

  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  const filePath = path.join(testFilesDir, fileName);

  // Minimal valid PDF content
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000270 00000 n
0000000363 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
451
%%EOF`;

  fs.writeFileSync(filePath, pdfContent);

  return filePath;
}

/**
 * Upload a file to a file input
 */
export async function uploadFile(page: Page, inputSelector: string, filePath: string): Promise<void> {
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(filePath);
}

/**
 * Wait for file upload to complete (polls for success indicator)
 */
export async function waitForFileUpload(
  page: Page,
  options: {
    successSelector?: string;
    errorSelector?: string;
    timeout?: number;
  } = {}
): Promise<'success' | 'error'> {
  const {
    successSelector = '[data-upload-status="success"]',
    errorSelector = '[data-upload-status="error"]',
    timeout = 30000
  } = options;

  try {
    await page.waitForSelector(`${successSelector}, ${errorSelector}`, {
      timeout,
      state: 'visible'
    });

    // Check which one appeared
    const hasSuccess = await page.locator(successSelector).isVisible();
    return hasSuccess ? 'success' : 'error';
  } catch (error) {
    throw new Error(`File upload did not complete within ${timeout}ms`);
  }
}

/**
 * Verify file appears in attachment list
 */
export async function verifyFileAttachment(
  page: Page,
  fileName: string,
  containerSelector: string = '[data-testid="order-updates-list"]'
): Promise<boolean> {
  const container = page.locator(containerSelector);
  const fileLink = container.locator(`a:has-text("${fileName}")`);

  // Wait for file to appear
  await fileLink.waitFor({ state: 'visible', timeout: 10000 });

  return await fileLink.isVisible();
}

/**
 * Cleanup test files
 */
export function cleanupTestFiles(): void {
  const testFilesDir = path.join(__dirname, '../fixtures/test-files');

  if (fs.existsSync(testFilesDir)) {
    const files = fs.readdirSync(testFilesDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testFilesDir, file));
    }
    fs.rmdirSync(testFilesDir);
  }
}
