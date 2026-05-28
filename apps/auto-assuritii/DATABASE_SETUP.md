# Database Setup - NeonDB + Drizzle ORM

## Prerequisites

1. Create a [Neon](https://neon.tech) account
2. Create a new Neon project
3. Copy the database connection string

## Setup Steps

### 1. Configure Environment Variables

Create a `.env.local` file in the `apps/auto-assuritii` directory:

```bash
cp .env.local.example .env.local
```

Update the `DATABASE_URL` with your Neon connection string:

```env
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

### 2. Push Schema to Database

For development, you can push the schema directly:

```bash
pnpm db:push
```

Or generate and run migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

### 3. View Database (Optional)

Open Drizzle Studio to view and edit your database:

```bash
pnpm db:studio
```

This will open a local web interface at `https://local.drizzle.studio`

## Available Scripts

- `pnpm db:generate` - Generate migration files from schema changes
- `pnpm db:migrate` - Run pending migrations
- `pnpm db:push` - Push schema changes directly (dev only)
- `pnpm db:studio` - Open Drizzle Studio

## Database Schema

### Tables

#### `users`

- Stores user contact information
- Fields: firstName, lastName, email, phoneNumber, zipCode

#### `vehicle_quotes`

- Stores vehicle quote requests
- References `users` table
- Fields: carYear, carMake, carModel, currentMileage

## Usage in Code

```typescript
import { db } from "@/lib/db"
import { users, vehicleQuotes } from "@/lib/db/schema"

// Insert a new user
const [user] = await db
  .insert(users)
  .values({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phoneNumber: "8443100460",
    zipCode: "12345",
  })
  .returning()

// Query users
const allUsers = await db.select().from(users)
```

## Notes

- The database uses Neon's HTTP driver for serverless compatibility
- Connection pooling is handled by Neon
- All timestamps are stored in UTC
