import { Builder, By } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as path from 'path';

async function runTest() {
    let options = new chrome.Options();
    const extensionPath = path.resolve(__dirname, '../dist');
    options.addArguments(`--load-extension=${extensionPath}`);

    // Build driver with extension options
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        // Load a page for example cookies
        await driver.get('https://example.com');
        console.log('Browser launched with extension');

    } finally {
        // Clean up and close browser
        await driver.quit();
    }
}

runTest().catch((err) => {
    console.error('Test failed:', err);
});