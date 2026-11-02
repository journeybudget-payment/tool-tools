const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? 20;

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const parts = args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)));
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)} ${parts.join(' ')}`;
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

export const log = {
  debug: (...a) => emit('debug', a),
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),
};
