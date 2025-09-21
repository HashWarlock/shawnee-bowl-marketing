import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCustomerSchema } from "@shared/schema";
import { z } from "zod";
import { PDFGenerator } from "./services/pdfGenerator";
import { CSVExporter } from "./services/csvExporter";
import { uspsService } from "./services/uspsService";
import path from 'path';
import express from 'express';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Serve download files
  app.use('/downloads', express.static(path.join(process.cwd(), 'downloads')));

  // Health check endpoint for Docker
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Address validation route
  app.post('/api/validate-address', isAuthenticated, async (req, res) => {
    try {
      const addressSchema = z.object({
        streetAddress: z.string().min(1, "Street address is required"),
        city: z.string().optional(),
        state: z.string().length(2, "State must be a 2-character code"),
        ZIPCode: z.string().optional(),
        secondaryAddress: z.string().optional(),
      });

      const validatedData = addressSchema.parse(req.body);
      const result = await uspsService.validateAddress(validatedData);
      
      res.json(result);
    } catch (error) {
      console.error("Error validating address:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      } else {
        res.status(500).json({ 
          isValid: false,
          errors: ["Address validation failed. Please try again."]
        });
      }
    }
  });

  // Customer CRUD routes
  app.post('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create customer" });
      }
    }
  });

  app.get('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const { search, consentMailing, state, page = '1', perPage = '25' } = req.query;
      
      const options = {
        search: search as string,
        consentMailing: consentMailing === 'true' ? true : consentMailing === 'false' ? false : undefined,
        state: state as string,
        page: parseInt(page as string),
        perPage: parseInt(perPage as string),
      };

      const result = await storage.getCustomers(options);
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.put('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, validatedData);
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update customer" });
      }
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Export routes
  app.post('/api/exports/labels', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        customerIds: z.array(z.string()),
        labelTemplate: z.enum(['avery_5160', 'avery_5161', 'avery_5162']),
        paperSize: z.enum(['letter', 'a4']),
        includeCompany: z.boolean(),
        copies: z.number().min(1).max(10),
      });

      const validatedData = schema.parse(req.body);
      const userId = req.user.claims.sub;

      // Create export job
      const job = await storage.createExportJob({
        type: 'labels',
        status: 'processing',
        customerCount: validatedData.customerIds.length.toString(),
        createdBy: userId,
      });

      // Get customers
      const customers = await storage.getCustomersByIds(validatedData.customerIds);
      
      if (customers.length === 0) {
        await storage.updateExportJob(job.id, { status: 'failed' });
        return res.status(400).json({ message: "No customers found" });
      }

      // Generate PDF
      const filePath = await PDFGenerator.generateLabels(customers, {
        template: validatedData.labelTemplate,
        paperSize: validatedData.paperSize,
        includeCompany: validatedData.includeCompany,
        copies: validatedData.copies,
      });

      const fileName = path.basename(filePath);
      
      // Update job with completion
      await storage.updateExportJob(job.id, {
        status: 'completed',
        fileName,
        filePath: `/downloads/${fileName}`,
        completedAt: new Date(),
      });

      res.json({
        jobId: job.id,
        downloadUrl: `/downloads/${fileName}`,
        message: "Labels generated successfully"
      });

    } catch (error) {
      console.error("Error generating labels:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to generate labels" });
      }
    }
  });

  app.post('/api/exports/calllist', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        customerIds: z.array(z.string()),
        fields: z.array(z.string()),
        consentFilter: z.enum(['all', 'phone_only', 'email_only', 'both']).optional(),
      });

      const validatedData = schema.parse(req.body);
      const userId = req.user.claims.sub;

      // Create export job
      const job = await storage.createExportJob({
        type: 'calllist',
        status: 'processing',
        customerCount: validatedData.customerIds.length.toString(),
        createdBy: userId,
      });

      // Get customers
      const customers = await storage.getCustomersByIds(validatedData.customerIds);
      
      if (customers.length === 0) {
        await storage.updateExportJob(job.id, { status: 'failed' });
        return res.status(400).json({ message: "No customers found" });
      }

      // Generate CSV
      const filePath = await CSVExporter.exportCustomers(customers, {
        fields: validatedData.fields,
        consentFilter: validatedData.consentFilter || 'all',
      });

      const fileName = path.basename(filePath);
      
      // Update job with completion
      await storage.updateExportJob(job.id, {
        status: 'completed',
        fileName,
        filePath: `/downloads/${fileName}`,
        completedAt: new Date(),
      });

      res.json({
        jobId: job.id,
        downloadUrl: `/downloads/${fileName}`,
        message: "Call list exported successfully"
      });

    } catch (error) {
      console.error("Error exporting call list:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to export call list" });
      }
    }
  });

  app.get('/api/exports/jobs/:id', isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getExportJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching export job:", error);
      res.status(500).json({ message: "Failed to fetch export job" });
    }
  });

  app.get('/api/exports/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobs = await storage.getRecentExportJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching recent exports:", error);
      res.status(500).json({ message: "Failed to fetch recent exports" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
