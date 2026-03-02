/**
 * Deobfuscator module — extracts dynamic anti-bot header values
 * from Kide.app's obfuscated body.js script.
 *
 * Caches results for 60 seconds to avoid refetching on every request.
 */
import axios from 'axios'

// Try to import deobfuscator — it's a devDependency, might not be in prod
let Deobfuscator: (new () => { deobfuscateSource(code: string): Promise<string> }) | null = null
let babelParse: ((code: string, opts: Record<string, unknown>) => { program: { body: Array<{ type: string; start?: number | null; end?: number | null }> } }) | null = null

try {
  const deobMod = await import('deobfuscator')
  Deobfuscator = deobMod.Deobfuscator
  const babelMod = await import('@babel/parser')
  babelParse = babelMod.parse
} catch {
  console.warn('[Deobfuscator] deobfuscator or @babel/parser not installed — using fallback values')
}

const KIDE_URL = 'https://kide.app'
const BODY_SCRIPT_PATH_BASE = 'scripts/body.js?v='

// ─── Default fallback values ─────────────────────────────────────────────────
// Updated periodically. Kide.app rotates these in their obfuscated body.js.
let currentHash = '71016830e76e4714a925181de40b80a8'
let currentHeaderKey = 'X-Requested-Token-33d'
let lastExtractedAt: string | null = null

// Cache: refreshed every 60 seconds max
let cacheExpiry = 0
const CACHE_TTL_MS = 60_000

export type ExtraProperties = {
  hash: string
  headerKey: string
  extractedAt: string
  cached: boolean
}

export function getExtraProperties(): ExtraProperties {
  return {
    hash: currentHash,
    headerKey: currentHeaderKey,
    extractedAt: lastExtractedAt || new Date().toISOString(),
    cached: true,
  }
}

export function setExtraProperties(hash: string, headerKey: string): void {
  currentHash = hash
  currentHeaderKey = headerKey
  lastExtractedAt = new Date().toISOString()
  cacheExpiry = Date.now() + CACHE_TTL_MS
  console.log(`[Deobfuscator] Updated: key=${headerKey}, hash=${hash}`)
}

/**
 * Calculate the X-Requested header value using XOR encoding against the hash.
 */
export function calculateXRequestedId(inventoryId: string): string {
  const stripped = inventoryId.replace(/-/g, '')
  let encoded = ''
  for (let i = 0; i < stripped.length; i++) {
    encoded += String.fromCharCode(stripped.charCodeAt(i) ^ currentHash.charCodeAt(i))
  }
  return Buffer.from(encoded, 'binary').toString('base64').substring(0, 8)
}

// ─── Extraction logic ────────────────────────────────────────────────────────

function containsHexCode(str: string, minHexCodes = 1): boolean {
  const hexMatches = str.match(/(_0x|0x)[0-9a-fA-F]+/g)
  return !!hexMatches && hexMatches.length > minHexCodes
}

async function getLatestBodyScriptContent(): Promise<string> {
  const res = await axios.get(KIDE_URL, { timeout: 10_000 })
  const htmlString = res.data as string
  const splitted = htmlString.split(`src="/${BODY_SCRIPT_PATH_BASE}`)
  if (splitted.length !== 2) {
    throw new Error('Could not find body script in HTML')
  }
  const scriptVersion = splitted[1].split('"')[0]
  console.log(`[Deobfuscator] Script version: ${scriptVersion}`)
  const scriptUrl = `${KIDE_URL}/${BODY_SCRIPT_PATH_BASE}${scriptVersion}`
  const scriptRes = await axios.get(scriptUrl, { timeout: 30_000 })
  return scriptRes.data as string
}

function extractObfuscatedAreas(code: string): Array<{ start: number; end: number; content: string }> {
  if (!babelParse) return []

  try {
    const ast = babelParse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    })

    const areas: Array<{ start: number; end: number; content: string }> = []

    for (const node of ast.program.body) {
      if (
        node.type === 'VariableDeclaration' ||
        node.type === 'ImportDeclaration' ||
        node.type.startsWith('Export')
      ) continue
      if (node.start == null || node.end == null) continue

      const content = code.slice(node.start, node.end).trim()
      if (containsHexCode(content, 4)) {
        areas.push({ start: node.start, end: node.end, content })
      }
    }

    // Merge close ranges
    return areas.reduce<Array<{ start: number; end: number; content: string }>>((acc, curr) => {
      const last = acc[acc.length - 1]
      if (last && curr.start - last.end < 100) {
        last.end = curr.end
        last.content += curr.content
      } else {
        acc.push({ ...curr })
      }
      return acc
    }, [])
  } catch (error) {
    console.error('[Deobfuscator] Parse error:', error)
    return []
  }
}

/**
 * Fetch, deobfuscate, and extract the current anti-bot values from kide.app.
 * Returns cached values if within TTL. Forces refresh if forceRefresh=true.
 */
export async function refreshExtraProperties(forceRefresh = false): Promise<ExtraProperties> {
  // Return cached if still valid
  if (!forceRefresh && Date.now() < cacheExpiry) {
    return getExtraProperties()
  }

  if (!Deobfuscator || !babelParse) {
    console.warn('[Deobfuscator] Missing dependencies, returning defaults')
    return getExtraProperties()
  }

  try {
    console.log('[Deobfuscator] Fetching body.js...')
    const scriptContent = await getLatestBodyScriptContent()
    console.log(`[Deobfuscator] Script size: ${scriptContent.length} chars`)

    const areas = extractObfuscatedAreas(scriptContent)
    console.log(`[Deobfuscator] Found ${areas.length} obfuscated areas`)

    const deobfuscator = new Deobfuscator()
    const deobfuscatedCodes: string[] = []

    for (let i = 0; i < areas.length; i++) {
      try {
        console.log(`[Deobfuscator] Deobfuscating area ${i + 1}/${areas.length}...`)
        const result = await deobfuscator.deobfuscateSource(areas[i].content)
        deobfuscatedCodes.push(result)
      } catch (err) {
        console.warn(`[Deobfuscator] Failed area ${i + 1}:`, err)
      }
    }

    const combined = deobfuscatedCodes.join('\n')

    // Extract X-Requested-Token key
    let headerKey: string | null = null
    const tokenSplit = combined.split('X-Requested-Token')
    if (tokenSplit.length >= 2) {
      const suffix = tokenSplit[1].split("'")[0].split('"')[0]
      headerKey = `X-Requested-Token${suffix}`
    } else {
      const altMatch = combined.match(/X-Requested-Token[^'"}\s]+/)
      if (altMatch) headerKey = altMatch[0]
    }

    // Extract extraId hash
    let hash: string | null = null
    const isTrustedSplit = combined.split(".isTrusted ? '")
    if (isTrustedSplit.length >= 2) {
      hash = isTrustedSplit[1].split("'")[0]
    } else {
      const hexMatches = combined.match(/['"][0-9a-f]{32}['"]/g)
      if (hexMatches) hash = hexMatches[0].replace(/['"]/g, '')
    }

    if (hash && headerKey) {
      setExtraProperties(hash, headerKey)
      return { hash, headerKey, extractedAt: lastExtractedAt!, cached: false }
    }

    console.warn('[Deobfuscator] Could not extract all values')
    cacheExpiry = Date.now() + CACHE_TTL_MS // Still cache the failure to avoid hammering
    return getExtraProperties()
  } catch (error) {
    console.error('[Deobfuscator] Extraction failed:', error)
    cacheExpiry = Date.now() + CACHE_TTL_MS
    return getExtraProperties()
  }
}
