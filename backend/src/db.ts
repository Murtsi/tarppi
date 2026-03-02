/**
 * PostgreSQL database layer for the self-training pipeline.
 *
 * Tables:
 *   event_snapshots   — periodic snapshots of Kide.app event state
 *   training_labels   — auto-generated BUY/MAYBE/SKIP labels from snapshot analysis
 *
 * Environment:
 *   DATABASE_URL — PostgreSQL connection string (Railway-managed)
 */

import pg from 'pg'

const { Pool } = pg

// ─── Connection ─────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('[db] DATABASE_URL is not set')
    }
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    })
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message)
    })
  }
  return pool
}

// ─── Schema initialisation ──────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS event_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    event_id        TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    organiser       TEXT,
    organiser_id    TEXT,
    city            TEXT,
    sales_status    TEXT,
    availability_pct DOUBLE PRECISION,
    likes_total     INTEGER,
    base_price_eur  DOUBLE PRECISION,
    max_price_eur   DOUBLE PRECISION,
    start_time      TIMESTAMPTZ,
    sales_start_time TIMESTAMPTZ,
    hours_since_published DOUBLE PRECISION,
    media_url       TEXT,
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_event_id ON event_snapshots (event_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_snapshot_at ON event_snapshots (snapshot_at);
  CREATE INDEX IF NOT EXISTS idx_snapshots_event_time ON event_snapshots (event_id, snapshot_at);

  CREATE TABLE IF NOT EXISTS training_labels (
    id              BIGSERIAL PRIMARY KEY,
    event_id        TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    label           TEXT        NOT NULL CHECK (label IN ('BUY', 'MAYBE', 'SKIP')),
    confidence      DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    reason          TEXT,
    labelled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_in_training BOOLEAN    NOT NULL DEFAULT FALSE
  );

  CREATE INDEX IF NOT EXISTS idx_labels_label ON training_labels (label);
  CREATE INDEX IF NOT EXISTS idx_labels_used ON training_labels (used_in_training);

  CREATE TABLE IF NOT EXISTS tiketti_events (
    id              TEXT        PRIMARY KEY,
    title           TEXT        NOT NULL,
    artist          TEXT,
    venue           TEXT        NOT NULL,
    city            TEXT        NOT NULL,
    date            TIMESTAMPTZ,
    price           DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_price       DOUBLE PRECISION,
    available_count INTEGER,
    total_count     INTEGER,
    url             TEXT        NOT NULL,
    image_url       TEXT,
    source          TEXT        NOT NULL DEFAULT 'tiketti',
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_tiketti_city ON tiketti_events (city);
  CREATE INDEX IF NOT EXISTS idx_tiketti_date ON tiketti_events (date);
  CREATE INDEX IF NOT EXISTS idx_tiketti_fetched ON tiketti_events (fetched_at);
`

export async function initDb(): Promise<void> {
  const db = getPool()
  try {
    await db.query(SCHEMA_SQL)
    console.log('[db] Schema initialised (event_snapshots + training_labels + tiketti_events)')
  } catch (err) {
    console.error('[db] Schema init failed:', err)
    throw err
  }
}

// ─── Snapshot operations ────────────────────────────────────────────────────

export type SnapshotRow = {
  event_id: string
  name: string
  organiser: string | null
  organiser_id: string | null
  city: string | null
  sales_status: string | null
  availability_pct: number | null
  likes_total: number | null
  base_price_eur: number | null
  max_price_eur: number | null
  start_time: string | null
  sales_start_time: string | null
  hours_since_published: number | null
  media_url: string | null
}

export async function insertSnapshots(rows: SnapshotRow[]): Promise<number> {
  if (rows.length === 0) return 0

  const db = getPool()
  let inserted = 0

  // Use a transaction for batch insert
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const stmt = `
      INSERT INTO event_snapshots
        (event_id, name, organiser, organiser_id, city, sales_status,
         availability_pct, likes_total, base_price_eur, max_price_eur,
         start_time, sales_start_time, hours_since_published, media_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `

    for (const r of rows) {
      await client.query(stmt, [
        r.event_id,
        r.name,
        r.organiser,
        r.organiser_id,
        r.city,
        r.sales_status,
        r.availability_pct,
        r.likes_total,
        r.base_price_eur,
        r.max_price_eur,
        r.start_time ?? null,
        r.sales_start_time ?? null,
        r.hours_since_published,
        r.media_url,
      ])
      inserted++
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return inserted
}

// ─── Label operations ───────────────────────────────────────────────────────

export type LabelRow = {
  event_id: string
  name: string
  label: 'BUY' | 'MAYBE' | 'SKIP'
  confidence: number
  reason: string
}

export async function upsertLabel(row: LabelRow): Promise<void> {
  const db = getPool()
  await db.query(
    `INSERT INTO training_labels (event_id, name, label, confidence, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO UPDATE SET
       label = EXCLUDED.label,
       confidence = EXCLUDED.confidence,
       reason = EXCLUDED.reason,
       labelled_at = NOW(),
       used_in_training = FALSE`,
    [row.event_id, row.name, row.label, row.confidence, row.reason],
  )
}

export async function upsertLabels(rows: LabelRow[]): Promise<number> {
  let count = 0
  for (const row of rows) {
    await upsertLabel(row)
    count++
  }
  return count
}

// ─── Query helpers ──────────────────────────────────────────────────────────

/**
 * Get all snapshots for a specific event, ordered by time.
 */
export async function getEventSnapshots(eventId: string): Promise<pg.QueryResult> {
  const db = getPool()
  return db.query(
    `SELECT * FROM event_snapshots WHERE event_id = $1 ORDER BY snapshot_at ASC`,
    [eventId],
  )
}

/**
 * Get distinct event IDs that have snapshots but no label yet.
 */
export async function getUnlabelledEventIds(): Promise<string[]> {
  const db = getPool()
  const result = await db.query(`
    SELECT DISTINCT s.event_id
    FROM event_snapshots s
    LEFT JOIN training_labels l ON s.event_id = l.event_id
    WHERE l.event_id IS NULL
    ORDER BY s.event_id
  `)
  return result.rows.map((r: { event_id: string }) => r.event_id)
}

/**
 * Get the first and last snapshot for each unlabelled event.
 * Used by the labeler to determine sell-through over time.
 */
export async function getSnapshotRanges(): Promise<Array<{
  event_id: string
  name: string
  first_availability: number | null
  last_availability: number | null
  first_sales_status: string | null
  last_sales_status: string | null
  first_snapshot: Date
  last_snapshot: Date
  snapshot_count: number
  first_likes: number | null
  last_likes: number | null
  base_price_eur: number | null
  max_price_eur: number | null
  organiser: string | null
  organiser_id: string | null
  start_time: string | null
  sales_start_time: string | null
}>> {
  const db = getPool()
  const result = await db.query(`
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY snapshot_at ASC)  AS rn_first,
        ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY snapshot_at DESC) AS rn_last,
        COUNT(*)     OVER (PARTITION BY event_id)                           AS snap_count
      FROM event_snapshots
    )
    SELECT
      f.event_id,
      f.name,
      f.availability_pct   AS first_availability,
      l.availability_pct   AS last_availability,
      f.sales_status       AS first_sales_status,
      l.sales_status       AS last_sales_status,
      f.snapshot_at         AS first_snapshot,
      l.snapshot_at         AS last_snapshot,
      f.snap_count::int     AS snapshot_count,
      f.likes_total         AS first_likes,
      l.likes_total         AS last_likes,
      COALESCE(l.base_price_eur, f.base_price_eur)  AS base_price_eur,
      COALESCE(l.max_price_eur, f.max_price_eur)    AS max_price_eur,
      COALESCE(l.organiser, f.organiser)             AS organiser,
      COALESCE(l.organiser_id, f.organiser_id)       AS organiser_id,
      COALESCE(l.start_time, f.start_time)::text     AS start_time,
      COALESCE(l.sales_start_time, f.sales_start_time)::text AS sales_start_time
    FROM ranked f
    JOIN ranked l ON f.event_id = l.event_id AND l.rn_last = 1
    LEFT JOIN training_labels tl ON f.event_id = tl.event_id
    WHERE f.rn_first = 1 AND tl.event_id IS NULL
    ORDER BY f.event_id
  `)
  return result.rows
}

/**
 * Get count of labels not yet used in training.
 */
export async function getNewLabelCount(): Promise<number> {
  const db = getPool()
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM training_labels WHERE used_in_training = FALSE`,
  )
  return result.rows[0]?.count ?? 0
}

