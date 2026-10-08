/** fetch med tidsavbrudd som krever JSON-svar (SPA-fallback som gir HTML regnes som feil). */
export async function fetchJson<T = unknown>(url: string, opts: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json', ...opts.headers } });
    if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText}`);
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpError(0, 'Response was not JSON');
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Prøv først via Render/Vite-proxyen (samme domene), deretter direkte. */
export async function fetchViaProxy<T>(proxyUrl: string, directUrl: string, signal?: AbortSignal): Promise<T> {
  try {
    return await fetchJson<T>(proxyUrl, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof HttpError && (e.status === 401 || e.status === 403 || e.status === 429)) throw e;
    return await fetchJson<T>(directUrl, { signal });
  }
}

let jsonpCounter = 0;
/** JSONP for API-er uten CORS (Deezer). */
export function jsonp<T>(url: string, opts: { timeoutMs?: number; callbackParam?: string } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__jsonp_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      delete w[name];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out (JSONP)'));
    }, opts.timeoutMs ?? 12000);
    w[name] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP error'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}${opts.callbackParam ?? 'callback'}=${name}`;
    document.head.appendChild(script);
  });
}

/** Sørger for minst `ms` millisekunder mellom kall (rate limit per kilde). */
export function rateLimiter(ms: number) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + ms;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  };
}
