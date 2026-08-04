# Girijasoft Invoice System

Client management and invoicing — separate Next.js frontend and NestJS backend, powered by MongoDB.

## Stack

| App | Path | Tech | Port |
|-----|------|------|------|
| Frontend | `frontend/` | Next.js + Tailwind | 3000 |
| Backend | `backend/` | NestJS + Prisma | 3001 |
| Database | MongoDB replica set | `mamaji_invoice` | 27017 |

## Prerequisites

- Node.js 20+
- MongoDB Community Edition

## 1. Start MongoDB

```bash
brew services start mongodb-community
# Prisma's MongoDB connector requires a replica set for transactions.
# Configure mongod with `replication.replSetName: rs0`, then initialize it once:
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

## 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:push
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

## Import an existing MySQL database

Keep `MYSQL_DATABASE_URL` pointed at the old MySQL database and
`DATABASE_URL` pointed at an empty MongoDB database, then run:

```bash
cd backend
npm run prisma:push
npm run data:migrate:mysql-to-mongo
```

The importer preserves record IDs and refuses to overwrite a non-empty MongoDB
database by default. The original SQL migration files remain under
`backend/prisma/migrations` as historical reference only.

## Features

- Dashboard with KPIs and recent activity
- Clients, Quotations, Invoices (with PDF download), Payments, Products
- Settings: general, invoice defaults, tax rates, invoice groups, payment methods

## Smoke test

1. Open http://localhost:3000/clients → Add Client  
2. Open http://localhost:3000/invoices/new → create invoice with line items  
3. Open the invoice → Download PDF  

# invoice-system
