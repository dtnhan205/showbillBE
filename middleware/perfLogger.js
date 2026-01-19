const mongoose = require('mongoose');

function patchMongooseDebug() {
  if (mongoose.__perfDebugPatched) return;
  mongoose.__perfDebugPatched = true;

  // Logs query shape. For durations, use MongoDB profiler (recommended).
  mongoose.set('debug', (collectionName, method, query, doc, options) => {
    const tracked = new Set(['find', 'findOne', 'aggregate', 'updateMany', 'countDocuments', 'findOneAndUpdate']);
    if (!tracked.has(method)) return;
    console.log(`[mongo] ${collectionName}.${method}`, {
      query,
      doc,
      options,
      at: new Date().toISOString(),
    });
  });
}

function perfLogger({ slowMs = 800 } = {}) {
  patchMongooseDebug();

  return function perf(req, res, next) {
    const start = process.hrtime.bigint();
    const url = req.originalUrl || req.url;

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;

      if (ms >= slowMs) {
        console.warn(`[slow_api] ${req.method} ${url}`, {
          status: res.statusCode,
          ms: Math.round(ms),
          ip: req.ip,
        });
      }
    });

    next();
  };
}

module.exports = { perfLogger };


