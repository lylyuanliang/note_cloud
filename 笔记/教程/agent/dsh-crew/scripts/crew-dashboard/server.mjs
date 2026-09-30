// DSH Crew 本地看板：同源代理 hub 的 /jobs，避免浏览器 CORS 限制。
//
// 为什么需要这个服务：hub 的响应不带 CORS 头，还写了
// cross-origin-resource-policy: same-origin，所以 file:// 或其它端口的页面
// 直接 fetch http://127.0.0.1:19387/_dsh/dsh-crew/jobs 会被浏览器拦掉。
// 这里由服务端（同机 loopback）去取，页面只跟本服务同源通信。
//
// 用法：node server.mjs            （默认 127.0.0.1:3940）
//       CREW_DASH_PORT=4000 node server.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CREW_DASH_PORT ?? 3940);
const HOST = '127.0.0.1';

/** hub 地址优先读插件配置，桌面版换端口时不用改这里。 */
function hubBase() {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'dsh-crew', 'config.json'), 'utf8'));
    const url = typeof cfg.hub_url === 'string' ? cfg.hub_url.trim() : '';
    if (url) return url.replace(/\/+$/, '');
  } catch { }
  return 'http://127.0.0.1:19387';
}
const apiBase = () => hubBase() + '/_dsh/dsh-crew';

const pageHtml = () => readFileSync(join(HERE, 'index.html'), 'utf8');

function json(res, status, obj, extra = {}) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  });
  res.end(body);
}

async function readBody(req) {
  let b = '';
  for await (const chunk of req) b += chunk;
  return b;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(pageHtml());
    }

    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    if (url.pathname === '/api/jobs') {
      const r = await fetch(apiBase() + '/jobs', { signal: AbortSignal.timeout(8000) });
      const text = await r.text();
      let payload;
      try { payload = JSON.parse(text); } catch { return json(res, 502, { ok: false, error: 'hub 返回了非 JSON：' + text.slice(0, 200) }); }
      payload.hub = hubBase();
      return json(res, r.status, payload);
    }

    if (url.pathname === '/api/cancel' && req.method === 'POST') {
      const { id } = JSON.parse((await readBody(req)) || '{}');
      if (!id) return json(res, 400, { ok: false, error: 'id required' });
      const r = await fetch(apiBase() + '/jobs/' + encodeURIComponent(id) + '/cancel', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
      });
      return json(res, r.status, await r.text());
    }

    if (url.pathname === '/health') return json(res, 200, { ok: true, hub: hubBase(), port: PORT });

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (e) {
    json(res, 502, { ok: false, error: String(e?.message ?? e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('DSH Crew 看板: http://' + HOST + ':' + PORT + '  (hub: ' + hubBase() + ')');
});
