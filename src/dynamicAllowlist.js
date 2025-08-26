'use strict';

const fs = require('fs').promises;
const path = require('path');

// Cache for discovered fields from context bundles
const discoveredFields = new Map(); // objectName -> Set of fields
const discoveredOperators = new Map(); // objectName -> Map(field -> Set of operators)

/**
 * Analyze context bundles to discover actually used fields and operators
 */
async function analyzeContextBundles(baseDir = 'context_bundles') {
  try {
    const bundleDirs = await fs.readdir(baseDir);
    
    for (const bundleDir of bundleDirs) {
      const bundlePath = path.join(baseDir, bundleDir);
      const stat = await fs.stat(bundlePath);
      if (!stat.isDirectory()) continue;
      
      // Extract object name from bundle directory (e.g., "Opportunity_2025-08-26T22-22-05-990Z")
      const objectName = bundleDir.split('_')[0];
      if (!objectName) continue;
      
      await analyzeBundle(bundlePath, objectName);
    }
  } catch (err) {
    console.warn('[dynamicAllowlist] Failed to analyze context bundles:', err.message);
  }
}

/**
 * Analyze a single context bundle to extract field usage
 */
async function analyzeBundle(bundlePath, objectName) {
  const fieldsSet = discoveredFields.get(objectName) || new Set();
  const operatorsMap = discoveredOperators.get(objectName) || new Map();
  
  try {
    // Analyze list views for field usage
    const listViewsPath = path.join(bundlePath, 'list_views.md');
    try {
      const listViewsContent = await fs.readFile(listViewsPath, 'utf8');
      extractFieldsFromListViews(listViewsContent, fieldsSet, operatorsMap);
    } catch (_) {}
    
    // Analyze queries for field usage and operators
    const queriesPath = path.join(bundlePath, 'queries.md');
    try {
      const queriesContent = await fs.readFile(queriesPath, 'utf8');
      extractFieldsFromQueries(queriesContent, fieldsSet, operatorsMap);
    } catch (_) {}
    
    // Analyze usage data for populated fields
    const usagePath = path.join(bundlePath, 'usage.md');
    try {
      const usageContent = await fs.readFile(usagePath, 'utf8');
      extractFieldsFromUsage(usageContent, fieldsSet);
    } catch (_) {}
    
    // Store discovered fields and operators
    discoveredFields.set(objectName, fieldsSet);
    discoveredOperators.set(objectName, operatorsMap);
    
    console.log(`[dynamicAllowlist] Discovered ${fieldsSet.size} fields for ${objectName}`);
  } catch (err) {
    console.warn(`[dynamicAllowlist] Failed to analyze bundle for ${objectName}:`, err.message);
  }
}

/**
 * Extract fields from list views markdown
 */
function extractFieldsFromListViews(content, fieldsSet, operatorsMap) {
  // Parse list view queries and columns
  const queryMatches = content.match(/query: SELECT ([^FROM]+) FROM/gi);
  const columnMatches = content.match(/columns: ([^\n]+)/gi);
  
  if (queryMatches) {
    for (const match of queryMatches) {
      const selectClause = match.replace(/query: SELECT\s+/i, '').replace(/\s+FROM$/i, '');
      const fields = selectClause.split(',').map(f => f.trim().replace(/^toLabel\(/, '').replace(/\)$/, '').replace(/^convertCurrency\(/, '').replace(/\)$/, ''));
      fields.forEach(field => {
        if (field && !field.includes('(') && !field.includes('*')) {
          fieldsSet.add(field);
        }
      });
    }
  }
  
  if (columnMatches) {
    for (const match of columnMatches) {
      const columnsStr = match.replace(/columns:\s+/i, '');
      const columns = columnsStr.split(',').map(c => c.trim());
      columns.forEach(col => {
        if (col && !col.includes('(')) {
          fieldsSet.add(col);
        }
      });
    }
  }
  
  // Extract WHERE conditions to infer operators
  const whereMatches = content.match(/WHERE[^ORDER]+/gi);
  if (whereMatches) {
    for (const whereClause of whereMatches) {
      extractOperatorsFromWhere(whereClause, operatorsMap);
    }
  }
}

/**
 * Extract fields and operators from queries markdown
 */
function extractFieldsFromQueries(content, fieldsSet, operatorsMap) {
  // Look for JSON payloads in the queries
  const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
  if (jsonMatches) {
    for (const jsonMatch of jsonMatches) {
      try {
        const jsonStr = jsonMatch.replace(/```json\n/, '').replace(/\n```$/, '');
        const payload = JSON.parse(jsonStr);
        
        // Extract fields
        if (Array.isArray(payload.fields)) {
          payload.fields.forEach(field => fieldsSet.add(field));
        }
        
        // Extract operators from where clauses
        if (Array.isArray(payload.where)) {
          payload.where.forEach(condition => {
            if (condition.field && condition.op) {
              const fieldOps = operatorsMap.get(condition.field) || new Set();
              fieldOps.add(condition.op.toUpperCase());
              operatorsMap.set(condition.field, fieldOps);
            }
          });
        }
      } catch (_) {}
    }
  }
}

