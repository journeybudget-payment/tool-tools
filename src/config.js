'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_URL = 'https://www.pinjamtok.asia';

const DEFAULTS = {
  baseUrl: DEFAULT_BASE_URL,
  dialCode: '60',
  concurrency: 2,
  throttleBaseMs: 400,
  throttleMaxMs: 5000,
  timeoutMs: 20000,
  encrypt: false,
  advCode: null,
  referralCode: null,
};

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// terima baseUrl / baseURL / base_url / url / host
function pickBaseUrl(cfg) {
  const keys = ['baseUrl', 'baseURL', 'base_url', 'url', 'host'];
  for (const k of keys) {
    if (typeof cfg[k] === 'string' && cfg[k].trim()) return cfg[k];
  }
  return null;
}

function normalizeBaseUrl(raw) {
  const value = (raw == null ? '' : String(raw)).trim();
  if (!value) return DEFAULT_BASE_URL;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, '');
}

function loadConfig(file, overrides = {}) {
  const target = file || path.join(process.cwd(), 'config.json');

  let raw = {};
  if (fs.existsSync(target)) {
    raw = JSON.parse(fs.readFileSync(target, 'utf8'));
  } else if (!overrides.baseUrl) {
    console.warn(`[config] ${target} tak jumpa — guna nilai lalai (${DEFAULT_BASE_URL}).`);
  }

  const cfg = { ...DEFAULTS, ...raw, ...stripUndefined(overrides) };

  const picked = pickBaseUrl(cfg);
  if (!picked) {
    throw new Error(
      'baseUrl tiada dalam config.json. Tambah: "baseUrl": "https://www.pinjamtok.asia"'
    );
  }
  cfg.baseUrl = normalizeBaseUrl(picked);

  if (!cfg.mobileNo) {
    throw new Error('mobileNo wajib ada dalam config.json (tanpa awalan 60).');
  }
  cfg.mobileNo = String(cfg.mobileNo).replace(/[\s-]/g, '');
  if (!/^1\d{8,9}$/.test(cfg.mobileNo)) {
    console.warn(`[config] amaran: mobileNo "${cfg.mobileNo}" nampak tak normal.`);
  }

  cfg.dialCode = String(cfg.dialCode || '60');
  cfg.advCode = cfg.advCode || null;
  cfg.referralCode = cfg.referralCode || null;

  return cfg;
}

module.exports = { loadConfig, normalizeBaseUrl, DEFAULT_BASE_URL, DEFAULTS };