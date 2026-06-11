import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_9MjoYIAeJ5NT@ep-icy-king-ans3h5un-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS "experiment" (
      "id" text PRIMARY KEY,
      "landingPageId" text NOT NULL REFERENCES "landing_page"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "status" text NOT NULL DEFAULT 'Running',
      "variants" jsonb NOT NULL,
      "startDate" timestamp NOT NULL DEFAULT NOW(),
      "highlighted" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    );
  `);
  
  console.log("Table created successfully");
  await client.end();
}

main().catch(console.error);
