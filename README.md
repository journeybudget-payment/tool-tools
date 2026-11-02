# pinjamtok-pin-cracker

Alat brute-force PIN 6 digit untuk akaun [pinjamtok.asia](https://www.pinjamtok.asia), untuk kes anda lupa PIN sendiri.

Alat ini meniru aliran log masuk sebenar yang dipakai oleh aplikasi web mereka:

1. `POST /api/customer/verify-password` — sahkan akaun wujud dan ada PIN
2. `POST /api/auth/mobile-login` dengan `step: 2` — hantar calon PIN

Cloudflare Turnstile **tidak** diperlukan untuk langkah 2, jadi tiada browser/headless diperlukan.

## Keperluan

- Node.js 20 atau lebih baru (guna `fetch` terbina)
- Nombor telefon akaun anda

## Pasang

```bash
git clone https://github.com/<anda>/pinjamtok-pin-cracker.git
cd pinjamtok-pin-cracker
cp config.example.json config.json
