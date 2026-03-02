/**
 * Tiketti.fi Playwright browser automation — headless ticket sniping.
 *
 * Architecture:
 * 1. A singleton Chromium instance is lazily launched with stealth patches.
 * 2. Each sniper operation creates an isolated BrowserContext (own cookies/session).
 * 3. The context navigates to the event page, passes through Queue-it, and parks.
 * 4. When the caller signals "buy", the page refreshes and clicks "Add to cart".
 *
 * Status updates are pushed via a callback so the route can stream them as SSE.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'launching'
  | 'navigating'
  | 'queue-it'
  | 'ready'
  | 'buying'
  | 'success'
  | 'failed'
  | 'closed'

export type BrowserSession = {
  id: string
  eventUrl: string
  eventId: string
  status: SessionStatus
  statusMessage: string
  quantity: number
  context: BrowserContext
  page: Page
  createdAt: number
  onStatus?: (status: SessionStatus, message: string) => void
}

export type SessionInfo = {
  id: string
  eventId: string
  status: SessionStatus
  statusMessage: string
  createdAt: number
}

// ─── Singleton browser ──────────────────────────────────────────────────────

let browser: Browser | null = null
const sessions = new Map<string, BrowserSession>()

const STEALTH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-infobars',
  '--window-size=1920,1080',
  '--start-maximized',
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--disable-dev-shm-usage',
]

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    console.log('[tiketti-browser] Launching Chromium...')
    browser = await chromium.launch({
      headless: true,
      args: STEALTH_ARGS,
    })
    console.log('[tiketti-browser] Chromium launched')
  }
  return browser
}

// Stealth init script — executed in every new page before any site JS
const STEALTH_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // Fake plugins array
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ],
  });

  // Fake languages
  Object.defineProperty(navigator, 'languages', { get: () => ['fi-FI', 'fi', 'en-US', 'en'] });

  // Chrome runtime
  window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };

  // Permissions query override
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);

  // WebGL vendor/renderer
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.';
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
    return getParameter.apply(this, [parameter]);
  };
`

// ─── Session management ─────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

function updateStatus(session: BrowserSession, status: SessionStatus, message: string) {
  session.status = status
  session.statusMessage = message
  console.log(`[tiketti-browser] Session ${session.id}: [${status}] ${message}`)
  session.onStatus?.(status, message)
}

/**
 * Create a new browser session and navigate to the event page.
 * The session will automatically handle Queue-it if encountered.
 * Returns the session ID immediately; navigation happens in background.
 */
export async function createSession(
  eventUrl: string,
  eventId: string,
  quantity: number,
  onStatus?: (status: SessionStatus, message: string) => void,
): Promise<string> {
  const b = await getBrowser()

  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fi-FI',
    timezoneId: 'Europe/Helsinki',
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
  })

  const page = await context.newPage()

  // Inject stealth patches before any page JS runs
  await page.addInitScript(STEALTH_SCRIPT)

  const id = generateId()
  const session: BrowserSession = {
    id,
    eventUrl,
    eventId,
    quantity,
    status: 'launching',
    statusMessage: 'Launching browser session...',
    context,
    page,
    createdAt: Date.now(),
    onStatus,
  }

  sessions.set(id, session)
  updateStatus(session, 'launching', 'Browser session created')

  // Navigate in background — don't await
  navigateAndWait(session).catch((err) => {
    const msg = err instanceof Error ? err.message : 'Unknown navigation error'
    updateStatus(session, 'failed', msg)
  })

  return id
}

/**
 * Navigate to the event page and handle Queue-it.
 */
async function navigateAndWait(session: BrowserSession): Promise<void> {
  const { page, eventUrl } = session

  updateStatus(session, 'navigating', `Navigating to ${eventUrl}`)

  // Navigate — follow redirects
  const response = await page.goto(eventUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })

  if (!response) {
    throw new Error('Navigation returned no response')
  }

  console.log(`[tiketti-browser] Initial URL: ${page.url()} (status: ${response.status()})`)

  // Check if we hit Queue-it
  const isQueue = await detectQueueIt(page)
  if (isQueue) {
    updateStatus(session, 'queue-it', 'Entered Queue-it virtual queue — waiting...')
    await waitThroughQueueIt(session)
  }

  // We should now be on the actual event page
  const currentUrl = page.url()
  if (currentUrl.includes('tiketti.fi')) {
    updateStatus(session, 'ready', 'Browser parked on event page — ready to buy')
  } else {
    throw new Error(`Unexpected page after navigation: ${currentUrl}`)
  }
}

