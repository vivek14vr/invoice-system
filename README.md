# Mamaji Invoice System

Client management and invoicing — separate Next.js frontend and NestJS backend, powered by MySQL.

## Stack

| App | Path | Tech | Port |
|-----|------|------|------|
| Frontend | `frontend/` | Next.js + Tailwind | 3000 |
| Backend | `backend/` | NestJS + Prisma | 3001 |
| Database | local MySQL | `mamaji_invoice` | 3306 |

## Prerequisites

- Node.js 20+
- Homebrew MySQL (`brew install mysql`)

## 1. Start MySQL

```bash
brew services start mysql
mysql -u root -e "CREATE DATABASE IF NOT EXISTS mamaji_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 2. Backend

```bash
cd backend
cp .env.example .env   # already uses mysql://root@localhost:3306/mamaji_invoice
npm install
npx prisma migrate dev
npm run start:dev
```

API: http://localhost:3001

## 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App: http://localhost:3000

## Features

- Dashboard with KPIs and recent activity
- Clients, Quotations, Invoices (with PDF download), Payments, Products
- Settings: general, invoice defaults, tax rates, invoice groups, payment methods

## Smoke test

1. Open http://localhost:3000/clients → Add Client  
2. Open http://localhost:3000/invoices/new → create invoice with line items  
3. Open the invoice → Download PDF  

# invoice-system
