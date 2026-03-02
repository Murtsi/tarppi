/**
 * Training data exporter — exports labelled snapshot data as CSV.
 *
 * The CSV format matches what feature_engineering.py expects:
 *   likes_total, base_price_eur, max_price_eur, availability_pct,
 *   hours_since_published, sales_status, organiser, organiser_id,
 *   resell_score, heuristic_*, start_time, sales_start_time, label
 *
 * Since snapshots don't contain heuristic sub-scores, those columns
 * are set to 0 and the ML model relies on the raw features + binary
 * indicators computed in feature_engineering.py.
 */

import { exportTrainingData } from './db.js'

/**
 * Build CSV string from the training data.
 */
export async function buildTrainingCsv(): Promise<string> {
  const rows = await exportTrainingData()

  if (rows.length === 0) {
    return ''
  }

  // CSV header — matches sample_labelled_events.csv format
  const header = [
    'likes_total',
    'base_price_eur',
    'max_price_eur',
    'availability_pct',
    'hours_since_published',
    'sales_status',
    'organiser',
    'organiser_id',
    'resell_score',
    'heuristic_popularity',
    'heuristic_demand',
    'heuristic_pricing',
    'heuristic_timing',
    'heuristic_organiser',
    'start_time',
    'sales_start_time',
    'label',
  ].join(',')

  const csvRows = rows.map((row) => {
    const values = [
      row.likes_total ?? 0,
      row.base_price_eur ?? 0,
      row.max_price_eur ?? 0,
      row.availability_pct ?? 100,
      row.hours_since_published ?? 0,
      escapeCsvField(String(row.sales_status ?? 'on_sale')),
      escapeCsvField(String(row.organiser ?? '')),
      escapeCsvField(String(row.organiser_id ?? '')),
      0, // resell_score — not available from snapshots
      0, // heuristic_popularity
      0, // heuristic_demand
      0, // heuristic_pricing
      0, // heuristic_timing
      0, // heuristic_organiser
      escapeCsvField(String(row.start_time ?? '')),
      escapeCsvField(String(row.sales_start_time ?? '')),
      row.label,
    ]
    return values.join(',')
  })

  return [header, ...csvRows].join('\n')
}

/**
 * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
