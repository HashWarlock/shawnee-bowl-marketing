import puppeteer from 'puppeteer';
import { Customer } from '@shared/schema';
import { promises as fs } from 'fs';
import path from 'path';

interface LabelOptions {
  template: 'avery_5160' | 'avery_5161' | 'avery_5162';
  paperSize: 'letter' | 'a4';
  includeCompany: boolean;
  copies: number;
}

export class PDFGenerator {
  static async generateLabels(customers: Customer[], options: LabelOptions): Promise<string> {
    console.log('Starting PDF generation for', customers.length, 'customers');
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions'
      ]
    });
    
    console.log('Browser launched successfully');

    try {
      console.log('Creating new page...');
      const page = await browser.newPage();
      
      console.log('Generating HTML content...');
      const html = this.generateLabelHTML(customers, options);
      
      console.log('Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const fileName = `labels_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'downloads', fileName);
      
      console.log('Creating downloads directory:', path.dirname(filePath));
      // Ensure downloads directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      console.log('Generating PDF at:', filePath);
      await page.pdf({
        path: filePath,
        format: options.paperSize === 'letter' ? 'letter' : 'a4',
        printBackground: true,
        margin: {
          top: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
          right: '0.5in'
        }
      });
      
      console.log('PDF generated successfully:', filePath);
      return filePath;
    } catch (error) {
      console.error('Error during PDF generation:', error);
      throw error;
    } finally {
      console.log('Closing browser...');
      await browser.close();
    }
  }

  private static generateLabelHTML(customers: Customer[], options: LabelOptions): string {
    const labels = this.generateLabelsForTemplate(customers, options);
    
    return `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mailing Labels</title>
        <style>
          @page { 
            size: ${options.paperSize}; 
            margin: 0.5in; 
          }
          body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif; 
            font-size: 12pt; 
          }
          .labels { 
            width: 100%; 
            display: grid; 
            ${this.getGridTemplate(options.template)}
            gap: 0.125in 0.125in; 
          }
          .label {
            padding: 6px 8px;
            box-sizing: border-box;
            ${this.getLabelDimensions(options.template)}
            overflow: hidden;
            page-break-inside: avoid;
          }
          .name { 
            font-weight: 700; 
            margin-bottom: 2px;
          }
          .company {
            margin-bottom: 2px;
            font-size: 11pt;
          }
          .addr { 
            white-space: pre-wrap; 
            line-height: 1.2;
          }
        </style>
      </head>
      <body>
        <div class="labels">
          ${labels}
        </div>
      </body>
      </html>
    `;
  }

  private static generateLabelsForTemplate(customers: Customer[], options: LabelOptions): string {
    let labels = '';
    
    for (let copy = 0; copy < options.copies; copy++) {
      for (const customer of customers) {
        const addressParts = [
          customer.addressLine1,
          customer.addressLine2,
          `${customer.city}, ${customer.state} ${customer.zip}`
        ].filter(Boolean);

        labels += `
          <div class="label">
            <div class="name">${customer.firstName} ${customer.lastName}</div>
            ${options.includeCompany && customer.company ? `<div class="company">${customer.company}</div>` : ''}
            <div class="addr">${addressParts.join('\n')}</div>
          </div>
        `;
      }
    }
    
    return labels;
  }

  private static getGridTemplate(template: string): string {
    switch (template) {
      case 'avery_5160':
        return 'grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1.0in;';
      case 'avery_5161':
        return 'grid-template-columns: repeat(2, 1fr); grid-auto-rows: 1.0in;';
      case 'avery_5162':
        return 'grid-template-columns: repeat(2, 1fr); grid-auto-rows: 1.33in;';
      default:
        return 'grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1.0in;';
    }
  }

  private static getLabelDimensions(template: string): string {
    switch (template) {
      case 'avery_5160':
        return 'height: 1.0in; width: 2.625in;';
      case 'avery_5161':
        return 'height: 1.0in; width: 4.0in;';
      case 'avery_5162':
        return 'height: 1.33in; width: 4.0in;';
      default:
        return 'height: 1.0in; width: 2.625in;';
    }
  }
}