/**
 * Extract fields from usage analysis
 */
function extractFieldsFromUsage(content, fieldsSet) {
  // Look for field names in usage analysis (this would need to be adapted based on your usage format)
  const fieldMatches = content.match(/^\s*-\s+([A-Za-z_][A-Za-z0-9_.]*)/gm);
  if (fieldMatches) {
    fieldMatches.forEach(match => {
      const field = match.replace(/^\s*-\s+/, '').trim();
      if (field && !field.includes(' ')) {
        fieldsSet.add(field);
      }
    });
  }
}

/**
 * Extract operators from WHERE clauses
 */
function extractOperatorsFromWhere(whereClause, operatorsMap) {
  // Common operator patterns
  const operatorPatterns = [
    { pattern: /(\w+(?:\.\w+)*)\s*=\s*/, op: '=' },
    { pattern: /(\w+(?:\.\w+)*)\s*!=\s*/, op: '!=' },
    { pattern: /(\w+(?:\.\w+)*)\s*LIKE\s+/, op: 'LIKE' },
    { pattern: /(\w+(?:\.\w+)*)\s*IN\s*\(/, op: 'IN' },
    { pattern: /(\w+(?:\.\w+)*)\s*NOT\s+IN\s*\(/, op: 'NOT IN' },
    { pattern: /(\w+(?:\.\w+)*)\s*>\s*/, op: '>' },
    { pattern: /(\w+(?:\.\w+)*)\s*>=\s*/, op: '>=' },
    { pattern: /(\w+(?:\.\w+)*)\s*<\s*/, op: '<' },
    { pattern: /(\w+(?:\.\w+)*)\s*<=\s*/, op: '<=' },
  ];
  
  operatorPatterns.forEach(({ pattern, op }) => {
    const matches = whereClause.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      matches.forEach(match => {
        const fieldMatch = match.match(pattern);
        if (fieldMatch && fieldMatch[1]) {
          const field = fieldMatch[1];
          const fieldOps = operatorsMap.get(field) || new Set();
          fieldOps.add(op);
          operatorsMap.set(field, fieldOps);
        }
      });
    }
  });
}

/**
 * Get dynamic allowlist for an object, combining static + discovered fields
 */
function getDynamicAllowedFields(objectName, staticFields = []) {
  const discoveredFieldsSet = discoveredFields.get(objectName) || new Set();
  
  // Combine static and discovered fields, removing duplicates
  return Array.from(new Set([...staticFields, ...discoveredFieldsSet]));
}

/**
 * Get dynamic operators for a field, combining static + discovered operators
 */
function getDynamicAllowedOperators(objectName, field, staticOps = ['=']) {
  const discoveredOpsMap = discoveredOperators.get(objectName) || new Map();
  const discoveredOps = Array.from(discoveredOpsMap.get(field) || new Set());
  
  // Combine static and discovered operators, removing duplicates
  return Array.from(new Set([...staticOps, ...discoveredOps]));
}

/**
 * Check if an object is allowed (discovered fields available)
 */
function isDynamicObjectAllowed(objectName) {
  return discoveredFields.has(objectName);
}

/**
 * Get discovered field statistics
 */
function getDiscoveryStats(staticObjectsMap = {}) {
  const stats = {};
  for (const [objectName, fieldsSet] of discoveredFields) {
    const staticCount = staticObjectsMap[objectName]?.fields?.length || 0;
    const staticFieldsSet = new Set(staticObjectsMap[objectName]?.fields || []);
    const totalFields = new Set([...staticFieldsSet, ...fieldsSet]).size;
    stats[objectName] = {
      staticFields: staticCount,
      discoveredFields: fieldsSet.size,
      totalFields
    };
  }
  return stats;
}

/**
 * Initialize by analyzing existing context bundles
 */
async function initialize(baseDir) {
  console.log('[dynamicAllowlist] Initializing dynamic allowlist...');
  await analyzeContextBundles(baseDir);
  const stats = getDiscoveryStats({});
  console.log('[dynamicAllowlist] Discovery stats:', stats);
}

module.exports = {
  initialize,
  analyzeContextBundles,
  getDynamicAllowedFields,
  getDynamicAllowedOperators,
  isDynamicObjectAllowed,
  getDiscoveryStats,
};
