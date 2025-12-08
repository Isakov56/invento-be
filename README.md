# Retail POS System - Backend

Backend API for the Retail Point of Sale and Inventory Management System.

## Tech Stack

- Node.js with Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT Authentication
- bcryptjs for password hashing

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Update the `DATABASE_URL` with your PostgreSQL credentials:
```
DATABASE_URL="postgresql://username:password@localhost:5432/retail_pos_db?schema=public"
```

### 3. Setup Database

Create a PostgreSQL database:

```bash
createdb retail_pos_db
```

Or using SQL:
```sql
CREATE DATABASE retail_pos_db;
```

### 4. Run Prisma Migrations

Generate Prisma Client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (protected)
- `PUT /api/auth/profile` - Update user profile (protected)
- `PUT /api/auth/change-password` - Change password (protected)

### Health Check

- `GET /health` - Server health check

## Database Schema

The system uses the following main tables:

- **Users** - User accounts with role-based access
- **Stores** - Multiple store locations
- **Categories** - Product categories
- **Products** - Main product information
- **ProductVariants** - Product variations (size, color, SKU)
- **Transactions** - Sales and refunds
- **TransactionItems** - Items in each transaction

## User Roles

- **OWNER** - Full access to all features
- **MANAGER** - Access to inventory, sales, and reports
- **CASHIER** - Access to POS and basic inventory viewing

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- SQL injection prevention (Prisma)
- XSS protection
- CORS configuration

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middlewares/    # Custom middleware
│   ├── models/         # Database models (Prisma)
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   ├── types/          # TypeScript types
│   └── server.ts       # Main server file
├── prisma/
│   └── schema.prisma   # Database schema
├── uploads/            # Uploaded files
└── package.json
```

## Development

To view and manage the database, use Prisma Studio:

```bash
npm run prisma:studio
```

This will open a browser-based database GUI at `http://localhost:5555`
