'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ANALYTICS_FILE_PATH = path.resolve(__dirname, '..', 'analytics.json');

async function readJson(filePath) {
  try {
    const txt = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    if (err && err.code === 'ENOENT') return { queries: [] };
    try {
      return { queries: [] };
    } catch (_) {
      return { queries: [] };
    }
  }
}

async function writeJson(filePath, obj) {
  const txt = JSON.stringify(obj, null, 2);
  await fsp.writeFile(filePath, txt, 'utf8');
}

async function recordQueryEvent(event) {
  const nowIso = new Date().toISOString();
  const payload = Object.assign({ ts: nowIso }, event);
  const data = await readJson(ANALYTICS_FILE_PATH);
  data.queries.push(payload);
  // Cap file size to last 5k entries to keep it reasonable
  if (data.queries.length > 5000) {
    data.queries = data.queries.slice(data.queries.length - 5000);
  }
  await writeJson(ANALYTICS_FILE_PATH, data);
}

async function getRecentQueries(limit = 50) {
  const data = await readJson(ANALYTICS_FILE_PATH);
  const arr = data.queries || [];
  return arr.slice(Math.max(0, arr.length - limit)).reverse();
}

async function getTopFields({ objectName, top = 20 }) {
  const data = await readJson(ANALYTICS_FILE_PATH);
  const counts = new Map();
  for (const q of data.queries || []) {
    if (objectName && q.objectName !== objectName) continue;
    const fields = Array.isArray(q.fields) ? q.fields : [];
    for (const f of fields) {
      counts.set(f, (counts.get(f) || 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, top).map(([field, count]) => ({ field, count }));
}

module.exports = {
  recordQueryEvent,
  getRecentQueries,
  getTopFields,
  ANALYTICS_FILE_PATH,
};


