'use strict';

/**
 * Request Validation Middleware
 *
 * Provides validation rules for common API endpoints using express-validator.
 */

const { body, query, param, validationResult } = require('express-validator');
const { logger } = require('./logger');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    logger.warn('Request validation failed', {
      path: req.path,
      errors: errorDetails,
      ip: req.ip
    });

    return res.status(400).json({
      error: 'Validation error',
      message: 'Request validation failed',
      errors: errorDetails
    });
  }

  next();
}

/**
 * Validation rules for safe query endpoint
 */
const validateSafeQuery = [
  body('object')
    .isString()
    .notEmpty()
    .withMessage('Object name is required')
    .matches(/^[A-Za-z][A-Za-z0-9_]*$/)
    .withMessage('Invalid object name format'),

  body('fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),

  body('fields.*')
    .optional()
    .isString()
    .matches(/^[A-Za-z][A-Za-z0-9_.]*$/)
    .withMessage('Invalid field name format'),

  body('where')
    .optional()
    .isArray()
    .withMessage('Where conditions must be an array'),

  body('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),

  body('flatten')
    .optional()
    .isBoolean()
    .withMessage('Flatten must be a boolean'),

  handleValidationErrors
];

/**
 * Validation rules for query endpoint
 */
const validateQuery = [
  query('soql')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('SOQL query cannot be empty'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 2000 })
    .withMessage('Limit must be between 1 and 2000'),

  query('next')
    .optional()
    .isString()
    .withMessage('Next must be a string'),

  handleValidationErrors
];

/**
 * Validation rules for search endpoint
 */
const validateSearch = [
  body('sosl')
    .isString()
    .notEmpty()
    .withMessage('SOSL query is required')
    .matches(/^FIND\s+\{.+\}/i)
    .withMessage('Invalid SOSL format - must start with FIND {...}'),

  handleValidationErrors
];

/**
 * Validation rules for object insights
 */
const validateObjectInsights = [
  param('name')
    .isString()
    .notEmpty()
    .matches(/^[A-Za-z][A-Za-z0-9_]*$/)
    .withMessage('Invalid object name'),

  query('verbose')
    .optional()
    .isBoolean()
    .withMessage('Verbose must be true or false'),

  handleValidationErrors
];

/**
 * Validation rules for context bundle generation
 */
const validateContextBundle = [
  param('name')
    .isString()
    .notEmpty()
    .matches(/^[A-Za-z][A-Za-z0-9_]*$/)
    .withMessage('Invalid object name'),

  body('persist')
    .optional()
    .isBoolean()
    .withMessage('Persist must be a boolean'),

  body('runQueries')
    .optional()
    .isBoolean()
    .withMessage('RunQueries must be a boolean'),

  body('sample')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Sample must be between 1 and 1000'),

  body('verbose')
    .optional()
    .isBoolean()
    .withMessage('Verbose must be a boolean'),

  handleValidationErrors
];

/**
 * Validation rules for changes endpoint
 */
const validateChanges = [
  param('name')
    .isString()
    .notEmpty()
    .matches(/^[A-Za-z][A-Za-z0-9_]*$/)
    .withMessage('Invalid object name'),

  query('since')
    .isString()
    .notEmpty()
    .matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    .withMessage('Since must be ISO 8601 date format'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),

  handleValidationErrors
];

/**
 * Validation rules for chat endpoint
 */
const validateChat = [
  body('userId')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('UserId must be a non-empty string'),

  body('message')
    .isString()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 10000 })
    .withMessage('Message too long (max 10000 characters)'),

  handleValidationErrors
];

module.exports = {
  validateSafeQuery,
  validateQuery,
  validateSearch,
  validateObjectInsights,
  validateContextBundle,
  validateChanges,
  validateChat,
  handleValidationErrors
};
