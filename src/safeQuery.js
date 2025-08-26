'use strict';

const { isObjectAllowed, filterAllowedFields, clampLimit, getDefaultFields, isOperatorAllowed } = require('./allowlist');

function escapeSoqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  // Escape single quotes by doubling them
  const s = String(value);
  return `'${s.replace(/'/g, "''")}'`;
}

function isIsoDateTimeLiteral(s) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z$/.test(s);
}

function isIsoDateLiteral(s) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

function isRelativeDateLiteral(s) {
  // Common SOQL date literals
  return /^(TODAY|YESTERDAY|TOMORROW|THIS_WEEK|LAST_WEEK|NEXT_WEEK|THIS_MONTH|LAST_MONTH|NEXT_MONTH|THIS_QUARTER|LAST_QUARTER|NEXT_QUARTER|THIS_YEAR|LAST_YEAR|NEXT_YEAR|LAST_N_DAYS:\d+|NEXT_N_DAYS:\d+|LAST_N_WEEKS:\d+|NEXT_N_WEEKS:\d+|LAST_N_MONTHS:\d+|NEXT_N_MONTHS:\d+|LAST_N_QUARTERS:\d+|NEXT_N_QUARTERS:\d+|LAST_N_YEARS:\d+|NEXT_N_YEARS:\d+)$/.test(s);
}

function formatSoqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const s = String(value);
  if (isIsoDateTimeLiteral(s) || isIsoDateLiteral(s) || isRelativeDateLiteral(s)) {
    return s; // unquoted date/datetime literals
  }
  return `'${s.replace(/'/g, "''")}'`;
}

function normalizeWhereArray(where) {
  if (Array.isArray(where)) return where;
  if (where && typeof where === 'object') {
    // Convert object map to array of equality clauses
    return Object.entries(where).map(([field, value]) => ({ field, op: '=', value }));
  }
  return [];
}

function buildWhere(object, where) {
  const items = normalizeWhereArray(where);
  const parts = [];
  for (const clause of items) {
    if (!clause || typeof clause !== 'object') continue;
    const field = String(clause.field || '').trim();
    if (!field) continue;
    const op = String((clause.op || '=')).toUpperCase();
    if (!isOperatorAllowed(object, field, op)) continue;
    const value = clause.value !== undefined ? clause.value : clause.values;
    if (value === undefined) continue;
    if ((op === 'IN' || op === 'NOT IN') && Array.isArray(value)) {
      const list = value.map(formatSoqlLiteral).join(', ');
      parts.push(`${field} ${op} (${list})`);
    } else if (op === 'LIKE' && typeof value === 'string') {
      parts.push(`${field} LIKE ${escapeSoqlLiteral(value)}`);
    } else {
      parts.push(`${field} ${op} ${formatSoqlLiteral(value)}`);
    }
  }
  if (!parts.length) return '';
  return ' WHERE ' + parts.join(' AND ');
}

function buildOrderBy(object, orderBy) {
  if (!orderBy) return '';
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const field = typeof item.field === 'string' ? item.field : null;
    if (!field) continue;
    // Only allow ordering by allowed fields
    const direction = String(item.direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    parts.push(`${field} ${direction}`);
  }
  if (!parts.length) return '';
  return ' ORDER BY ' + parts.join(', ');
}

function buildSafeSoql({ object, fields, filters, where, orderBy, limit }) {
  if (!isObjectAllowed(object)) {
    throw new Error(`Object not allowed: ${object}`);
  }
  let requestedFields = Array.isArray(fields) && fields.length ? fields : getDefaultFields(object);
  const allowedFields = filterAllowedFields(object, requestedFields);
  if (!allowedFields.length) {
    throw new Error('No allowed fields requested');
  }
  const finalLimit = clampLimit(limit);
  const whereSql = buildWhere(object, where || filters);
  const orderSql = buildOrderBy(object, orderBy);
  const selectList = allowedFields.join(', ');
  const soql = `SELECT ${selectList} FROM ${object}${whereSql}${orderSql} LIMIT ${finalLimit}`;
  return { soql, fieldsUsed: allowedFields };
}

module.exports = {
  buildSafeSoql,
  escapeSoqlLiteral,
};


