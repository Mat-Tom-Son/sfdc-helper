'use strict';

function flattenRecord(record) {
  const out = {};
  // Copy top-level primitives
  for (const [k, v] of Object.entries(record)) {
    if (k === 'attributes') continue;
    if (v === null || typeof v !== 'object') {
      out[k] = v;
    }
  }
  // Flatten 1-level nested relationship objects (Owner, Account, etc.)
  for (const [k, v] of Object.entries(record)) {
    if (k === 'attributes') continue;
    if (v && typeof v === 'object' && 'attributes' in v) {
      for (const [k2, v2] of Object.entries(v)) {
        if (k2 === 'attributes') continue;
        const flatKey = `${k.toLowerCase()}_${k2}`;
        out[flatKey] = v2;
      }
    }
  }
  return out;
}

function flattenRecords(records) {
  return (records || []).map(flattenRecord);
}

module.exports = {
  flattenRecord,
  flattenRecords,
};


