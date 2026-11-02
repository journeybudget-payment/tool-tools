import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';

export function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Tulis atomik supaya fail tak rosak kalau proses mati separuh jalan. */
export function saveJson(path, value) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

export function clearFile(path) {
  if (existsSync(path)) unlinkSync(path);
}