const ORIGIN = 'https://www.pinjamtok.asia';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response('pinjamtok proxy ok', { headers: { 'content-type': 'text/plain' } });
    }

    const target = new URL(ORIGIN + url.pathname + url.search);
    const headers = new Headers(request.headers);
    headers.set('origin', ORIGIN);
    headers.set('referer', `${ORIGIN}/log-in`);
    headers.set('host', new URL(ORIGIN).host);
    headers.delete('cf-connecting-ip');

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    });

    const out = new Headers(upstream.headers);
    out.set('access-control-allow-origin', '*');
    out.delete('content-encoding');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
