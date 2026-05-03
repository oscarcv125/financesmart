// Tiny structured logger. JSON lines so Vercel's log search can index fields.
// Wraps console.* so it's a drop-in for code that used `console.error`. Adds
// timestamps, level, and an optional context object. Plug a real backend
// (Sentry, Logtail, Datadog) by replacing the emit() function.

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

function shouldLog(level) {
  return (LEVEL_ORDER[level] ?? 1) >= (LEVEL_ORDER[MIN_LEVEL] ?? 1);
}

function emit(level, msg, ctx) {
  if (!shouldLog(level)) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(ctx && typeof ctx === 'object' ? { ctx } : {}),
  };
  // Errors come with a stack we don't want stringified onto a single line.
  if (ctx instanceof Error) {
    line.ctx = { name: ctx.name, message: ctx.message, stack: ctx.stack?.split('\n').slice(0, 5).join(' | ') };
  }
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  try { target(JSON.stringify(line)); }
  catch { target(`[${line.t}] ${level} ${msg}`); }
}

module.exports = {
  debug: (msg, ctx) => emit('debug', msg, ctx),
  info:  (msg, ctx) => emit('info', msg, ctx),
  warn:  (msg, ctx) => emit('warn', msg, ctx),
  error: (msg, ctx) => emit('error', msg, ctx),
};
