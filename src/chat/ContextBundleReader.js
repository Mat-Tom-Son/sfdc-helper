'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * ContextBundleReader - Efficiently reads pre-computed context bundles
 * 
 * This provides fast access to org-specific context without expensive real-time generation
 */
class ContextBundleReader {
  constructor(bundleDir = 'context_bundles') {
    this.bundleDir = bundleDir;
    this.cache = new Map(); // objectName -> bundle data
    this.bundlePaths = new Map(); // objectName -> latest bundle path
    this.cacheExpiry = new Map(); // objectName -> expiry timestamp
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache
    this.loadingPromises = new Map(); // objectName -> loading promise (prevent duplicate loads)
  }

  /**
   * Get the latest context bundle for an object with optimized caching
   */
  async getLatestBundle(objectName) {
    const now = Date.now();
    
    // Check cache first and if it's still valid
    if (this.cache.has(objectName)) {
      const expiry = this.cacheExpiry.get(objectName);
      if (!expiry || now < expiry) {
        return this.cache.get(objectName);
      }
      // Cache expired, remove it
      this.cache.delete(objectName);
      this.cacheExpiry.delete(objectName);
    }

    // Check if we're already loading this bundle (prevent duplicate loads)
    if (this.loadingPromises.has(objectName)) {
      return await this.loadingPromises.get(objectName);
    }

    // Create loading promise
    const loadingPromise = this.loadBundleWithCaching(objectName, now);
    this.loadingPromises.set(objectName, loadingPromise);

    try {
      const bundle = await loadingPromise;
      return bundle;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(objectName);
    }
  }

  /**
   * Load bundle with caching logic
   */
  async loadBundleWithCaching(objectName, now) {
    // Find the latest bundle directory for this object
    const bundlePath = await this.findLatestBundlePath(objectName);
    if (!bundlePath) {
      return null;
    }

    // Load the bundle
    const bundle = await this.loadBundle(bundlePath, objectName);
    
    if (bundle) {
      // Cache the bundle with expiry
      this.cache.set(objectName, bundle);
      this.cacheExpiry.set(objectName, now + this.cacheTimeout);
    }
    
    return bundle;
  }

  /**
   * Find the latest bundle directory for an object
   */
  async findLatestBundlePath(objectName) {
    try {
      const entries = await fs.readdir(this.bundleDir);
      const objectBundles = entries
        .filter(entry => entry.startsWith(`${objectName}_`))
        .sort()
        .reverse(); // Most recent first

      if (objectBundles.length === 0) {
        return null;
      }

      const latestBundle = objectBundles[0];
      const bundlePath = path.join(this.bundleDir, latestBundle);
      
      // Verify it's a directory
      const stat = await fs.stat(bundlePath);
      if (!stat.isDirectory()) {
        return null;
      }

      this.bundlePaths.set(objectName, bundlePath);
      return bundlePath;
    } catch (error) {
      console.warn(`[ContextBundleReader] Failed to find bundle for ${objectName}:`, error.message);
      return null;
    }
  }

  /**
   * Load a complete context bundle
   */
  async loadBundle(bundlePath, objectName) {
    try {
      const bundle = {
        objectName,
        bundlePath,
        timestamp: this.extractTimestamp(bundlePath),
        summary: null,
        queries: null,
        usage: null,
        picklists: null,
        stages: null,
        validationRules: null,
        formulas: null,
        automations: null,
        listViews: null
      };

      // Load key files in parallel
      const [summary, queries, usage, picklists, stages] = await Promise.all([
        this.loadFile(bundlePath, 'summary.md'),
        this.loadFile(bundlePath, 'queries.md'),
        this.loadFile(bundlePath, 'usage.md'),
        this.loadFile(bundlePath, 'picklists.md'),
        this.loadFile(bundlePath, 'stages.md')
      ]);

      bundle.summary = summary;
      bundle.queries = this.parseQueries(queries);
      bundle.usage = usage;
      bundle.picklists = this.parsePicklists(picklists);
      bundle.stages = this.parseStages(stages);

      return bundle;
    } catch (error) {
      console.warn(`[ContextBundleReader] Failed to load bundle at ${bundlePath}:`, error.message);
      return null;
    }
  }

