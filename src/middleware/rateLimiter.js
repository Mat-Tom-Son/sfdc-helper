'use strict';

/**
 * Rate Limiting Middleware
 *
 * Protects the API from abuse by limiting request rates per IP/API key.
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('./logger');

/**
 * General API rate limiter (100 requests per minute)
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      apiKey: req.apiKey?.name
    });

    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit of 100 requests per minute',
      retryAfter: 60
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/health/live' || req.path === '/health/ready';
  },
  keyGenerator: (req) => {
    // Use API key if available, otherwise IP address
    return req.apiKey?.name || req.ip;
  }
});

/**
 * Strict rate limiter for expensive operations (10 requests per minute)
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: {
    error: 'Too many requests',
    message: 'This endpoint has a strict rate limit of 10 requests per minute',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      apiKey: req.apiKey?.name
    });

    res.status(429).json({
      error: 'Too many requests',
      message: 'This endpoint is rate limited to 10 requests per minute',
      retryAfter: 60
    });
  },
  keyGenerator: (req) => {
    return req.apiKey?.name || req.ip;
  }
});

/**
 * Authentication rate limiter (5 attempts per minute)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please wait before trying again',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req) => req.ip
});

module.exports = {
  apiLimiter,
  strictLimiter,
  authLimiter
};
