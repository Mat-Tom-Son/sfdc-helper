'use strict';

function extractObjectName(soql) {
  if (typeof soql !== 'string') return null;
  const m = /\bfrom\s+([a-zA-Z0-9_]+)/i.exec(soql);
  return m ? m[1] : null;
}

function extractSelectList(soql) {
  if (typeof soql !== 'string') return [];
  const m = /\bselect\s+([\s\S]*?)\s+from\b/i.exec(soql);
  if (!m) return [];
  const list = m[1];
  // Naive split on commas not inside parentheses
  const fields = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function normalizeFieldToken(token) {
  if (!token) return null;
  let t = String(token).trim();
  // Remove aliases: "field AS alias" or "field alias"
  t = t.replace(/\s+as\s+[^\s]+$/i, '').replace(/\s+[^\s]+$/, '');
  // Remove functions: e.g., COUNT(Id), FORMAT(DATEVALUE(CreatedDate)) → keep inner argument if present
  const inner = /\(([^()]*)\)/.exec(t);
  if (/^[a-zA-Z_]+\s*\(/.test(t) && inner) {
    t = inner[1].trim();
  }
  // Remove type casts or wrappers like toLabel()
  t = t.replace(/^toLabel\((.*)\)$/i, '$1');
  // Strip qualifiers like "TYPEOF" blocks (skip these)
  if (/^typeof\b/i.test(t)) return null;
  // Remove spaces
  t = t.replace(/\s+/g, '');
  if (!t) return null;
  return t;
}

function extractFields(soql) {
  const raw = extractSelectList(soql);
  const result = [];
  for (const token of raw) {
    const norm = normalizeFieldToken(token);
    if (!norm) continue;
    // Skip wildcard
    if (norm === '*') continue;
    // Handle dotted fields and base fields
    result.push(norm);
  }
  // De-duplicate
  return Array.from(new Set(result));
}

module.exports = {
  extractObjectName,
  extractFields,
};