/**
 * Detect whether the current page is a Queue-it waiting room.
 */
async function detectQueueIt(page: Page): Promise<boolean> {
  const url = page.url()

  // URL-based detection
  if (url.includes('queue-it.net') || url.includes('queue.tiketti.fi')) {
    return true
  }

  // DOM-based detection — Queue-it uses specific element IDs / classes
  try {
    const hasQueueElements = await page.evaluate(() => {
      const selectors = [
        '#MainPart_pProgressbar498',
        '.queue-it-page',
        '[data-queueit]',
        '#queueittoken',
        '.queue-number',
        '#MainPart_pSorting498_div498',
        '.progress-queue',
        '#text-before-progress-bar',
      ];
      // @ts-ignore
      return typeof document !== 'undefined' && selectors.some((s) => (document as any).querySelector(s) !== null);
    });
    return hasQueueElements;
  } catch {
    return false
  }
}

/**
 * Wait until Queue-it redirects us back to tiketti.fi.
 * Polls every 3 seconds, up to 10 minutes.
 */
async function waitThroughQueueIt(session: BrowserSession): Promise<void> {
  const { page } = session
  const maxWait = 10 * 60 * 1000 // 10 minutes
  const start = Date.now()
  let lastLog = ''

  while (Date.now() - start < maxWait) {
    // Check if we left Queue-it
    const url = page.url()
    if (url.includes('tiketti.fi') && !url.includes('queue-it.net') && !url.includes('queue.tiketti.fi')) {
      updateStatus(session, 'navigating', 'Passed Queue-it — loading event page...')

      // Wait for the real page to load
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 })
      } catch {
        // Might already be loaded
      }
      return
    }

    // Try to extract queue position for status updates
    try {
      const queueInfo = await page.evaluate(() => {
        // @ts-ignore
        if (typeof document === 'undefined') return { position: null, progress: null, message: null };
        // @ts-ignore
        const progressEl = (document as any).querySelector('#MainPart_pProgressbar498, .progress-queue, [role="progressbar"]');
        // @ts-ignore
        const positionEl = (document as any).querySelector('.queue-number, #MainPart_pSortingNumber498, .your-queue-number');
        // @ts-ignore
        const messageEl = (document as any).querySelector('#MainPart_pSortingExplanation498, .queue-explanation, #text-before-progress-bar p');
        let progress: string | null = null;
        if (progressEl && typeof progressEl.getAttribute === 'function') {
          progress = progressEl.getAttribute('aria-valuenow');
        }
        if (!progress && progressEl && progressEl.style && progressEl.style.width) {
          progress = progressEl.style.width;
        }
        return {
          position: positionEl?.textContent?.trim() || null,
          progress: progress || null,
          message: messageEl?.textContent?.trim() || null,
        };
      });

      const statusMsg = [
        queueInfo.position ? `Position: ${queueInfo.position}` : null,
        queueInfo.progress ? `Progress: ${queueInfo.progress}` : null,
        queueInfo.message || null,
      ]
        .filter(Boolean)
        .join(' — ')

      const logLine = statusMsg || 'Waiting in Queue-it...'
      if (logLine !== lastLog) {
        updateStatus(session, 'queue-it', logLine)
        lastLog = logLine
      }
    } catch {
      // Queue page might be changing, ignore
    }

    await page.waitForTimeout(3000)
  }

  throw new Error('Queue-it timeout — waited 10 minutes without passing through')
}

// ─── Buy action ─────────────────────────────────────────────────────────────

/**
 * Trigger the buy action on a ready session.
 * Refreshes the event page and clicks "Add to cart".
 */
