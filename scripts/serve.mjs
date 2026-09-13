import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handleMarketApi } from '../server/market-api.mjs';
import { handlePlatformApi } from '../server/http-api.mjs';
import { handleChannelApi } from '../server/channel-api.mjs';
import { handleReliabilityApi } from '../server/reliability-api.mjs';
import { handleBrowserSession } from '../server/browser-session.mjs';
import { startBackgroundRuntime } from '../server/background-runtime.mjs';

const port = Number(process.env.EP_BASE_PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' };

createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/api/')) {
      const browserHandled = await handleBrowserSession(request, response);
      if (browserHandled !== false) return;
      const reliabilityHandled = await handleReliabilityApi(request, response);
      if (reliabilityHandled !== false) return;
      const channelHandled = await handleChannelApi(request, response);
      if (channelHandled !== false) return;
      const platformHandled = await handlePlatformApi(request, response);
      if (platformHandled !== false) return;
      const marketHandled = await handleMarketApi(request, response);
      if (marketHandled !== false) return;
    }
    const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
    const path = normalize(join(process.cwd(), requested));
    if (!path.startsWith(process.cwd())) throw new Error('Invalid path');
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '0.0.0.0', async () => {
  console.log(`EINEIRO запущен: http://localhost:${port}`);
  await startBackgroundRuntime().catch(error=>console.error('Не удалось запустить фоновые задачи:',error.message));
});