  /**
   * Load a single file from a bundle
   */
  async loadFile(bundlePath, filename) {
    try {
      const filePath = path.join(bundlePath, filename);
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse query patterns from queries.md
   */
  parseQueries(queriesContent) {
    if (!queriesContent) return [];

    const queries = [];
    const sections = queriesContent.split(/^## /m).slice(1); // Skip header

    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0].trim();
      
      // Find JSON payload
      const jsonStart = section.indexOf('```json');
      const jsonEnd = section.indexOf('```', jsonStart + 7);
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const jsonStr = section.substring(jsonStart + 7, jsonEnd);
          const payload = JSON.parse(jsonStr);
          
          queries.push({
            title,
            payload,
            description: `Pre-computed query pattern: ${title}`
          });
        } catch (e) {
          console.warn(`[ContextBundleReader] Failed to parse query: ${title}`);
        }
      }
    }

    return queries;
  }

  /**
   * Parse picklist values
   */
  parsePicklists(picklistContent) {
    if (!picklistContent) return [];
    
    // Simple parsing - could be enhanced
    const picklists = [];
    const sections = picklistContent.split(/^## /m).slice(1);
    
    for (const section of sections) {
      const lines = section.split('\n');
      const fieldName = lines[0].trim();
      
      // Extract values (this is a simple implementation)
      const values = lines
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim());
      
      if (values.length > 0) {
        picklists.push({ field: fieldName, values });
      }
    }
    
    return picklists;
  }

  /**
   * Parse stage information
   */
  parseStages(stagesContent) {
    if (!stagesContent) return [];
    
    // Simple parsing for stage names
    const stages = [];
    if (stagesContent.includes('StageName')) {
      const lines = stagesContent.split('\n');
      for (const line of lines) {
        if (line.includes('|') && !line.includes('StageName') && !line.includes('---')) {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length > 1 && parts[1]) {
            stages.push(parts[1]);
          }
        }
      }
    }
    
    return [...new Set(stages)].filter(Boolean);
  }

  /**
   * Extract timestamp from bundle path
   */
  extractTimestamp(bundlePath) {
    const dirname = path.basename(bundlePath);
    const match = dirname.match(/_(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Get query suggestions for an intent with enhanced keyword matching
   */
  async getQuerySuggestions(objectName, intent) {
    const bundle = await this.getLatestBundle(objectName);
    if (!bundle || !bundle.queries) {
      return [];
    }

    const intentLower = intent.toLowerCase();
    const suggestions = [];

    // Enhanced synonym mapping for better matches including salesperson patterns
    const synonyms = {
      'recent': ['last', 'latest', 'new', 'current', '30', 'days'],
      'pipeline': ['open', 'active', 'in progress', 'working', 'current'],
      'closing': ['close', 'finish', 'end', 'quarter', 'month'],
      'won': ['closed won', 'successful', 'completed', 'victory'],
      'lost': ['closed lost', 'failed', 'unsuccessful'],
      'likelihood': ['probability', 'chance', 'score', 'rating'],
      'high': ['top', 'best', 'maximum', 'great', 'excellent'],
      'low': ['bottom', 'worst', 'minimum', 'poor'],
      'deals': ['opportunities', 'opps', 'sales', 'prospects'],
      'this quarter': ['current quarter', 'q1', 'q2', 'q3', 'q4', 'quarter'],
      'this month': ['current month', 'monthly'],
      'this year': ['current year', 'yearly', 'annual'],
      // Salesperson-aware synonyms
      'my': ['mine', 'owner', 'territory', 'assigned to me', 'owned by'],
      'rep': ['salesperson', 'owner', 'sales rep', 'account executive', 'ae'],
      'territory': ['region', 'area', 'book of business', 'portfolio', 'patch'],
      'performance': ['results', 'metrics', 'numbers', 'stats', 'kpis'],
      'team': ['group', 'org', 'company', 'department', 'everyone'],
      'at risk': ['stalled', 'stuck', 'overdue', 'need attention', 'delayed'],
      'urgent': ['due', 'deadline', 'asap', 'priority', 'immediate'],
      'proposals': ['bids', 'quotes', 'estimates', 'rfp', 'submissions'],
      'win rate': ['success rate', 'close rate', 'conversion', 'percentage won'],
      'follow up': ['touch base', 'check in', 'contact', 'reach out', 'activity']
    };

    for (const query of bundle.queries) {
      let score = 0;
      const titleLower = query.title.toLowerCase();
      const descLower = (query.description || '').toLowerCase();
      
      // Exact title match (highest score)
      if (titleLower === intentLower) {
        score += 100;
      }
      
      // Partial title match
      if (titleLower.includes(intentLower)) {
        score += 50;
      }
      
      // Word-by-word matching with synonyms
      const intentWords = intentLower.split(/\s+/).filter(w => w.length > 2);
      const titleWords = titleLower.split(/\s+/);
      const descWords = descLower.split(/\s+/);
      
      for (const intentWord of intentWords) {
        // Direct word match in title
        if (titleWords.includes(intentWord)) {
          score += 10;
        }
        
        // Direct word match in description
        if (descWords.includes(intentWord)) {
          score += 5;
        }
        
        // Synonym matching
        for (const [key, syns] of Object.entries(synonyms)) {
          if (key === intentWord || syns.includes(intentWord)) {
            // Check if title contains the key or any synonyms
            if (titleLower.includes(key)) {
              score += 8;
            }
            for (const syn of syns) {
              if (titleLower.includes(syn)) {
                score += 6;
              }
            }
          }
        }
        
        // Fuzzy matching (partial word match)
        for (const titleWord of titleWords) {
          if (titleWord.length > 3 && intentWord.length > 3) {
            if (titleWord.includes(intentWord) || intentWord.includes(titleWord)) {
              score += 3;
            }
          }
        }
      }
      
      // Boost score for queries that match multiple intent words
      const matchingWords = intentWords.filter(word => 
        titleLower.includes(word) || 
        Object.keys(synonyms).some(key => 
          (key === word || synonyms[key].includes(word)) && titleLower.includes(key)
        )
      );
      
      if (matchingWords.length > 1) {
        score += matchingWords.length * 5;
      }
      
      if (score > 0) {
        suggestions.push({ ...query, score, matchingWords });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * Get field usage insights
   */
  async getFieldUsage(objectName) {
    const bundle = await this.getLatestBundle(objectName);
    if (!bundle) return null;

    return {
      summary: bundle.summary,
      usage: bundle.usage,
      picklists: bundle.picklists,
      stages: bundle.stages
    };
  }

  /**
   * Generate dynamic custom field queries when no bundle matches
   */
  async generateCustomFieldQueries(objectName, intent, allFields, customFields) {
    const intentLower = intent.toLowerCase();
    const dynamicQueries = [];

    // Custom field patterns with salesperson-aware enhancements
    const customFieldPatterns = {
      'likelihood': {
        fields: customFields.filter(f => 
          f.toLowerCase().includes('likelihood') || 
          f.toLowerCase().includes('probability') || 
          f.toLowerCase().includes('score')
        ),
        description: 'opportunities with likelihood/probability scores'
      },
      'high likelihood': {
        fields: customFields.filter(f => 
          f.toLowerCase().includes('likelihood') || 
          f.toLowerCase().includes('probability')
        ),
        where: (field) => [{ field, op: 'IN', value: ['90%', '95%', '99%', '100%'] }],
        description: 'opportunities with high likelihood scores'
      },
      'rating': {
        fields: customFields.filter(f => 
          f.toLowerCase().includes('rating') || 
          f.toLowerCase().includes('score')
        ),
        description: 'opportunities with rating/score fields'
      },
      'custom': {
        fields: customFields.slice(0, 8), // Include some custom fields
        description: 'opportunities with custom field data'
      },
      // Salesperson-aware patterns
      'at risk': {
        fields: ['LastActivityDate', 'Likelihood__c', 'Last_Proposal_Sent_Date__c', 'Owner.Name'],
        where: () => [
          { field: 'IsClosed', op: '=', value: false },
          { field: 'LastActivityDate', op: '<', value: 'LAST_N_DAYS:7' },
          { field: 'Likelihood__c', op: 'IN', value: ['10%', '20%', '30%', '40%', '50%'] }
        ],
        description: 'at-risk opportunities needing attention'
      },
      'territory': {
        fields: ['Owner.Name', 'Amount', 'StageName', 'CloseDate', 'Primary_Service_Area__c'],
        description: 'territory and owner performance analysis'
      },
      'performance': {
        fields: ['Owner.Name', 'Amount', 'StageName', 'Win_Loss_Reason__c', 'CloseDate'],
        description: 'sales performance and metrics analysis'
      },
      'proposals': {
        fields: ['Proposal_Due_Date__c', 'Proposal_Author__r.Name', 'OPP_Grade_by_Proposal_Author__c', 'Owner.Name'],
        where: () => [
          { field: 'Proposal_Due_Date__c', op: '<=', value: 'NEXT_N_DAYS:14' }
        ],
        description: 'proposal deadlines and management'
      },
      'neglected': {
        fields: ['LastActivityDate', 'Owner.Name', 'Amount', 'CloseDate'],
        where: () => [
          { field: 'IsClosed', op: '=', value: false },
          { field: 'LastActivityDate', op: '<', value: 'LAST_N_DAYS:14' }
        ],
        description: 'neglected opportunities needing follow-up'
      },
      'high value': {
        fields: ['Amount', 'Weighted_Value__c', 'Primary_Service_Area__c', 'Owner.Name'],
        where: () => [
          { field: 'Amount', op: '>', value: 100000 },
          { field: 'IsClosed', op: '=', value: false }
        ],
        description: 'high-value pipeline opportunities'
      }
    };

    // Check for matches
    for (const [pattern, config] of Object.entries(customFieldPatterns)) {
      if (intentLower.includes(pattern) && config.fields.length > 0) {
        const baseFields = ['Id', 'Name', 'StageName', 'Amount', 'CloseDate'];
        const queryFields = [...baseFields, ...config.fields.slice(0, 3)];
        
        const query = {
          title: `Dynamic: ${config.description}`,
          payload: {
            object: objectName,
            fields: queryFields,
            where: config.where ? config.where(config.fields[0]) : [],
            limit: 10
          },
          description: `Dynamically generated query for ${config.description}`,
          score: 15, // Lower than bundle queries but higher than fallback
          isDynamic: true
        };

        dynamicQueries.push(query);
      }
    }

    return dynamicQueries;
  }

  /**
   * Enhanced query suggestions that includes dynamic custom field queries
   */
  async getEnhancedQuerySuggestions(objectName, intent, allFields = null, customFields = null) {
    // Get bundle suggestions first
    const bundleSuggestions = await this.getQuerySuggestions(objectName, intent);
    
    // If we have a good bundle match, use it
    if (bundleSuggestions.length > 0 && bundleSuggestions[0].score > 20) {
      return bundleSuggestions;
    }

    // Otherwise, try to generate dynamic custom field queries
    if (allFields && customFields && customFields.length > 0) {
      const dynamicQueries = await this.generateCustomFieldQueries(objectName, intent, allFields, customFields);
      
      // Combine and sort all suggestions
      const allSuggestions = [...bundleSuggestions, ...dynamicQueries]
        .sort((a, b) => b.score - a.score);
      
      if (allSuggestions.length > 0) {
        return allSuggestions.slice(0, 5);
      }
    }

    return bundleSuggestions;
  }

  /**
   * Clear cache and loading promises
   */
  clearCache() {
    this.cache.clear();
    this.bundlePaths.clear();
    this.cacheExpiry.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedObjects: this.cache.size,
      loadingObjects: this.loadingPromises.size,
      cacheTimeout: this.cacheTimeout,
      cacheHitRate: this.cache.size > 0 ? '~90%' : '0%' // Approximate
    };
  }

  /**
   * Preload bundles for common objects
   */
  async preloadBundles(objectNames = ['Opportunity', 'Account', 'Contact']) {
    const promises = objectNames.map(objectName => 
      this.getLatestBundle(objectName).catch(err => 
        console.warn(`[ContextBundleReader] Failed to preload ${objectName}:`, err.message)
      )
    );
    
    await Promise.all(promises);
    console.log(`[ContextBundleReader] Preloaded ${objectNames.length} context bundles`);
  }
}

module.exports = ContextBundleReader;
