import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { handleMarketApi } from '../server/market-api.mjs';
import { handlePlatformApi } from '../server/http-api.mjs';
import { handleChannelApi } from '../server/channel-api.mjs';
import { handleInboxApi } from '../server/inbox-api.mjs';
import { handleMarketingApi } from '../server/marketing-api.mjs';
import { handlePromotionApi } from '../server/promotion-api.mjs';
import { handleReliabilityApi } from '../server/reliability-api.mjs';
import { handleBrowserSession } from '../server/browser-session.mjs';
import { handleAdminApi } from '../server/admin-api.mjs';
import { handleControlPlaneApi } from '../server/control-plane-api.mjs';
import { handleBusinessApi } from '../server/business-api.mjs';
import { startBackgroundRuntime } from '../server/background-runtime.mjs';
import { installSecurityHeaders, rejectOversizedDeclaredBody } from '../server/http-security.mjs';

const port = Number(process.env.EP_BASE_PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const publicRoot = resolve(process.cwd());
const publicExtensions = new Set(Object.keys(types));

function publicFileFromRequest(requestUrl = '/') {
  const url = new URL(requestUrl, 'http://local');
  const decoded = decodeURIComponent(url.pathname);
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (!requested || requested !== basename(requested) || requested.startsWith('.')) throw new Error('not public');
  const extension = extname(requested).toLowerCase();
  if (!publicExtensions.has(extension)) throw new Error('not public');
  const file = resolve(publicRoot, requested);
  if (dirname(file) !== publicRoot) throw new Error('not public');
  return { file, extension };
}

createServer(async (request, response) => {
  try {
    installSecurityHeaders(request, response);
    if (rejectOversizedDeclaredBody(request, response)) return;
    request.setTimeout?.(Number(process.env.EINEIRO_HTTP_REQUEST_TIMEOUT_MS || 30_000));
    if (request.url?.startsWith('/api/')) {
      const browserHandled = await handleBrowserSession(request, response);
      if (browserHandled !== false) return;
      const controlPlaneHandled = await handleControlPlaneApi(request, response);
      if (controlPlaneHandled !== false) return;
      const adminHandled = await handleAdminApi(request, response);
      if (adminHandled !== false) return;
      const businessHandled = await handleBusinessApi(request, response);
      if (businessHandled !== false) return;
      const inboxHandled = await handleInboxApi(request, response);
      if (inboxHandled !== false) return;
      const marketingHandled = await handleMarketingApi(request, response);
      if (marketingHandled !== false) return;
      const promotionHandled = await handlePromotionApi(request, response);
      if (promotionHandled !== false) return;
      const reliabilityHandled = await handleReliabilityApi(request, response);
      if (reliabilityHandled !== false) return;
      const channelHandled = await handleChannelApi(request, response);
      if (channelHandled !== false) return;
      const platformHandled = await handlePlatformApi(request, response);
      if (platformHandled !== false) return;
      const marketHandled = await handleMarketApi(request, response);
      if (marketHandled !== false) return;
    }
    const { file, extension } = publicFileFromRequest(request.url);
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': `${types[extension]}; charset=utf-8`,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    response.end('Not found');
  }
}).listen(port, '0.0.0.0', async () => {
  console.log(`EINEIRO запущен: http://localhost:${port}`);
  await startBackgroundRuntime().catch(error=>console.error('Не удалось запустить фоновые задачи:',error.message));
});
