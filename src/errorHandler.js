'use strict';

/**
 * Enhanced Error Handling for SFDC Helper
 * 
 * Provides descriptive, actionable error messages that help developers
 * understand and fix issues quickly.
 */

class SFDCHelperError extends Error {
  constructor(message, code, statusCode = 500, suggestions = []) {
    super(message);
    this.name = 'SFDCHelperError';
    this.code = code;
    this.statusCode = statusCode;
    this.suggestions = suggestions;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      suggestions: this.suggestions,
      timestamp: this.timestamp
    };
  }
}

/**
 * Enhanced error handler that provides context-aware error messages
 */
function enhanceError(error, context = {}) {
  const { operation, objectName, field, value } = context;
  
  // Salesforce API errors
  if (error.name === 'INVALID_FIELD' || error.message?.includes('No such column')) {
    const fieldName = field || extractFieldFromError(error.message);
    return new SFDCHelperError(
      `Field '${fieldName}' is not available on ${objectName || 'this object'}`,
      'INVALID_FIELD',
      400,
      [
        `Check available fields with: GET /sobjects/${objectName}/describe`,
        `Use allowlisted fields with: GET /allowlist`,
        `Generate context to discover fields: POST /objects/${objectName}/context/bundle`,
        `Refresh dynamic allowlist: POST /allowlist/refresh`
      ]
    );
  }

  if (error.name === 'MALFORMED_QUERY' || error.message?.includes('unexpected token')) {
    return new SFDCHelperError(
      `Invalid SOQL query syntax: ${error.message}`,
      'MALFORMED_QUERY',
      400,
      [
        'Use the safe-query endpoint for validated queries: POST /safe-query',
        'Check SOQL syntax: https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta',
        'Use the query builder instead of raw SOQL',
        'Validate field names against the object schema'
      ]
    );
  }

  if (error.name === 'INVALID_TYPE' || error.message?.includes('sObject type') || error.message?.includes('does not exist')) {
    const objectName = extractObjectFromError(error.message) || objectName;
    return new SFDCHelperError(
      `Object '${objectName}' does not exist or is not accessible`,
      'INVALID_OBJECT',
      400,
      [
        'Check available objects with: GET /describe',
        'Verify object name spelling and case sensitivity',
        'Ensure you have permission to access this object',
        'Check if this is a custom object (should end with __c)'
      ]
    );
  }

  // Permission errors
  if (error.message?.includes('INSUFFICIENT_ACCESS') || error.message?.includes('permission')) {
    return new SFDCHelperError(
      `Insufficient permissions: ${error.message}`,
      'INSUFFICIENT_ACCESS',
      403,
      [
        'Check your user permissions for this object/field',
        'Verify your profile has read access',
        'Contact your Salesforce administrator',
        'Check field-level security settings'
      ]
    );
  }

  // Rate limiting
  if (error.message?.includes('REQUEST_LIMIT_EXCEEDED') || error.statusCode === 429) {
    return new SFDCHelperError(
      'API rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      [
        'Wait before making additional requests',
        'Reduce query frequency',
        'Use bulk operations for large datasets',
        'Check org limits with: GET /limits'
      ]
    );
  }

  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new SFDCHelperError(
      'Cannot connect to Salesforce API',
      'CONNECTION_ERROR',
      502,
      [
        'Check your internet connection',
        'Verify SF_INSTANCE_URL in environment variables',
        'Ensure Salesforce instance is accessible',
        'Check firewall and proxy settings'
      ]
    );
  }

  // Authentication errors
  if (error.message?.includes('INVALID_SESSION_ID') || error.message?.includes('Session expired')) {
    return new SFDCHelperError(
      'Salesforce session expired or invalid',
      'INVALID_SESSION',
      401,
      [
        'Refresh your access token',
        'Check SF_REFRESH_TOKEN environment variable',
        'Verify connected app configuration',
        'Re-authenticate with Salesforce'
      ]
    );
  }

  if (error.message?.includes('invalid_grant') || error.message?.includes('authentication failure')) {
    return new SFDCHelperError(
      'Salesforce authentication failed',
      'AUTH_FAILED',
      401,
      [
        'Check SF_CLIENT_ID and SF_CLIENT_SECRET',
        'Verify SF_REFRESH_TOKEN is valid',
        'Ensure connected app is properly configured',
        'Check if refresh token has expired'
      ]
    );
  }

  // Validation errors
  if (error.message?.includes('REQUIRED_FIELD_MISSING')) {
    return new SFDCHelperError(
      'Required field is missing from query',
      'REQUIRED_FIELD_MISSING',
      400,
      [
        'Include required fields in your query',
        'Check object requirements with: GET /sobjects/{object}/requirements',
        'Use default fields: GET /allowlist',
        'Review validation rules for this object'
      ]
    );
  }

  // Allowlist errors (custom to our system)
  if (error.message?.includes('not in allowlist') || error.message?.includes('not allowed')) {
    const fieldName = field || extractFieldFromError(error.message);
    return new SFDCHelperError(
      `Field '${fieldName}' is not in the allowlist for ${objectName}`,
      'FIELD_NOT_ALLOWED',
      400,
      [
        `Check allowed fields: GET /allowlist`,
        `Generate context to discover more fields: POST /objects/${objectName}/context/bundle`,
        `Refresh dynamic allowlist: POST /allowlist/refresh`,
        `Use safe-query endpoint for validated queries`
      ]
    );
  }

  if (error.message?.includes('operator not allowed')) {
    const operator = extractOperatorFromError(error.message);
    return new SFDCHelperError(
      `Operator '${operator}' is not allowed for field '${field}' on ${objectName}`,
      'OPERATOR_NOT_ALLOWED',
      400,
      [
        'Check allowed operators in the allowlist',
        'Use supported operators: =, !=, LIKE, IN, NOT IN, >, >=, <, <=',
        'Different fields support different operators',
        'Use safe-query for operator validation'
      ]
    );
  }

  // Generic Salesforce errors
  if (error.errorCode || error.name?.includes('SALESFORCE')) {
    return new SFDCHelperError(
      `Salesforce API error: ${error.message}`,
      error.errorCode || 'SALESFORCE_ERROR',
      error.statusCode || 400,
      [
        'Check Salesforce documentation for this error',
        'Verify your query syntax and parameters',
        'Ensure you have proper permissions',
        'Contact Salesforce support if the error persists'
      ]
    );
  }

  // Network timeouts
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return new SFDCHelperError(
      'Request timed out',
      'TIMEOUT',
      408,
      [
        'Reduce query complexity or limit',
        'Check network connectivity',
        'Increase timeout in client options',
        'Use pagination for large datasets'
      ]
    );
  }

  // JSON parsing errors
  if (error instanceof SyntaxError && error.message?.includes('JSON')) {
    return new SFDCHelperError(
      'Invalid JSON in request body',
      'INVALID_JSON',
      400,
      [
        'Check JSON syntax in request body',
        'Ensure all quotes are properly escaped',
        'Validate JSON structure',
        'Use a JSON validator tool'
      ]
    );
  }

  // Default enhanced error
  return new SFDCHelperError(
    error.message || 'An unexpected error occurred',
    error.code || 'UNKNOWN_ERROR',
    error.statusCode || 500,
    [
      'Check the server logs for more details',
      'Verify your request parameters',
      'Try the request again',
      'Contact support if the issue persists'
    ]
  );
}

