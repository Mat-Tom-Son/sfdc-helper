'use strict';

/**
 * Structured Logging Configuration
 *
 * Provides Winston-based logging with different levels and formats
 * for development and production environments.
 */

const winston = require('winston');
const path = require('path');

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['timestamp', 'level', 'message'] }),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;

    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }

    return log;
  })
);

// Console transport with colors for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    customFormat
  )
});

// File transports for production
const fileTransports = [
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    maxsize: 10485760, // 10MB
    maxFiles: 5
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  defaultMeta: { service: 'sfdc-helper' },
  transports: process.env.NODE_ENV === 'production'
    ? [...fileTransports, consoleTransport]
    : [consoleTransport],
  exceptionHandlers: process.env.NODE_ENV === 'production'
    ? [new winston.transports.File({ filename: path.join(process.cwd(), 'logs', 'exceptions.log') })]
    : [],
  rejectionHandlers: process.env.NODE_ENV === 'production'
    ? [new winston.transports.File({ filename: path.join(process.cwd(), 'logs', 'rejections.log') })]
    : []
});

/**
 * Express middleware for request logging
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}

/**
 * Query logging helper
 */
function logQuery(objectName, fields, resultCount, duration, metadata = {}) {
  logger.info('Query executed', {
    objectName,
    fieldsCount: fields?.length || 0,
    resultCount,
    duration: `${duration}ms`,
    ...metadata
  });
}

/**
 * Error logging helper
 */
function logError(message, error, context = {}) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...context
  });
}

module.exports = {
  logger,
  requestLogger,
  logQuery,
  logError
};
