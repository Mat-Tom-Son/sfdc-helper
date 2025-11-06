'use strict';

/**
 * API Key Authentication Middleware
 *
 * Provides simple API key-based authentication for the SFDC Helper API.
 * Keys are stored in environment variables or a keys file.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

// In-memory API key store
const apiKeys = new Map();

// Load API keys from environment or file
function loadApiKeys() {
  // Try environment variable first (comma-separated keys)
  const envKeys = process.env.API_KEYS;
  if (envKeys) {
    envKeys.split(',').forEach(key => {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        apiKeys.set(trimmedKey, {
          name: 'env-key',
          createdAt: new Date(),
          lastUsed: null
        });
      }
    });
    logger.info(`Loaded ${apiKeys.size} API keys from environment`);
    return;
  }

  // Try loading from keys file
  const keysPath = path.join(process.cwd(), 'api-keys.json');
  if (fs.existsSync(keysPath)) {
    try {
      const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
      keysData.forEach(keyObj => {
        apiKeys.set(keyObj.key, {
          name: keyObj.name || 'unnamed',
          createdAt: new Date(keyObj.createdAt),
          lastUsed: keyObj.lastUsed ? new Date(keyObj.lastUsed) : null
        });
      });
      logger.info(`Loaded ${apiKeys.size} API keys from ${keysPath}`);
    } catch (err) {
      logger.error('Failed to load API keys from file', { error: err.message });
    }
    return;
  }

  // No keys found - generate a default one for first-time setup
  if (apiKeys.size === 0) {
    const defaultKey = generateApiKey();
    apiKeys.set(defaultKey, {
      name: 'default-key',
      createdAt: new Date(),
      lastUsed: null
    });

    logger.warn('No API keys configured! Generated default key (save this):');
    logger.warn(`API_KEY: ${defaultKey}`);
    logger.warn('Add this to your .env file: API_KEYS=' + defaultKey);
    logger.warn('Or disable auth with: DISABLE_AUTH=true');
  }
}

/**
 * Generate a secure random API key
 */
function generateApiKey() {
  return 'sk_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Validate API key from request
 */
function validateApiKey(req) {
  // Check multiple headers for flexibility
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.api_key;

  if (!apiKey) {
    return { valid: false, error: 'No API key provided' };
  }

  const keyData = apiKeys.get(apiKey);
  if (!keyData) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Update last used timestamp
  keyData.lastUsed = new Date();

  return { valid: true, keyData };
}

/**
 * Express middleware for API key authentication
 */
function requireApiKey(req, res, next) {
  // Skip auth if explicitly disabled
  if (process.env.DISABLE_AUTH === 'true') {
    logger.warn('Authentication is DISABLED - not recommended for production!');
    return next();
  }

  // Skip auth for health check endpoints
  if (req.path === '/health' || req.path === '/health/live' || req.path === '/health/ready') {
    return next();
  }

  const result = validateApiKey(req);

  if (!result.valid) {
    logger.warn('Authentication failed', {
      ip: req.ip,
      path: req.path,
      error: result.error
    });

    return res.status(401).json({
      error: 'Authentication required',
      message: result.error,
      hint: 'Provide API key via X-API-Key header or Authorization: Bearer <key>'
    });
  }

  // Add key info to request for logging
  req.apiKey = result.keyData;

  logger.debug('Request authenticated', {
    keyName: result.keyData.name,
    path: req.path
  });

  next();
}

/**
 * Express middleware for optional authentication (allows both authenticated and anonymous)
 */
function optionalApiKey(req, res, next) {
  if (process.env.DISABLE_AUTH === 'true') {
    return next();
  }

  const result = validateApiKey(req);
  if (result.valid) {
    req.apiKey = result.keyData;
    req.authenticated = true;
  } else {
    req.authenticated = false;
  }

  next();
}

/**
 * Add a new API key
 */
function addApiKey(name = 'unnamed') {
  const key = generateApiKey();
  apiKeys.set(key, {
    name,
    createdAt: new Date(),
    lastUsed: null
  });

  logger.info('Created new API key', { name });

  return key;
}

/**
 * Revoke an API key
 */
function revokeApiKey(key) {
  const existed = apiKeys.delete(key);
  if (existed) {
    logger.info('Revoked API key');
  }
  return existed;
}

/**
 * List all API keys (without showing the actual keys)
 */
function listApiKeys() {
  return Array.from(apiKeys.entries()).map(([key, data]) => ({
    keyPrefix: key.substring(0, 10) + '...',
    name: data.name,
    createdAt: data.createdAt,
    lastUsed: data.lastUsed
  }));
}

// Initialize keys on module load
loadApiKeys();

module.exports = {
  requireApiKey,
  optionalApiKey,
  validateApiKey,
  generateApiKey,
  addApiKey,
  revokeApiKey,
  listApiKeys,
  loadApiKeys
};