export async function triggerBuy(sessionId: string): Promise<{ success: boolean; message: string }> {
  const session = sessions.get(sessionId)
  if (!session) return { success: false, message: 'Session not found' }
  if (session.status !== 'ready') {
    return { success: false, message: `Session not ready (current status: ${session.status})` }
  }

  const { page, quantity } = session
  updateStatus(session, 'buying', 'Refreshing page and looking for tickets...')

  try {
    // Refresh to get the latest page state
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(1500) // Let page JS initialize

    // Check if we got Queue-it redirected on refresh
    if (await detectQueueIt(page)) {
      updateStatus(session, 'queue-it', 'Hit Queue-it on refresh — waiting again...')
      await waitThroughQueueIt(session)
      // After passing Queue-it, wait for event page to fully load
      await page.waitForTimeout(2000)
    }

    // ── Set quantity ──
    const qtySet = await setQuantity(page, quantity)
    if (qtySet) {
      updateStatus(session, 'buying', `Set quantity to ${quantity}`)
    }

    // ── Click "Add to cart" ──
    const clicked = await clickAddToCart(page)
    if (!clicked) {
      // Maybe the page structure is different — take a screenshot for debugging
      const pageContent = await page.content()
      const hasTicketElements = pageContent.includes('ostoskoriin') || pageContent.includes('add to cart') || pageContent.includes('Osta')
      updateStatus(session, 'failed', `Could not find add-to-cart button (page has ticket elements: ${hasTicketElements})`)
      return { success: false, message: 'Could not find the add-to-cart button on the page' }
    }

    updateStatus(session, 'buying', 'Clicked add to cart — verifying...')
    await page.waitForTimeout(3000) // Wait for cart action to process

    // ── Verify success ──
    const result = await verifyCartAction(page)
    if (result.success) {
      updateStatus(session, 'success', result.message)
      return { success: true, message: result.message }
    }

    // Maybe the click triggered a Queue-it redirect
    if (await detectQueueIt(page)) {
      updateStatus(session, 'queue-it', 'Cart action triggered Queue-it — waiting...')
      await waitThroughQueueIt(session)
      // Try clicking again after passing Queue-it
      await page.waitForTimeout(2000)
      const retryClicked = await clickAddToCart(page)
      if (retryClicked) {
        await page.waitForTimeout(3000)
        const retryResult = await verifyCartAction(page)
        if (retryResult.success) {
          updateStatus(session, 'success', retryResult.message)
          return { success: true, message: retryResult.message }
        }
      }
    }

    updateStatus(session, 'failed', result.message)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error during buy'
    updateStatus(session, 'failed', msg)
    return { success: false, message: msg }
  }
}

/**
 * Try to set the ticket quantity on the page.
 */
async function setQuantity(page: Page, quantity: number): Promise<boolean> {
  const selectors = [
    'input[name="amount"]',
    'input[name="quantity"]',
    'input.quantity',
    'input#quantity',
    'input[type="number"]',
    'select[name="amount"]',
    'select.quantity',
  ]

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0 && (await el.isVisible())) {
        const tag = await el.evaluate((node) => node.tagName.toLowerCase())
        if (tag === 'select') {
          await el.selectOption(String(quantity))
        } else {
          await el.fill(String(quantity))
        }
        return true
      }
    } catch {
      continue
    }
  }

  // Try dropdown/stepper buttons (+/- pattern)
  try {
    const plusBtn = page.locator(
      'button.qty-plus, button.increase, button[aria-label="Increase"], .quantity-controls button:last-child',
    ).first()
    if ((await plusBtn.count()) > 0) {
      for (let i = 1; i < quantity; i++) {
        await plusBtn.click()
        await page.waitForTimeout(200)
      }
      return true
    }
  } catch {
    // No stepper buttons
  }

  return false
}

/**
 * Find and click the "Add to cart" / "Lisää ostoskoriin" button.
 */
