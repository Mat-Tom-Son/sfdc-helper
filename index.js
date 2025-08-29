'use strict';

/**
 * SFDC Helper - Main Package Exports
 * 
 * This package provides both a server API and a client SDK for org-aware
 * Salesforce data access, perfect for chatbots and admin tools.
 */

// Client SDK (main export for most users)
const SFDCHelperClient = require('./src/client');

// Server components are intentionally NOT imported here to avoid side effects
// Importing the server would start an HTTP listener during package import.
const { OBJECTS, getAllowedFields, isObjectAllowed } = require('./src/allowlist');

// Utilities
const { generateObjectInsights } = require('./src/insights');
const { buildSafeSoql } = require('./src/safeQuery');

module.exports = {
  // Main client SDK
  SFDCHelperClient,
  
  // Convenience default export
  Client: SFDCHelperClient,
  
  // Allowlist utilities
  allowlist: {
    OBJECTS,
    getAllowedFields,
    isObjectAllowed
  },
  
  // Advanced utilities
  utils: {
    generateObjectInsights,
    buildSafeSoql
  }
};

// Default export is the client for easy require()
module.exports.default = SFDCHelperClient;
