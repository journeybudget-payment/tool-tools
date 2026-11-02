import { rsaEncrypt } from './rsa.js';

/**
 * Klien nipis untuk endpoint auth pinjamtok.asia.
 * Tidak menggunakan cookie/sesi — setiap percubaan adalah bebas.
 */
export class PinjamTokClient {
  constructor(cfg) {
    this.cfg = cfg;
    this.base = String(cfg.baseUrl).replace(/\/+$/, '');
  }

  #headers() {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-language': 'ms-MY,ms;q=0.9,en;q=0.8',
      origin: this.base,
      referer: `${this.base}/log-in`,
      lang: 'ms',
      'device-model': 'web',
      'user-agent': this.cfg.userAgent,
    };
  }

  #identity() {
    return {
      dial_code: String(this.cfg.dialCode),
      mobile_no: String(this.cfg.mobileNo),
      adv_code: this.cfg.advCode ?? null,
      referral_code: this.cfg.referralCode ?? null,
    };
  }

  async #post(path, body) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(`${this.base}/api${path}`, {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify(body),
        signal: ac.signal,
        redirect: 'follow',
      });
      const raw = await res.text();
      let json = {};
      try {
        if (raw) json = JSON.parse(raw);
      } catch {
        json = { message: raw.slice(0, 300) };
      }
      return { httpStatus: res.status, json, raw };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Semak akaun wujud dan ada PIN. */
  verifyAccount() {
    return this.#post('/customer/verify-password', this.#identity());
  }

  /** Cuba satu PIN. step:2 = hantar PIN, bukan OTP. */
  async login(pin) {
    const password = this.cfg.encrypt ? await rsaEncrypt(pin) : pin;
    return this.#post('/auth/mobile-login', { ...this.#identity(), step: 2, password });
  }
}