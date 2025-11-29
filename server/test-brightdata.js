#!/usr/bin/env node
/**
 * Simple test script for Bright Data Browser API
 * Based on official documentation: https://docs.brightdata.com/scraping-automation/scraping-browser/code-examples
 */

const puppeteer = require('puppeteer-core');
require('dotenv').config();

const SBR_WS_ENDPOINT = process.env.BRIGHTDATA_SCRAPING_BROWSER;

async function testConnection() {
  if (!SBR_WS_ENDPOINT) {
    console.error('❌ BRIGHTDATA_SCRAPING_BROWSER not set in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to Bright Data Scraping Browser...');
  console.log('   Endpoint:', SBR_WS_ENDPOINT.replace(/:[^:]+@/, ':****@')); // Hide password

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: SBR_WS_ENDPOINT,
    });

    console.log('✅ Connected!');

    const page = await browser.newPage();
    console.log('📄 New page created');

    // Navigate to httpbin which is allowed
    console.log('🌐 Navigating to httpbin.org/ip...');
    await page.goto('https://httpbin.org/ip', { timeout: 60000 });

    // Get the response
    const content = await page.evaluate(() => document.body.innerText);
    const ipData = JSON.parse(content);

    console.log('✅ Success! Your proxy IP:');
    console.log('   IP:', ipData.origin);

    await browser.close();
    console.log('🔒 Browser closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testConnection();

