import { webcrypto } from 'node:crypto';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmn6W8gvH9YPZPYHTmcKL
Y26+3dYZA5/tqtL8ZJoJhkMWPEhdRsyRkV4O5IKKEAnOc8ijg4CD97ybDtxiMZ1T
6WS8cmqZeNNDtDrV49hF9VKme27jwcNvtHDBNTxsoBwDV5XP6dWT63mf2J5ww68P
QZOGZR9sqrnKr6JXLYpy/5YLZ3eOlLPSORoj51dkLCT8pHUGQ75QB9Ii3VxttzJl
Q8s//VgAakc6q+pEt1B5bkV78rsD77SucJFuMQT624vUlNf3mp5wOv5fuVfcGNvj
27Yhdy+DHONAtvGfnHX5fTpe5y4GiW1+kV8A6mSK19TPqmbmeWc2Vd6Hiu6n4y+I
3QIDAQAB
-----END PUBLIC KEY-----`;

let cachedKey;

function importKey() {
  if (cachedKey) return cachedKey;
  const b64 = PUBLIC_KEY.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  cachedKey = webcrypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-1' },
    false,
    ['encrypt'],
  );
  return cachedKey;
}

export async function rsaEncrypt(plain) {
  const key = await importKey();
  const data = new TextEncoder().encode(String(plain));
  const buf = await webcrypto.subtle.encrypt({ name: 'RSA-OAEP', hash: 'SHA-1' }, key, data);
  return Buffer.from(buf).toString('base64');
}