'use strict';

/**
 * SFDC Helper Client SDK
 * 
 * A clean JavaScript wrapper for the SFDC Helper API that makes it easy to
 * integrate org-aware Salesforce data access into chatbots and applications.
 * 
 * Key Features:
 * - Org-aware field discovery
 * - Safe query building with allowlist validation  
 * - Automatic flattening and formatting
 * - Context-aware recommendations
 * - Built-in error handling and retries
 */

class SFDCHelperClient {
  constructor(baseUrl = 'http://localhost:3000', options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.options = {
      timeout: options.timeout || 30000,
      retries: options.retries || 2,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    // Cache for org-aware data
    this._cache = {
      allowlist: null,
      objectDescriptions: new Map(),
      picklists: new Map(),
      lastCacheTime: null
    };
  }

  /**
   * Health check - verify the service is running
   */
  async health() {
    return this._request('GET', '/health');
  }

  /**
   * Get org identity and limits
   */
  async getOrgInfo() {
    const [identity, limits] = await Promise.all([
      this._request('GET', '/me'),
      this._request('GET', '/limits')
    ]);
    return { identity, limits };
  }

  /**
   * Get the dynamic allowlist (static + discovered fields)
   */
  async getAllowlist(refresh = false) {
    if (!refresh && this._cache.allowlist) {
      return this._cache.allowlist;
    }
    
    const allowlist = await this._request('GET', '/allowlist');
    this._cache.allowlist = allowlist;
    this._cache.lastCacheTime = Date.now();
    return allowlist;
  }

  /**
   * Get allowlist discovery statistics
   */
  async getAllowlistStats() {
    return this._request('GET', '/allowlist/stats');
  }

  /**
   * Refresh the dynamic allowlist from context bundles
   */
  async refreshAllowlist() {
    const result = await this._request('POST', '/allowlist/refresh');
    this._cache.allowlist = null; // Clear cache
    return result;
  }

  /**
   * Get available fields for an object (org-aware)
   */
  async getAvailableFields(objectName) {
    const allowlist = await this.getAllowlist();
    const objectSpec = allowlist.objects?.[objectName] || allowlist[objectName];
    return objectSpec ? objectSpec.fields : [];
  }

  /**
   * Get default fields for an object
   */
  async getDefaultFields(objectName) {
    const allowlist = await this.getAllowlist();
    const objectSpec = allowlist.objects?.[objectName] || allowlist[objectName];
    return objectSpec ? (objectSpec.defaultFields || objectSpec.fields.slice(0, 8)) : [];
  }

  /**
   * Describe an object (with caching)
   */
  async describeObject(objectName, refresh = false) {
    if (!refresh && this._cache.objectDescriptions.has(objectName)) {
      return this._cache.objectDescriptions.get(objectName);
    }
    
    const description = await this._request('GET', `/sobjects/${objectName}/describe`);
    this._cache.objectDescriptions.set(objectName, description);
    return description;
  }

  /**
   * Get picklist values for an object (with caching)
   */
  async getPicklists(objectName, refresh = false) {
    if (!refresh && this._cache.picklists.has(objectName)) {
      return this._cache.picklists.get(objectName);
    }
    
    const picklists = await this._request('GET', `/sobjects/${objectName}/picklists`);
    this._cache.picklists.set(objectName, picklists);
    return picklists;
  }

  /**
   * Safe query with allowlist validation and optional flattening
   * This is the main method for chatbot queries
   */
  async safeQuery(objectName, options = {}) {
    const {
      fields = null, // Use default fields if not specified
      where = [],
      orderBy = null,
      limit = 50,
      flatten = true,
      format = 'json' // json, ndjson, csv
    } = options;

    // Validation
    if (!objectName || typeof objectName !== 'string') {
      throw new Error('objectName is required and must be a string');
    }

    if (where && !Array.isArray(where)) {
      throw new Error('where conditions must be an array');
    }

    if (limit && (typeof limit !== 'number' || limit <= 0)) {
      throw new Error('limit must be a positive number');
    }

    // Use default fields if none specified (org-aware)
    const queryFields = fields || await this.getDefaultFields(objectName);
    
    const payload = {
      object: objectName,
      fields: queryFields,
      where,
      limit,
      flatten
    };
    
    if (orderBy) {
      payload.orderBy = orderBy;
    }

    const endpoint = format === 'json' ? '/safe-query' : `/safe-query?format=${format}`;
    return this._request('POST', endpoint, payload);
  }

  /**
   * Raw SOQL query (use with caution)
   */
  async query(soql, options = {}) {
    const { limit, next } = options;
    
    if (next) {
      // Pagination
      return this._request('GET', `/query?next=${encodeURIComponent(next)}`);
    }
    
    const params = new URLSearchParams();
    params.set('soql', soql);
    if (limit) params.set('limit', limit.toString());
    
    return this._request('GET', `/query?${params.toString()}`);
  }

  /**
   * SOSL search across multiple objects
   */
  async search(sosl) {
    return this._request('POST', '/search', { sosl });
  }

  /**
   * Get recent records for an object
   */
  async getRecentRecords(objectName, limit = 10) {
    return this._request('GET', `/sobjects/${objectName}/recent-records?limit=${limit}`);
  }

  /**
   * Get changes since a timestamp
   */
  async getChanges(objectName, since, limit = 100) {
    const sinceParam = typeof since === 'string' ? since : since.toISOString();
    return this._request('GET', `/changes/${objectName}?since=${encodeURIComponent(sinceParam)}&limit=${limit}`);
  }

  /**
   * Get object insights (comprehensive analysis)
   */
  async getObjectInsights(objectName, options = {}) {
    const { verbose = false } = options;
    const params = verbose ? '?verbose=true' : '';
    return this._request('GET', `/objects/${objectName}/insights${params}`);
  }

  /**
   * Generate context bundle for an object
   */
  async generateContextBundle(objectName, options = {}) {
    const {
      persist = true,
      dir = null,
      runQueries = false,
      sample = 50,
      verbose = false
    } = options;

    const payload = {
      persist,
      runQueries,
      sample,
      verbose
    };
    
    if (dir) payload.dir = dir;

    return this._request('POST', `/objects/${objectName}/context/bundle`, payload);
  }

  /**
   * Get analytics - top fields for an object
   */
  async getTopFields(objectName, top = 10) {
    return this._request('GET', `/analytics/top-fields?object=${objectName}&top=${top}`);
  }

  /**
   * Get recent query analytics
   */
  async getRecentQueries(limit = 20) {
    return this._request('GET', `/analytics/queries/recent?limit=${limit}`);
  }

  /**
   * Build a smart query based on natural language intent
   * This uses the org's discovered fields and common patterns
   */
  async buildSmartQuery(objectName, intent, options = {}) {
    // Get insights to understand common query patterns
    const insights = await this.getObjectInsights(objectName);
    const availableFields = await this.getAvailableFields(objectName);
    
    // Simple intent parsing (could be enhanced with NLP)
    const suggestions = insights.suggestions || [];
    
    // Find the best matching suggestion based on intent keywords
    let bestSuggestion = null;
    let bestScore = 0;
    
    const intentWords = intent.toLowerCase().split(/\s+/);
    
    for (const suggestion of suggestions) {
      const suggestionText = (suggestion.title + ' ' + suggestion.description || '').toLowerCase();
      let score = 0;
      
      for (const word of intentWords) {
        if (suggestionText.includes(word)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestSuggestion = suggestion;
      }
    }
    
    if (bestSuggestion) {
      return {
        intent,
        suggestion: bestSuggestion,
        query: {
          object: objectName,
          fields: options.fields || await this.getDefaultFields(objectName),
          where: bestSuggestion.where,
          limit: options.limit || 50,
          flatten: options.flatten !== false
        }
      };
    }
    
    // Fallback to basic query
    return {
      intent,
      suggestion: null,
      query: {
        object: objectName,
        fields: options.fields || await this.getDefaultFields(objectName),
        where: [],
        limit: options.limit || 50,
        flatten: options.flatten !== false
      }
    };
  }

  /**
   * Execute a smart query built from intent
   */
  async executeSmartQuery(objectName, intent, options = {}) {
    const smartQuery = await this.buildSmartQuery(objectName, intent, options);
    const results = await this.safeQuery(objectName, smartQuery.query);
    
    return {
      ...smartQuery,
      results
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this._cache.allowlist = null;
    this._cache.objectDescriptions.clear();
    this._cache.picklists.clear();
    this._cache.lastCacheTime = null;
  }

  /**
   * Internal HTTP request method with retry logic
   */
  async _request(method, path, body = null, attempt = 1) {
    const url = `${this.baseUrl}${path}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'sfdc-helper-client/1.0.0'
      },
      timeout: this.options.timeout
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    
    try {
      let response;
      
      // Use fetch if available (Node.js 18+), otherwise fall back to a simple implementation
      if (typeof fetch !== 'undefined') {
        response = await fetch(url, options);
      } else {
        // Fallback for older Node.js versions
        response = await this._nodeFetch(url, options);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (_) {
          errorData = { error: errorText };
        }
        
        // Create enhanced error with suggestions if available
        const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.code = errorData.code;
        error.suggestions = errorData.suggestions || [];
        error.timestamp = errorData.timestamp;
        error.data = errorData;
        
        // Add helpful context to error message
        if (error.suggestions && error.suggestions.length > 0) {
          error.message += '\n\nSuggestions:';
          error.suggestions.forEach((suggestion, index) => {
            error.message += `\n  ${index + 1}. ${suggestion}`;
          });
        }
        
        throw error;
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
      
    } catch (error) {
      // Retry logic for network errors
      if (attempt <= this.options.retries && this._isRetryableError(error)) {
        console.warn(`[SFDCHelperClient] Request failed (attempt ${attempt}/${this.options.retries + 1}), retrying...`, error.message);
        await this._delay(this.options.retryDelay * attempt);
        return this._request(method, path, body, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Fallback fetch implementation for older Node.js versions
   */
  async _nodeFetch(url, options) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: new Map(Object.entries(res.headers)),
            json: async () => JSON.parse(data),
            text: async () => data
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  /**
   * Check if an error is retryable
   */
  _isRetryableError(error) {
    return error.code === 'ECONNRESET' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED' ||
           error.message.includes('timeout') ||
           (error.status >= 500 && error.status < 600);
  }

  /**
   * Simple delay utility
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SFDCHelperClient;
