/**
 * Tiketti.fi event scraper — fetches events from tiketti.fi/tapahtumat.
 *
 * Uses axios + cheerio for HTML parsing. Falls back gracefully
 * if the page structure changes.
 */
import axios from 'axios'
import * as cheerio from 'cheerio'
import type { TikettiEvent } from '../types.js'

const TIKETTI_BASE = 'https://www.tiketti.fi'
const TIKETTI_EVENTS_URL = `${TIKETTI_BASE}/tapahtumat`

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Scrape events from Tiketti.fi.
 * Parses the event listing page and extracts structured data.
 */
export async function scrapeTikettiEvents(): Promise<TikettiEvent[]> {
  const fetchedAt = new Date().toISOString()

  try {
    console.log('[tiketti-scraper] Fetching events from tiketti.fi...')

    const response = await axios.get(TIKETTI_EVENTS_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
      },
      timeout: 20_000,
    })

    const $ = cheerio.load(response.data as string)
    const events: TikettiEvent[] = []

    // Tiketti.fi event cards — these selectors may need updating if the site changes
    // Try common card patterns
    const cardSelectors = [
      '.event-card',
      '.event-list-item',
      '.product-card',
      '[data-event-id]',
      '.events-list .item',
      '.event-item',
      'article.event',
      '.search-results .result-item',
    ]

    let $cards = $('__nonexistent__')
    for (const selector of cardSelectors) {
      const found = $(selector)
      if (found.length > 0) {
        $cards = found
        console.log(`[tiketti-scraper] Found ${found.length} events with selector: ${selector}`)
        break
      }
    }

    // If no specific card selector matches, try a broader approach:
    // Look for links that contain event-like URLs
    if ($cards.length === 0) {
      console.log('[tiketti-scraper] No card selectors matched, trying link-based extraction')
      const eventLinks = $('a[href*="/tapahtuma/"], a[href*="/event/"], a[href*="/tapahtumat/"]')
        .filter((_i, el) => {
          const href = $(el).attr('href') || ''
          // Filter out nav/category links — we want actual event detail pages
          return href.split('/').length > 3
        })

      const seenHrefs = new Set<string>()
      eventLinks.each((_i, el) => {
        const $el = $(el)
        const href = $el.attr('href') || ''
        const fullUrl = href.startsWith('http') ? href : `${TIKETTI_BASE}${href}`

        if (seenHrefs.has(fullUrl)) return
        seenHrefs.add(fullUrl)

        const title = $el.text().trim()
          || $el.find('h2, h3, .title, .name').first().text().trim()
          || $el.attr('title')?.trim()
          || ''

        if (!title || title.length < 3) return

        // Try to extract more info from parent/sibling elements
        const $parent = $el.closest('.event-card, .item, .card, article, li, .row')
        const dateText = $parent.find('.date, .time, [class*="date"], [class*="time"]').first().text().trim()
        const venueText = $parent.find('.venue, .location, .place, [class*="venue"], [class*="location"]').first().text().trim()
        const priceText = $parent.find('.price, [class*="price"], [class*="hinta"]').first().text().trim()
        const imgSrc = $parent.find('img').first().attr('src') || $el.find('img').first().attr('src')

        const price = parsePrice(priceText)
        const parsedDate = parseEventDate(dateText)

        // Generate a stable ID from the URL
        const id = generateId(fullUrl)

        events.push({
          id,
          title,
          venue: venueText || 'Unknown venue',
          city: extractCity(venueText) || 'Helsinki',
          date: parsedDate || '',
          price: price ?? 0,
          url: fullUrl,
          imageUrl: imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${TIKETTI_BASE}${imgSrc}`) : undefined,
          source: 'tiketti',
          fetchedAt,
        })
      })
    } else {
      // Parse structured card data
      $cards.each((_i, el) => {
        const $card = $(el)
        const $link = $card.find('a').first()
        const href = $link.attr('href') || $card.find('a[href*="/tapahtuma/"]').attr('href') || ''
        const fullUrl = href.startsWith('http') ? href : `${TIKETTI_BASE}${href}`

        const title = $card.find('h2, h3, .title, .name, .event-name').first().text().trim()
          || $link.text().trim()
          || ''
        const artistText = $card.find('.artist, .performer, .subtitle').first().text().trim()
        const venueText = $card.find('.venue, .location, .place').first().text().trim()
        const dateText = $card.find('.date, .time, [class*="date"]').first().text().trim()
        const priceText = $card.find('.price, [class*="price"], [class*="hinta"]').first().text().trim()
        const imgSrc = $card.find('img').first().attr('src')

        if (!title || title.length < 3) return

        const price = parsePrice(priceText)
        const parsedDate = parseEventDate(dateText)
        const id = $card.attr('data-event-id') || $card.attr('data-id') || generateId(fullUrl)

        events.push({
          id,
          title,
          artist: artistText || undefined,
          venue: venueText || 'Unknown venue',
          city: extractCity(venueText) || 'Helsinki',
          date: parsedDate || '',
          price: price ?? 0,
          url: fullUrl,
          imageUrl: imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${TIKETTI_BASE}${imgSrc}`) : undefined,
          source: 'tiketti',
          fetchedAt,
        })
      })
    }

    console.log(`[tiketti-scraper] Scraped ${events.length} events`)
    return events
  } catch (err) {
    console.error('[tiketti-scraper] Scrape failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  if (!text) return null
  // Match patterns like "25,00 €", "€25.00", "25€", "alkaen 15,90"
  const match = text.match(/(\d+)[,.]?(\d{0,2})\s*€|€\s*(\d+)[,.]?(\d{0,2})|(\d+)[,.](\d{2})/)
  if (!match) return null
  const whole = match[1] || match[3] || match[5] || '0'
  const decimal = match[2] || match[4] || match[6] || '0'
  return parseFloat(`${whole}.${decimal.padEnd(2, '0')}`)
}

function parseEventDate(text: string): string | null {
  if (!text) return null
  // Try to parse Finnish date formats: "15.3.2026", "15.3.2026 klo 19:00", "pe 15.3."
  const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    let year = dateMatch[3]
    if (year.length === 2) year = `20${year}`
    const timeMatch = text.match(/(\d{1,2})[:.:](\d{2})/)
    const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00` : '00:00:00'
    return `${year}-${month}-${day}T${time}+02:00`
  }
  return null
}

function extractCity(venueText: string): string | null {
  if (!venueText) return null
  // Common Finnish cities
  const cities = ['Helsinki', 'Tampere', 'Turku', 'Oulu', 'Espoo', 'Vantaa', 'Jyväskylä', 'Kuopio', 'Lahti', 'Rovaniemi', 'Joensuu', 'Vaasa', 'Pori', 'Hämeenlinna', 'Lappeenranta']
  for (const city of cities) {
    if (venueText.toLowerCase().includes(city.toLowerCase())) return city
  }
  return null
}

function generateId(url: string): string {
  // Create a deterministic ID from URL — simple hash
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit int
  }
  return `tiketti-${Math.abs(hash).toString(36)}`
}
