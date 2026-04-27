const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    typewriter: {
      intervalMs: Math.max(4, parseInt(process.env.TYPEWRITER_INTERVAL_MS, 10) || 18),
      charsPerTick: Math.max(1, parseInt(process.env.TYPEWRITER_CHARS_PER_TICK, 10) || 2),
    },
  });
});

module.exports = router;
