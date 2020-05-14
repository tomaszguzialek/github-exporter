const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.setExtraHTTPHeaders({'Cookie': '<cookie_header_value_placeholder>'});
    await page.goto('<page_to_be_saved_url_placeholder>');
    await page.pdf({path: '<pdf_output_file_placeholder>'});

    await browser.close();
})();