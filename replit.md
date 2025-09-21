# Overview

This is a Customer Management System designed for direct marketing campaigns. The application allows users to collect customer contact information, generate professional mailing labels in PDF format, and create targeted call lists as CSV exports. It's built as a single-page web application with a REST API backend, focusing on U.S. customers with comprehensive consent tracking for marketing communications.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

The frontend follows a component-based architecture with three main sections: Customer Entry, Customer Management, and Exports. The application uses a tab-based navigation system and implements responsive design patterns.

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth with OpenID Connect (OIDC)
- **Session Management**: Express sessions with PostgreSQL store
- **File Generation**: Puppeteer for PDF generation, custom CSV export service
- **API Design**: RESTful endpoints with structured error handling

The backend implements a layered architecture with separate concerns for authentication, storage operations, and business logic. The storage layer uses an interface-based design for testability and flexibility.

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema definitions
- **Session Storage**: PostgreSQL-backed session store for authentication
- **File Storage**: Local filesystem for generated PDFs and CSV files

The database schema includes tables for users (required for Replit Auth), customers with full contact information and consent flags, export jobs for tracking generation tasks, and sessions for authentication state.

## Authentication and Authorization
- **Provider**: Replit Auth integration with mandatory user operations
- **Session Handling**: Express-session with PostgreSQL backing
- **Security**: HTTP-only cookies, secure flag in production, CSRF protection
- **Authorization**: Route-level authentication middleware protecting all customer and export endpoints

## Export and Generation Services
- **PDF Generation**: Puppeteer-based service for Avery label formats (5160, 5161, 5162)
- **CSV Export**: Custom service with configurable field selection and consent filtering
- **Job Tracking**: Database-backed export job tracking with status management
- **File Serving**: Express static middleware for download delivery

The system supports multiple label templates and paper sizes, with consent-based filtering for compliance with marketing regulations.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database operations and schema management

## Authentication Services
- **Replit Auth**: OIDC-based authentication provider
- **OpenID Client**: Standards-compliant authentication flow implementation

## UI and Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component library with Tailwind CSS
- **Lucide React**: Icon library for consistent visual elements

## Development and Build Tools
- **Vite**: Frontend build tool with hot module replacement
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Backend bundling for production deployment

## PDF and Document Generation
- **Puppeteer**: Headless Chrome for PDF generation
- **Custom HTML/CSS**: Label template rendering engine

## Additional Utilities
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date formatting and manipulation
- **bcrypt**: Password hashing utilities (future-proofing)