/**
 * Express error handler middleware
 */
function errorHandlerMiddleware(error, req, res, next) {
  const enhancedError = enhanceError(error, {
    operation: req.method + ' ' + req.path,
    objectName: req.params.name,
    field: req.body?.field || req.query?.field,
    value: req.body?.value || req.query?.value
  });

  // Log the error for debugging
  console.error(`[${enhancedError.timestamp}] ${enhancedError.code}:`, enhancedError.message);
  if (enhancedError.statusCode >= 500) {
    console.error('Stack trace:', error.stack);
  }

  res.status(enhancedError.statusCode).json(enhancedError.toJSON());
}

/**
 * Async wrapper for route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error helper
 */
function createValidationError(field, message, suggestions = []) {
  return new SFDCHelperError(
    `Validation error for field '${field}': ${message}`,
    'VALIDATION_ERROR',
    400,
    suggestions
  );
}

// Helper functions to extract information from error messages
function extractFieldFromError(message) {
  const fieldMatch = message.match(/field[s]?\s+['"]?(\w+)['"]?/i) || 
                     message.match(/column\s+['"]?(\w+)['"]?/i) ||
                     message.match(/['"](\w+)['"] not found/i);
  return fieldMatch ? fieldMatch[1] : 'unknown';
}

function extractObjectFromError(message) {
  const objectMatch = message.match(/sObject type\s+['"]?(\w+)['"]?/i) ||
                      message.match(/object\s+['"]?(\w+)['"]?/i);
  return objectMatch ? objectMatch[1] : 'unknown';
}

function extractOperatorFromError(message) {
  const operatorMatch = message.match(/operator\s+['"]?(\w+)['"]?/i);
  return operatorMatch ? operatorMatch[1] : 'unknown';
}

module.exports = {
  SFDCHelperError,
  enhanceError,
  errorHandlerMiddleware,
  asyncHandler,
  createValidationError
};
