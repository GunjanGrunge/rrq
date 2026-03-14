import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser: Browser | null = null;

/**
 * Get a shared Puppeteer browser instance.
 * Uses @sparticuz/chromium for Lambda-compatible headless Chrome.
 */
export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) {
    return browser;
  }

  browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  return browser;
}

/**
 * Close the browser instance — call in cleanup.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
