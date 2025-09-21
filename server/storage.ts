import {
  users,
  customers,
  exportJobs,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type ExportJob,
  type InsertExportJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or, desc, count } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomers(options: {
    search?: string;
    consentMailing?: boolean;
    state?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ customers: Customer[]; total: number }>;
  getCustomer(id: string): Promise<Customer | undefined>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  getCustomersByIds(ids: string[]): Promise<Customer[]>;
  
  // Export job operations
  createExportJob(job: InsertExportJob): Promise<ExportJob>;
  getExportJob(id: string): Promise<ExportJob | undefined>;
  updateExportJob(id: string, updates: Partial<ExportJob>): Promise<ExportJob>;
  getRecentExportJobs(userId: string, limit?: number): Promise<ExportJob[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // First try to find existing user by id
      if (userData.id) {
        const existingUser = await this.getUser(userData.id);
        if (existingUser) {
          // Update existing user by id
          const [user] = await db
            .update(users)
            .set({
              ...userData,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userData.id))
            .returning();
          return user;
        }
      }

      // Try to insert new user
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
      return user;
    } catch (error: any) {
      // If we get a unique constraint error on email, try to update by email
      if (error?.code === '23505' && error?.constraint?.includes('email')) {
        const [user] = await db
          .update(users)
          .set({
            ...userData,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email!))
          .returning();
        return user;
      }
      throw error;
    }
  }

  // Customer operations
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db
      .insert(customers)
      .values(customer)
      .returning();
    return newCustomer;
  }

  async getCustomers(options: {
    search?: string;
    consentMailing?: boolean;
    state?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const { search, consentMailing, state, page = 1, perPage = 25 } = options;
    
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(customers.firstName, `%${search}%`),
          like(customers.lastName, `%${search}%`),
          like(customers.email, `%${search}%`),
          like(customers.company, `%${search}%`)
        )
      );
    }
    
    if (consentMailing !== undefined) {
      conditions.push(eq(customers.consentMailing, consentMailing));
    }
    
    if (state) {
      conditions.push(eq(customers.state, state));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(customers)
      .where(whereClause);
    
    // Get paginated results
    const customerList = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    
    return { customers: customerList, total };
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async getCustomersByIds(ids: string[]): Promise<Customer[]> {
    if (ids.length === 0) return [];
    return await db.select().from(customers).where(
      or(...ids.map(id => eq(customers.id, id)))
    );
  }

  // Export job operations
  async createExportJob(job: InsertExportJob): Promise<ExportJob> {
    const [newJob] = await db
      .insert(exportJobs)
      .values(job)
      .returning();
    return newJob;
  }

  async getExportJob(id: string): Promise<ExportJob | undefined> {
    const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id));
    return job;
  }

  async updateExportJob(id: string, updates: Partial<ExportJob>): Promise<ExportJob> {
    const [updatedJob] = await db
      .update(exportJobs)
      .set(updates)
      .where(eq(exportJobs.id, id))
      .returning();
    return updatedJob;
  }

  async getRecentExportJobs(userId: string, limit = 10): Promise<ExportJob[]> {
    return await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.createdBy, userId))
      .orderBy(desc(exportJobs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