/**
 * Mark all labels as used in training.
 */
export async function markLabelsUsed(): Promise<void> {
  const db = getPool()
  await db.query(`UPDATE training_labels SET used_in_training = TRUE`)
}

/**
 * Export joined snapshot+label data as training rows.
 * Returns the latest snapshot for each labelled event, merged with features.
 */
export async function exportTrainingData(): Promise<Array<Record<string, unknown>>> {
  const db = getPool()
  const result = await db.query(`
    WITH latest_snap AS (
      SELECT DISTINCT ON (event_id) *
      FROM event_snapshots
      ORDER BY event_id, snapshot_at DESC
    )
    SELECT
      s.likes_total,
      s.base_price_eur,
      s.max_price_eur,
      s.availability_pct,
      s.hours_since_published,
      s.sales_status,
      s.organiser,
      s.organiser_id,
      s.start_time::text  AS start_time,
      s.sales_start_time::text AS sales_start_time,
      l.label
    FROM training_labels l
    JOIN latest_snap s ON l.event_id = s.event_id
    ORDER BY l.labelled_at ASC
  `)
  return result.rows
}

/**
 * Get total snapshot count (for stats).
 */
export async function getSnapshotCount(): Promise<number> {
  const db = getPool()
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM event_snapshots`)
  return result.rows[0]?.count ?? 0
}

/**
 * Get total label count (for stats).
 */
export async function getLabelCount(): Promise<number> {
  const db = getPool()
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM training_labels`)
  return result.rows[0]?.count ?? 0
}

