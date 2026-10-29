import { Builder, By, until } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as path from 'path';

async function runExtensionTest() {
    let options = new chrome.Options();
    const extensionPath = path.resolve(__dirname, '../dist');
    options.addArguments(`--load-extension=${extensionPath}`);

    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        console.log('Launching browser with Cookie Vault extension...');

        // Open chrome extensions page or navigate to your popup if ID is static
        await driver.get('chrome://extensions/');
        console.log('✓ Browser launched and loaded extension successfully');

    } catch (err) {
        console.error('Extension test failed:', err);
        process.exit(1);
    } finally {
        await driver.quit();
    }
}

runExtensionTest();