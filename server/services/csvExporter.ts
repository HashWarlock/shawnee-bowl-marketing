import { Customer } from '@shared/schema';
import { promises as fs } from 'fs';
import path from 'path';

interface CSVExportOptions {
  fields: string[];
  consentFilter?: 'all' | 'phone_only' | 'email_only' | 'both';
}

export class CSVExporter {
  static async exportCustomers(customers: Customer[], options: CSVExportOptions): Promise<string> {
    // Filter customers based on consent
    let filteredCustomers = customers;
    
    switch (options.consentFilter) {
      case 'phone_only':
        filteredCustomers = customers.filter(c => c.consentPhone);
        break;
      case 'email_only':
        filteredCustomers = customers.filter(c => c.consentEmail);
        break;
      case 'both':
        filteredCustomers = customers.filter(c => c.consentPhone && c.consentEmail);
        break;
      default:
        // 'all' - no filtering
        break;
    }

    const csvContent = this.generateCSV(filteredCustomers, options.fields);
    
    const fileName = `calllist_${Date.now()}.csv`;
    const filePath = path.join(process.cwd(), 'downloads', fileName);
    
    // Ensure downloads directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    await fs.writeFile(filePath, csvContent, 'utf8');
    
    return filePath;
  }

  private static generateCSV(customers: Customer[], fields: string[]): string {
    const headers = this.getCSVHeaders(fields);
    const rows = customers.map(customer => this.formatCustomerRow(customer, fields));
    
    return [headers, ...rows].join('\n');
  }

  private static getCSVHeaders(fields: string[]): string {
    const fieldMap: Record<string, string> = {
      firstName: 'FirstName',
      lastName: 'LastName',
      company: 'Company',
      phone: 'Phone',
      email: 'Email',
      addressLine1: 'AddressLine1',
      addressLine2: 'AddressLine2',
      city: 'City',
      state: 'State',
      zip: 'ZIP',
      consentMailing: 'ConsentMailing',
      consentEmail: 'ConsentEmail',
      consentPhone: 'ConsentPhone'
    };

    return fields.map(field => fieldMap[field] || field).join(',');
  }

  private static formatCustomerRow(customer: Customer, fields: string[]): string {
    const values = fields.map(field => {
      let value = customer[field as keyof Customer];
      
      // Handle boolean values
      if (typeof value === 'boolean') {
        value = value ? 'TRUE' : 'FALSE';
      }
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Escape CSV values that contain commas, quotes, or newlines
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });

    return values.join(',');
  }
}
