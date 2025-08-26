'use strict';

function toNdjson(records) {
  const lines = [];
  for (const r of records || []) {
    lines.push(JSON.stringify(r));
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

function toCsv(records) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) return '';
  const headerSet = new Set();
  for (const r of rows) {
    for (const k of Object.keys(r)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [];
  lines.push(headers.join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { toNdjson, toCsv };


