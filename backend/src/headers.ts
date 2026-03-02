/**
 * Header spoofing module — generates realistic browser-like headers
 * for Kide.app API requests to avoid bot detection.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0',
]

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'fi-FI,fi;q=0.9,en-US;q=0.8,en;q=0.7',
  'fi,en-US;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,fi;q=0.8',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate a random delay (ms) between min and max for realistic timing
 */
export function randomDelay(min = 100, max = 300): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Build realistic browser-like headers for Kide.app requests.
 *
 * @param token Bearer token (if auth needed)
 * @param extraHeaders Dynamic headers from deobfuscator
 * @param eventId Optional event ID for Referer header
 */
export function buildKideHeaders(
  token?: string,
  extraHeaders?: Record<string, string>,
  eventId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': randomItem(USER_AGENTS),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': randomItem(ACCEPT_LANGUAGES),
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': 'https://kide.app',
    'Referer': eventId ? `https://kide.app/events/${eventId}` : 'https://kide.app/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Connection': 'keep-alive',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Merge dynamic headers from deobfuscator (e.g. X-Requested-Token-xxx)
  if (extraHeaders) {
    Object.assign(headers, extraHeaders)
  }

  return headers
}
