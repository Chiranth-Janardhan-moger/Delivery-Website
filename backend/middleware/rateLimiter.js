const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (reduced for development)
  max: 50, // 50 requests per windowMs (increased for development)
  message: {
    error: true,
    message: 'Too many login attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: {
    error: true,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

module.exports = { loginLimiter, apiLimiter };
