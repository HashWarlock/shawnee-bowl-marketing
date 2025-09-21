-- Initialize database for Customer Management System
-- This file is executed when the PostgreSQL container starts for the first time

-- Create database if not exists (PostgreSQL automatically creates the database from POSTGRES_DB)
-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: The actual schema tables will be created by Drizzle ORM when the application starts
-- This file ensures the database is ready with necessary extensions