async function clickAddToCart(page: Page): Promise<boolean> {
  // Primary selectors — text-based (most reliable for Finnish site)
  const textPatterns = [
    'Lisää ostoskoriin',
    'Osta',
    'Osta liput',
    'Osta lippuja',
    'Add to cart',
    'Buy tickets',
    'Buy',
    'Varaa',
    'Tilaa',
  ]

  // Try text-based button matching first
  for (const text of textPatterns) {
    try {
      // Try button with exact text
      const btn = page.locator(`button:has-text("${text}"), input[type="submit"][value="${text}"], a:has-text("${text}")`).first()
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.scrollIntoViewIfNeeded()
        await page.waitForTimeout(300)
        await btn.click({ force: false })
        return true
      }
    } catch {
      continue
    }
  }

  // CSS selector fallbacks
  const cssSelectors = [
    '.add-to-cart',
    '[data-action="add-to-cart"]',
    '#addToCartButton',
    '#add-to-cart',
    'button.buy-button',
    '.buy-btn',
    '.btn-buy',
    '.purchase-button',
    'form[action*="cart"] button[type="submit"]',
    'form[action*="ostoskori"] button[type="submit"]',
    '.ticket-purchase button',
  ]

  for (const sel of cssSelectors) {
    try {
      const btn = page.locator(sel).first()
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.scrollIntoViewIfNeeded()
        await page.waitForTimeout(300)
        await btn.click({ force: false })
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

/**
 * Verify whether the cart action succeeded.
 */
async function verifyCartAction(page: Page): Promise<{ success: boolean; message: string }> {
  const url = page.url()

  // Success: redirected to cart/checkout page
  if (url.includes('/cart') || url.includes('/ostoskori') || url.includes('/checkout') || url.includes('/kassa')) {
    return { success: true, message: 'Tickets added to cart! Redirected to checkout.' }
  }

  // Check for success indicators in page content
  try {
    const result = await page.evaluate(() => {
      // @ts-ignore
      if (typeof document === 'undefined' || !(document as any).body) return { found: false, pattern: null };
      // @ts-ignore
      const body = (document as any).body.innerText.toLowerCase();
      // Success patterns
      const successPatterns = [
        'ostoskoriin lisätty',
        'lisätty ostoskoriin',
        'added to cart',
        'tuote lisätty',
        'siirry kassalle',
        'go to checkout',
        'proceed to checkout',
      ];
      for (const pattern of successPatterns) {
        if (body.includes(pattern)) return { found: true, pattern };
      }
      // Error patterns
      const errorPatterns = [
        'loppuunmyyty',
        'sold out',
        'ei saatavilla',
        'not available',
        'myynti ei ole alkanut',
        'sale has not started',
        'virhe',
        'error',
      ];
      for (const pattern of errorPatterns) {
        if (body.includes(pattern)) return { found: false, pattern };
      }
      return { found: false, pattern: null };
    });

    if (result.found) {
      return { success: true, message: `Cart success detected: "${result.pattern}"` }
    }

    if (result.pattern) {
      return { success: false, message: `Page shows: "${result.pattern}"` }
    }
  } catch {
    // Page might have navigated, ignore
  }

  // Check if a modal/popup appeared with cart confirmation
  try {
    const modal = page.locator('.modal, .popup, .dialog, [role="dialog"]').first()
    if ((await modal.count()) > 0 && (await modal.isVisible())) {
      const text = (await modal.textContent()) || ''
      if (text.toLowerCase().includes('ostoskori') || text.toLowerCase().includes('cart')) {
        return { success: true, message: 'Cart confirmation dialog detected' }
      }
    }
  } catch {
    // No modal
  }

  return { success: false, message: 'Could not verify if tickets were added to cart. Check tiketti.fi manually.' }
}

// ─── Session lifecycle ──────────────────────────────────────────────────────

/**
 * Get session info (without exposing internal objects).
 */
export function getSessionInfo(sessionId: string): SessionInfo | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  return {
    id: session.id,
    eventId: session.eventId,
    status: session.status,
    statusMessage: session.statusMessage,
    createdAt: session.createdAt,
  }
}

/**
 * List all active sessions.
 */
export function listSessions(): SessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    eventId: s.eventId,
    status: s.status,
    statusMessage: s.statusMessage,
    createdAt: s.createdAt,
  }))
}

/**
 * Close a session and release resources.
 */
export async function closeSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) return

  updateStatus(session, 'closed', 'Session closed')

  try {
    await session.page.close()
  } catch { /* already closed */ }

  try {
    await session.context.close()
  } catch { /* already closed */ }

  sessions.delete(sessionId)
}

/**
 * Shut down the browser entirely — call on server shutdown.
 */
export async function closeBrowser(): Promise<void> {
  // Close all sessions
  for (const [id] of sessions) {
    await closeSession(id)
  }

  if (browser) {
    try {
      await browser.close()
    } catch { /* already closed */ }
    browser = null
    console.log('[tiketti-browser] Browser closed')
  }
}

/**
 * Clean up stale sessions (older than maxAgeMs).
 */
export async function cleanupStaleSessions(maxAgeMs = 30 * 60 * 1000): Promise<number> {
  const now = Date.now()
  let cleaned = 0

  for (const [id, session] of sessions) {
    if (now - session.createdAt > maxAgeMs) {
      await closeSession(id)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`[tiketti-browser] Cleaned up ${cleaned} stale sessions`)
  }

  return cleaned
}
