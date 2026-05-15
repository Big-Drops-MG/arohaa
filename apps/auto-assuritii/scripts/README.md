# Vehicle Data Fetch Script

Fetches vehicle years, makes, and models from the Endurance API and stores them in the database.

## Setup

1. **Database schema**: Run migrations to create the vehicle tables:

   ```bash
   pnpm db:push
   ```

2. **Environment**: Ensure `DATABASE_URL` is set in `.env.local`

## Usage

```bash
pnpm fetch-vehicles
```

## Features

### Optimizations

- **Batch inserts**: Inserts data in batches of 50 instead of one-by-one (10-20x faster)
- **Concurrent API requests**: Fetches models for multiple makes in parallel (max 5 concurrent)
- **Retry logic**: Auto-retries failed requests with exponential backoff
- **Rate limit handling**: Detects 429/503 errors and backs off appropriately
- **Conflict handling**: Uses `onConflictDoUpdate`/`onConflictDoNothing` for idempotent inserts

### Progress Tracking

The script logs progress in real-time:

- Years generated and inserted
- Each year being processed
- Make and model counts per year
- Final summary with totals

### Error Handling

- Retries API calls up to 3 times with exponential backoff
- Gracefully handles missing data
- Logs detailed error info for debugging
- Exits with code 1 on failure, 0 on success

## Database Schema

### `vehicle_years`

- `id` (serial, PK)
- `year` (integer, unique)

### `vehicle_makes`

- `id` (serial, PK)
- `make_id` (integer, unique) - API ID
- `name` (text)
- `year_id` (FK to vehicle_years)

### `vehicle_models`

- `id` (serial, PK)
- `model_id` (integer) - API ID
- `name` (text)
- `make_id` (FK to vehicle_makes)
- Unique constraint on `(model_id, make_id)`

## Performance

Approximate runtime: 30-60 minutes depending on API rate limits and network speed.

- Years: ~40 (1981 - current year)
- Makes: ~5,000-8,000 total across all years
- Models: ~50,000-100,000+ total

## Re-running

The script is idempotent - you can run it multiple times safely. It will:

- Update existing years (no-op since year doesn't change)
- Update make names if they changed
- Skip inserting duplicate models
