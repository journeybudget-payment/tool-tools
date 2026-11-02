'use strict';

const { encryptPin } = require('./rsa');
const { normalizeBaseUrl, DEFAULT_BASE_URL } = require('./config');

const BASE_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  origin: DEFAULT_BASE_URL,
  referer: `${DEFAULT_BASE_URL}/`,
};

function joinUrl(baseUrl, path) {
  const base = normalizeBaseUrl(baseUrl);
  const suffix = String(path || '').replace(/^\/+/, '');
  const url = `${base}/${suffix}`;
  if (!/^https?:\/\/[^/]+/i.test(url)) {
    throw new Error(`URL tak sah: "${url}" (baseUrl=${JSON.stringify(baseUrl)})`);
  }
  return url;
}

class HttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

class PinjamTokClient {
  constructor(options = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = Number(options.timeoutMs) || 20000;
    this.headers = { ...BASE_HEADERS, ...(options.headers || {}) };
  }

  async request(path, payload) {
    const url = joinUrl(this.baseUrl, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      throw new HttpError(`Rangkaian gagal POST ${url}: ${err.message}`, 0, null);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return { url, status: res.status, ok: res.ok, data };
  }

  async verifyPassword(mobileNo, pin, extra = {}) {
    if (mobileNo && typeof mobileNo === 'object') {
      extra = mobileNo;
      mobileNo = extra.mobileNo;
      pin = extra.pin;
    }
    const payload = {
      dial_code: String(extra.dialCode || '60'),
      mobile_no: String(mobileNo),
      password: extra.encrypt ? await encryptPin(pin) : String(pin),
      adv_code: extra.advCode ?? null,
      referral_code: extra.referralCode ?? null,
    };
    return this.request('/api/customer/verify-password', payload);
  }

  async mobileLogin(mobileNo, pin, extra = {}) {
    if (mobileNo && typeof mobileNo === 'object') {
      extra = mobileNo;
      mobileNo = extra.mobileNo;
      pin = extra.pin;
    }
    const payload = {
      dial_code: String(extra.dialCode || '60'),
      mobile_no: String(mobileNo),
      step: 2,
      password: extra.encrypt ? await encryptPin(pin) : String(pin),
    };
    return this.request('/api/auth/mobile-login', payload);
  }

  async check() {
    const result = await this.verifyPassword('000000000', '000000', {
      dialCode: '60',
      advCode: null,
      referralCode: null,
    });
    return { ...result, baseUrl: this.baseUrl };
  }
}

function classify(result) {
  const body = result.data || {};
  const blob = JSON.stringify(body).toLowerCase();

  if (result.status === 429 || blob.includes('too many') || blob.includes('terlalu banyak')) {
    return 'throttled';
  }
  if (result.ok && body.success !== false) return 'ok';
  if (blob.includes('password') || blob.includes('kata laluan') || blob.includes('pin')) {
    return 'wrong';
  }
  return 'unknown';
}

module.exports = { PinjamTokClient, joinUrl, classify, HttpError };