/**
 * Get label distribution (for stats).
 */
export async function getLabelDistribution(): Promise<Record<string, number>> {
  const db = getPool()
  const result = await db.query(
    `SELECT label, COUNT(*)::int AS count FROM training_labels GROUP BY label`,
  )
  const dist: Record<string, number> = { BUY: 0, MAYBE: 0, SKIP: 0 }
  for (const row of result.rows as Array<{ label: string; count: number }>) {
    dist[row.label] = row.count
  }
  return dist
}

// ─── Tiketti event operations ───────────────────────────────────────────────

import type { TikettiEvent } from './types.js'

/**
 * Upsert Tiketti events — insert or update on conflict.
 */
export async function upsertTikettiEvents(events: TikettiEvent[]): Promise<number> {
  if (events.length === 0) return 0

  const db = getPool()
  const client = await db.connect()
  let upserted = 0

  try {
    await client.query('BEGIN')

    const stmt = `
      INSERT INTO tiketti_events
        (id, title, artist, venue, city, date, price, max_price,
         available_count, total_count, url, image_url, source, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        venue = EXCLUDED.venue,
        city = EXCLUDED.city,
        date = EXCLUDED.date,
        price = EXCLUDED.price,
        max_price = EXCLUDED.max_price,
        available_count = EXCLUDED.available_count,
        total_count = EXCLUDED.total_count,
        url = EXCLUDED.url,
        image_url = EXCLUDED.image_url,
        fetched_at = EXCLUDED.fetched_at
    `

    for (const e of events) {
      await client.query(stmt, [
        e.id,
        e.title,
        e.artist ?? null,
        e.venue,
        e.city,
        e.date || null,
        e.price,
        e.maxPrice ?? null,
        e.availableCount ?? null,
        e.totalCount ?? null,
        e.url,
        e.imageUrl ?? null,
        e.source,
        e.fetchedAt,
      ])
      upserted++
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return upserted
}

/**
 * Fetch all Tiketti events from DB, optionally filtered by city.
 */
export async function getTikettiEvents(city?: string): Promise<TikettiEvent[]> {
  const db = getPool()
  let query = `SELECT * FROM tiketti_events ORDER BY date ASC NULLS LAST`
  const params: string[] = []

  if (city) {
    query = `SELECT * FROM tiketti_events WHERE LOWER(city) = LOWER($1) ORDER BY date ASC NULLS LAST`
    params.push(city)
  }

  const result = await db.query(query, params)
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    artist: (r.artist as string) || undefined,
    venue: r.venue as string,
    city: r.city as string,
    date: r.date ? (r.date as Date).toISOString() : '',
    price: r.price as number,
    maxPrice: (r.max_price as number) || undefined,
    availableCount: (r.available_count as number) || undefined,
    totalCount: (r.total_count as number) || undefined,
    url: r.url as string,
    imageUrl: (r.image_url as string) || undefined,
    source: 'tiketti' as const,
    fetchedAt: r.fetched_at ? (r.fetched_at as Date).toISOString() : new Date().toISOString(),
  }))
}

/**
 * Get count of Tiketti events.
 */
export async function getTikettiEventCount(): Promise<number> {
  const db = getPool()
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM tiketti_events`)
  return result.rows[0]?.count ?? 0
}
