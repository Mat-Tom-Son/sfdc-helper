'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function copyIfExists(src, dest) {
  try {
    await ensureDir(path.dirname(dest));
    await fs.promises.copyFile(src, dest);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

async function writeFile(dest, content) {
  await ensureDir(path.dirname(dest));
  await fs.promises.writeFile(dest, content, 'utf8');
}

async function rimraf(target) {
  await fs.promises.rm(target, { recursive: true, force: true });
}

function runZip(cwd, zipName, folderName) {
  return new Promise((resolve, reject) => {
    execFile('zip', ['-r', zipName, folderName], { cwd }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`zip command failed: ${stderr || err.message}`));
      }
      resolve(stdout);
    });
  });
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const distDir = path.join(root, 'dist');
  const stagingDir = path.join(distDir, 'sfdc-helper-client');
  const zipPath = path.join(distDir, 'sfdc-helper-client.zip');

  // Reset staging
  await rimraf(stagingDir);
  await ensureDir(stagingDir);
  await ensureDir(distDir);

  // Copy minimal client-only artifacts
  const copied = [];
  const clientSrc = path.join(root, 'src', 'client.js');
  if (await copyIfExists(clientSrc, path.join(stagingDir, 'client.js'))) copied.push('client.js');
  const typesSrc = path.join(root, 'types', 'index.d.ts');
  if (await copyIfExists(typesSrc, path.join(stagingDir, 'index.d.ts'))) copied.push('index.d.ts');
  const licenseSrc = path.join(root, 'LICENSE');
  if (await copyIfExists(licenseSrc, path.join(stagingDir, 'LICENSE'))) copied.push('LICENSE');

  // README for vendoring
  const readme = `# SFDC Helper Client (Vendored)

An org-aware, dependency-free client for talking to an SFDC Helper server from your chatbot or app.

This vendored client is a single-file SDK that performs HTTP calls to your running SFDC Helper server. No additional npm packages are needed for runtime.

## What’s included

- client.js — the SDK (CommonJS)
- index.d.ts — optional TypeScript types for the SDK
- LICENSE — MIT

## Requirements

- Node.js 18+ recommended (uses global \`fetch\`).
- Node.js 14–16 supported via internal http/https fallback (no extra deps).
- A running SFDC Helper server (defaults to \`http://localhost:3000\`).

## Quick start

Place this folder in your project (e.g., \`vendor/sfdc-helper-client/\`) and use it like this:

~~~javascript
// path depends on where you place the folder
const SFDCHelperClient = require('./vendor/sfdc-helper-client/client');

async function main() {
  const client = new SFDCHelperClient('http://localhost:3000');

  // Health check
  const health = await client.health();
  console.log('Service:', health);

  // Get org info (identity + limits)
  const org = await client.getOrgInfo();
  console.log('Org:', org.identity.organization_id);
}

main().catch(console.error);
~~~

## Common chatbot tasks

### 1) Choose an object and run a safe query

Prefer safe queries for chat use-cases. They validate objects/fields/operators against an allowlist and can flatten relationship fields for simpler displays.

~~~javascript
const results = await client.safeQuery('Opportunity', {
  where: [
    { field: 'StageName', op: 'IN', value: ['Prospecting', 'Qualification'] },
    { field: 'CloseDate', op: '=', value: 'THIS_QUARTER' }
  ],
  limit: 5,
  flatten: true
});

console.log('Found', results.records.length, 'opportunities');
~~~

### 2) Build a natural-language query (intent → query)

~~~javascript
const smart = await client.executeSmartQuery('Opportunity', 'show me deals closing this quarter', {
  limit: 5
});

console.log('Intent:', smart.intent);
console.log('Suggestion used:', smart.suggestion?.title);
console.log('Records returned:', smart.results.records.length);
~~~

### 3) Use org-aware defaults and discovery

~~~javascript
// Allowlisted fields (dynamic + static)
const allowlist = await client.getAllowlist();
console.log(Object.keys(allowlist.objects || allowlist));

// Best-effort default fields for a given object
const defaults = await client.getDefaultFields('Account');
console.log('Default Account fields:', defaults);

// Describe & picklists (cached by the client)
const accountDesc = await client.describeObject('Account');
const accountPicklists = await client.getPicklists('Account');
~~~

### 4) Raw SOQL & pagination (use sparingly)

~~~javascript
// Raw SOQL (prefer safeQuery when possible)
const page1 = await client.query('SELECT Id, Name FROM Account ORDER BY CreatedDate DESC', { limit: 200 });
if (page1.next) {
  const page2 = await client.query(null, { next: page1.next });
  console.log('Next page size:', page2.records.length);
}
~~~

### 5) SOSL search across objects

~~~javascript
const search = await client.search("FIND {Acme*} IN ALL FIELDS RETURNING Account(Id,Name)");
console.log('Matches:', search.items.length);
~~~

## Framework snippets

### Express route (chat endpoint)

~~~javascript
const express = require('express');
const SFDCHelperClient = require('./vendor/sfdc-helper-client/client');

const app = express();
app.use(express.json());
const sfdc = new SFDCHelperClient(process.env.SFDC_HELPER_BASE || 'http://localhost:3000');

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    const result = await sfdc.executeSmartQuery('Opportunity', message, { limit: 5 });
    res.json({
      response: 'Found ' + result.results.records.length + ' opportunities',
      data: result.results.records.slice(0, 3),
      context: result.suggestion?.title || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
~~~

### Discord (outline)

~~~javascript
const SFDCHelperClient = require('./vendor/sfdc-helper-client/client');
const sfdc = new SFDCHelperClient();

// inside your message handler
const result = await sfdc.executeSmartQuery('Case', 'find open cases', { limit: 3 });
// reply with result.results.records
~~~

## TypeScript usage

~~~typescript
import SFDCHelperClient from './vendor/sfdc-helper-client/client';
import type { WhereCondition } from './vendor/sfdc-helper-client/index';

const client = new SFDCHelperClient('http://localhost:3000');

const where: WhereCondition[] = [
  { field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:7' }
];

const r = await client.safeQuery('Lead', { where, limit: 5 });
~~~

## Choosing the right endpoint

- Use \`safeQuery\` for most chatbot calls. It enforces object/field/operator allowlists and supports flattening.
- Use \`query\` (raw SOQL) sparingly when you must run a hand-written query. Prefer pagination with \`next\`.
- Use \`search\` (SOSL) for cross-object keyword searches.
- Use \`getObjectInsights\` to power intent mapping and offer smart suggestions.

## Error handling

The client enriches errors from the server with \`status\`, \`code\`, and optional \`suggestions\` fields when available. Retries are applied for transient network/server errors.

~~~javascript
try {
  await client.safeQuery('Opportunity', { limit: -1 }); // example invalid limit
} catch (err) {
  console.error('Status:', err.status);
  console.error('Message:', err.message);
  console.error('Suggestions:', err.suggestions);
}
~~~

## Updating the vendored client

- Re-build from the source repo and replace this folder, or
- If you kept the original repository around, run the pack script again and re-unzip the output.

## Notes & Security

- Read-only by design: the backing server exposes no create/update/delete endpoints.
- Org-aware: allowlists and default fields adapt to your org.
- For CSV/NDJSON export flows, use the server endpoint \`POST /objects/{name}/insights/run\` and stream the response.

## Troubleshooting

- Connection errors: ensure the SFDC Helper server is running and reachable (default \`http://localhost:3000\`).
- Auth/permissions: the server requires valid Salesforce credentials (via env vars/tokens on the server side).
- Node < 18: the client falls back to built-in http/https; no polyfills needed.

---

MIT Licensed.
`;
  await writeFile(path.join(stagingDir, 'README.md'), readme);

  // COOKBOOK with prompts and examples
  const cookbook = `# SFDC Helper Client Cookbook

Practical prompts and code patterns for exploring a Salesforce org and retrieving data effectively.

The examples assume you have placed this folder at vendor/sfdc-helper-client/ and that your SFDC Helper server runs on http://localhost:3000.

## Setup

~~~javascript
const SFDCHelperClient = require('./vendor/sfdc-helper-client/client');
const client = new SFDCHelperClient(process.env.SFDC_HELPER_BASE || 'http://localhost:3000');
~~~

## Prompt patterns (for users of your chatbot)

- Find recent opportunities: show me opportunities created in the last 30 days
- Pipeline focus: list open opportunities in the proposal or negotiation stages
- Quarter planning: deals closing this quarter over amount 10000
- Stalled deals: opportunities with no activity in the last 30 days
- Owner view: accounts owned by Jane Doe created this month
- Support triage: open high priority cases past due
- SLA breaches: cases with status not closed and created date more than 7 days ago
- Data quality: top picklist values used for lead source on leads
- Change feed: what changed in accounts since YYYY-MM-DDTHH:MM:SSZ
- Recent items: show my recently viewed cases
- List view: reproduce the default list view for opportunities
- Reports: describe and run report <report name or id>

## Safe queries (preferred)

### Open pipeline by stage
~~~javascript
const r = await client.safeQuery('Opportunity', {
  where: [
    { field: 'StageName', op: 'IN', value: ['Prospecting', 'Qualification', 'Proposal/Price Quote', 'Negotiation/Review'] },
    { field: 'IsClosed', op: '=', value: false }
  ],
  limit: 20,
  flatten: true
});
~~~

### Closing this quarter over a threshold
~~~javascript
const r = await client.safeQuery('Opportunity', {
  where: [
    { field: 'CloseDate', op: '=', value: 'THIS_QUARTER' },
    { field: 'Amount', op: '>=', value: 10000 }
  ],
  orderBy: { field: 'Amount', direction: 'DESC' },
  limit: 10,
  flatten: true
});
~~~

### Recently created accounts by owner
~~~javascript
const r = await client.safeQuery('Account', {
  where: [
    { field: 'CreatedDate', op: '=', value: 'THIS_MONTH' },
    // Owner.Id values can be obtained via a prior user search
  ],
  limit: 10,
  flatten: true
});
~~~

### Open high-priority cases past due
~~~javascript
const r = await client.safeQuery('Case', {
  where: [
    { field: 'Status', op: 'NOT IN', value: ['Closed', 'Resolved'] },
    { field: 'Priority', op: 'IN', value: ['High', 'Urgent'] }
  ],
  limit: 20,
  flatten: true
});
~~~

## Intent-powered queries

Use the org's insights to map natural language to smart filters.

~~~javascript
const smart = await client.executeSmartQuery('Opportunity', 'show me recent deals likely to close', { limit: 5 });
// smart.query contains the allowlisted query; smart.results.records has the data
~~~

## Discovery helpers

### Allowlist, defaults, describe, picklists
~~~javascript
const allowlist = await client.getAllowlist();
const defaults = await client.getDefaultFields('Opportunity');
const desc = await client.describeObject('Opportunity');
const picklists = await client.getPicklists('Opportunity');
~~~

### Recent items and changes since timestamp
~~~javascript
const recent = await client.getRecentRecords('Account', 5);
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const changes = await client.getChanges('Account', since, 20);
~~~

## Reproducing common list views

### Recently viewed opportunities (approximation)
~~~javascript
const r = await client.safeQuery('Opportunity', {
  orderBy: { field: 'CreatedDate', direction: 'DESC' },
  limit: 20,
  flatten: true
});
~~~

### My open cases (outline; supply Owner.Id from identity if needed)
~~~javascript
const r = await client.safeQuery('Case', {
  where: [
    { field: 'Status', op: 'NOT IN', value: ['Closed', 'Resolved'] }
  ],
  limit: 20,
  flatten: true
});
~~~

## Cross-object flows

### Accounts and their recent opportunities (two-step join in chat UX)
~~~javascript
const accounts = await client.safeQuery('Account', { limit: 5, flatten: true });
// then for each account, fetch recent opportunities
// const opps = await client.safeQuery('Opportunity', { where: [{ field: 'Account.Id', op: 'IN', value: [list of ids] }], limit: 50 });
~~~

## Reports

Describe or run reports available in the org.

~~~javascript
// Top reports
// GET /reports/top is available via server; use fetch or extend client if needed.

// Describe a report structure and filters
// Use server endpoint GET /reports/{id}/describe
~~~

## SOSL search

~~~javascript
const s = await client.search('FIND {Acme*} IN ALL FIELDS RETURNING Account(Id,Name)');
~~~

## Troubleshooting tips

- If a field filter is ignored, it may not be allowlisted for that object or operator. Prefer fields in defaults or allowlist.
- If results are missing relationship fields, enable flatten: true to denormalize Owner.Name, Account.Name, and similar into top-level keys.
- Prefer safeQuery for chat; fall back to raw SOQL only when necessary and control input carefully.

`;
  await writeFile(path.join(stagingDir, 'COOKBOOK.md'), cookbook);

  // Create zip
  await rimraf(zipPath);
  try {
    await runZip(distDir, path.basename(zipPath), path.basename(stagingDir));
  } catch (err) {
    throw new Error(`Failed to create zip. Ensure 'zip' CLI is installed.\n${err.message}`);
  }

  // Report
  console.log(`[pack-client] Created ${zipPath}`);
  console.log(`[pack-client] Included: ${copied.join(', ')}`);
}

main().catch((err) => {
  console.error('[pack-client] Error:', err.message);
  process.exitCode = 1;
});


