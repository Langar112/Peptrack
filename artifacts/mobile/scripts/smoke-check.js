/**
 * Mobile web smoke check.
 *
 * Loads the web entry point and each of the three main tab routes (Calculator,
 * Calendar, Journal). Exits non-zero if any route returns a non-success HTTP
 * response or if the JS bundle is a Metro error envelope rather than valid
 * application code.
 *
 * Usage:
 *   node scripts/smoke-check.js
 *   pnpm --filter @workspace/mobile run smoke
 */

'use strict';

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const metroCompatPath = path.join(
  projectRoot,
  'scripts',
  'image-size-metro-compat.cjs',
);

// Public web URLs for the three main tabs served by Expo Router.
// Expo Router strips the route-group parentheses from the URL, so
// app/(tabs)/index.tsx → / and app/(tabs)/calendar.tsx → /calendar.
const ROUTES = ['/', '/calendar', '/journal'];

// ── helpers ──────────────────────────────────────────────────────────────────

function findFreePort(preferred = 8083) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(preferred, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
    probe.on('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const port = fallback.address().port;
        fallback.close(() => resolve(port));
      });
    });
  });
}

function getMetroNodeOptions() {
  const existing = process.env.NODE_OPTIONS || '';
  return existing.includes(metroCompatPath)
    ? existing
    : `${existing} --require=${metroCompatPath}`.trim();
}

async function waitForMetro(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/status`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) return;
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Metro did not become ready within ${timeoutMs / 1000}s`);
}

/**
 * Fetch a URL and return { status, ok, body }. Throws on network error.
 */
async function fetchText(url, timeoutMs = 30_000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}

/**
 * Extract the first <script src="..."> URL from an HTML string.
 * Returns null if none is found.
 */
function extractBundleUrl(html, baseUrl) {
  // Expo dev server injects one <script> that loads the Metro bundle.
  const match = html.match(/<script[^>]+\bsrc=["']([^"']+)["']/i);
  if (!match) return null;
  const src = match[1];
  if (/^https?:\/\//i.test(src)) return src;
  return `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
}

/**
 * Return true when the response body is Metro's JSON error envelope.
 * Metro wraps bundling failures in {"type":"error",...} — a valid bundle
 * is always plain JavaScript that does not start with that shape.
 */
function isBundleErrorEnvelope(body) {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.type === 'error';
  } catch {
    return false;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

/**
 * Check the web routes and bundle served by an already-running Metro server.
 *
 * Keeping the checks separate from Metro's lifecycle lets the build reuse its
 * production Metro process instead of starting a second server just for the
 * smoke check.
 */
async function checkWebRoutes(port, baseUrl = `http://localhost:${port}`) {
  const failures = [];
  let entryHtml = null;

  // ── 1. Check each tab route ───────────────────────────────────────────────
  for (const route of ROUTES) {
    const url = `${baseUrl}${route}`;
    process.stdout.write(`  GET ${route} … `);
    try {
      const { status, ok, body } = await fetchText(url);
      if (!ok) {
        console.log(`FAIL (HTTP ${status})`);
        failures.push(`Route ${route} returned HTTP ${status}`);
      } else {
        console.log(`OK (${status})`);
        if (route === '/') entryHtml = body;
      }
    } catch (err) {
      console.log(`FAIL (${err.message})`);
      failures.push(`Route ${route} fetch error: ${err.message}`);
    }
  }

  // ── 2. Check the JS bundle ────────────────────────────────────────────────
  const bundleUrl = entryHtml ? extractBundleUrl(entryHtml, baseUrl) : null;

  if (bundleUrl) {
    process.stdout.write(`\n  GET bundle … `);
    try {
      const { status, ok, body } = await fetchText(bundleUrl, 120_000);
      if (!ok) {
        console.log(`FAIL (HTTP ${status})`);
        failures.push(`Bundle returned HTTP ${status}`);
      } else if (isBundleErrorEnvelope(body)) {
        // Metro returns {"type":"error",...} when it cannot compile the bundle.
        console.log(`FAIL (Metro error envelope in bundle response)`);
        let detail = '';
        try {
          detail = JSON.parse(body.trimStart())?.errors?.[0]?.description || '';
        } catch {
          /* ignore parse failures */
        }
        failures.push(
          `Bundle is a Metro error envelope${detail ? ': ' + detail : ''}`,
        );
      } else {
        console.log(`OK (${status}, ${(body.length / 1024).toFixed(0)} KB)`);
      }
    } catch (err) {
      console.log(`FAIL (${err.message})`);
      failures.push(`Bundle fetch error: ${err.message}`);
    }
  } else if (entryHtml !== null) {
    // Entry HTML loaded but contained no <script src> — the page has no
    // executable bundle, which is itself a broken preview.
    console.log(`\n  bundle … FAIL (no <script src> found in entry HTML)`);
    failures.push(
      'Entry HTML contains no bundle <script src> — application bundle is missing',
    );
  }

  return failures;
}

function printSmokeCheckResult(failures) {
  // ── Result ──────────────────────────────────────────────────────────────────
  console.log('');
  if (failures.length === 0) {
    console.log('✓ Smoke check passed');
    return;
  }

  console.error('✗ Smoke check failed:');
  for (const failure of failures) {
    console.error(`  • ${failure}`);
  }
}

async function main() {
  console.log('Starting mobile web smoke check…');

  const port = await findFreePort(8083);
  const baseUrl = `http://localhost:${port}`;
  console.log(`Metro port: ${port}`);

  let metro = null;

  try {
    metro = spawn(
      'pnpm',
      ['exec', 'expo', 'start', '--web', '--localhost', '--port', String(port)],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_OPTIONS: getMetroNodeOptions(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    metro.stdout.on('data', (d) => process.stdout.write(`[metro] ${d}`));
    metro.stderr.on('data', (d) => process.stderr.write(`[metro] ${d}`));

    console.log('Waiting for Metro…');
    await waitForMetro(port);
    console.log('Metro ready\n');

    const failures = await checkWebRoutes(port, baseUrl);
    printSmokeCheckResult(failures);
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (metro) {
      metro.kill();
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Smoke check error: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ROUTES,
  checkWebRoutes,
  extractBundleUrl,
  findFreePort,
  getMetroNodeOptions,
  isBundleErrorEnvelope,
  printSmokeCheckResult,
  waitForMetro,
};
