import { Builder, By, until } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        await driver.get('https://example.com');
        await driver.sleep(2000);

        console.log('Checking loaded extensions...');
        await driver.get('chrome://extensions/');

        const extensionCards = await driver.findElements({ css: 'extensions-item' });
        console.log(`Found ${extensionCards.length} extension(s) loaded.`);

    } catch (err) {
        console.error('Extension test failed:', err);
        process.exit(1);
    } finally {
        await driver.quit();
    }
}

runExtensionTest();