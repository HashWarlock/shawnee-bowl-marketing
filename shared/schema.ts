import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer storage table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  company: varchar("company"),
  addressLine1: varchar("address_line_1").notNull(),
  addressLine2: varchar("address_line_2"),
  city: varchar("city").notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zip: varchar("zip", { length: 10 }).notNull(),
  phone: varchar("phone"),
  email: varchar("email"),
  consentMailing: boolean("consent_mailing").default(true),
  consentEmail: boolean("consent_email").default(true),
  consentPhone: boolean("consent_phone").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Export jobs table
export const exportJobs = pgTable("export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'labels' or 'calllist'
  status: varchar("status").default('pending'), // 'pending', 'processing', 'completed', 'failed'
  customerCount: varchar("customer_count"),
  fileName: varchar("file_name"),
  filePath: varchar("file_path"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "ZIP code must be in format 12345 or 12345-6789"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  state: z.string().length(2, "State must be 2 characters"),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertExportJob = typeof exportJobs.$inferInsert;

// Address validation types for multi-provider system
export enum AddressProvider {
  SMARTY = 'smarty',
  GOOGLE = 'google',
  USPS = 'usps'
}

export interface AddressValidationInput {
  streetAddress: string;
  city?: string;
  state: string;
  ZIPCode?: string;
  secondaryAddress?: string; // Apartment, suite, etc.
}

export interface StandardizedAddress {
  streetAddress: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
  secondaryAddress?: string;
}

export interface NormalizedResult {
  isValid: boolean;
  standardizedAddress?: StandardizedAddress;
  suggestions?: string[];
  errors?: string[];
  serviceUnavailable?: boolean;
  provider: AddressProvider;
  latencyMs: number;
  didFallback?: boolean;
  confidence?: number; // 0-100 confidence score
}

export interface IAddressValidator {
  validate(input: AddressValidationInput): Promise<NormalizedResult>;
  isEnabled(): boolean;
  getProviderName(): AddressProvider;
}

// Validation schemas for API requests
export const addressValidationInputSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().optional(),
  state: z.string().length(2, "State must be 2 characters"),
  ZIPCode: z.string().regex(/^\d{5}(-\d{4})?$/, "ZIP code must be in format 12345 or 12345-6789").optional(),
  secondaryAddress: z.string().optional(),
});

export type AddressValidationInputType = z.infer<typeof addressValidationInputSchema>;
