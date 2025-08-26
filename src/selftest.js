'use strict';

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { setTimeout: delay } = require('timers/promises');
const { request } = require('undici');

const REPORT_PATH = path.resolve(__dirname, '..', 'selftest-report.json');

async function fetchJson(url, options = {}) {
  const res = await request(url, options);
  const body = await res.body.text();
  let json = null;
  try { json = JSON.parse(body); } catch (_) {}
  return { status: res.statusCode, json, raw: body };
}

async function run() {
  const port = process.env.SELFTEST_PORT ? Number(process.env.SELFTEST_PORT) : 3100;
  const env = Object.assign({}, process.env, { PORT: String(port) });

  const server = spawn(process.execPath, [path.resolve(__dirname, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  let serverOutput = '';
  server.stdout.on('data', (d) => { serverOutput += d.toString(); });
  server.stderr.on('data', (d) => { serverOutput += d.toString(); });

  const base = `http://localhost:${port}`;
  const report = { port, started: new Date().toISOString(), checks: [] };

  try {
    // Wait for server to start
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await fetchJson(`${base}/health`);
        if (r.status === 200) { ready = true; break; }
      } catch (_) {}
      await delay(250);
    }
    report.checks.push({ name: 'server_ready', ok: ready, details: ready ? undefined : serverOutput });
    if (!ready) throw new Error('Server did not become ready');

    // Identity
    const me = await fetchJson(`${base}/me`);
    report.checks.push({ name: 'me', ok: me.status === 200, data: me.json });

    // Simple Account query
    const q1 = await fetchJson(`${base}/query?soql=${encodeURIComponent('SELECT Id, Name FROM Account ORDER BY CreatedDate DESC')}&limit=5`);
    report.checks.push({ name: 'query_accounts', ok: q1.status === 200 && q1.json && Array.isArray(q1.json.records), count: q1.json && q1.json.records && q1.json.records.length });

    // Safe query with flatten
    const sqBody = {
      object: 'Account',
      fields: ['Id', 'Name', 'Owner.Name', 'CreatedDate'],
      filters: { Name: { op: 'LIKE', value: '%a%' } },
      orderBy: { field: 'CreatedDate', direction: 'DESC' },
      limit: 5,
      flatten: true,
    };
    const sq = await fetchJson(`${base}/safe-query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sqBody) });
    report.checks.push({ name: 'safe_query', ok: sq.status === 200 && sq.json && Array.isArray(sq.json.records), count: sq.json && sq.json.records && sq.json.records.length });

    // Recent records
    const recent = await fetchJson(`${base}/sobjects/Account/recent-records?limit=5`);
    report.checks.push({ name: 'recent_accounts', ok: recent.status === 200 && recent.json && Array.isArray(recent.json.records), count: recent.json && recent.json.records && recent.json.records.length });

    // Top fields analytics
    const top = await fetchJson(`${base}/analytics/top-fields?object=Account&top=5`);
    report.checks.push({ name: 'analytics_top_fields', ok: top.status === 200 && top.json && Array.isArray(top.json.items), items: top.json && top.json.items });

    // Picklists
    const picks = await fetchJson(`${base}/sobjects/Account/picklists`);
    report.checks.push({ name: 'picklists_account', ok: picks.status === 200 && picks.json && Array.isArray(picks.json.picklists) });

    // Allowlist
    const al = await fetchJson(`${base}/allowlist`);
    report.checks.push({ name: 'allowlist', ok: al.status === 200 && al.json && al.json.objects && al.json.objects.Account });

    // Changes since yesterday (likely some records)
    const sinceIso = new Date(Date.now() - 24*60*60*1000).toISOString();
    const ch = await fetchJson(`${base}/changes/Account?since=${encodeURIComponent(sinceIso)}&limit=5`);
    report.checks.push({ name: 'changes_account', ok: ch.status === 200 && ch.json && Array.isArray(ch.json.records), status: ch.status, error: ch.json && ch.json.error });

    // Manifest and OpenAPI
    const man = await fetchJson(`${base}/manifest`);
    const oapi = await fetchJson(`${base}/openapi.json`);
    const tools = await fetchJson(`${base}/tools.json`);
    report.checks.push({ name: 'manifest', ok: man.status === 200 && man.json && man.json.api && man.json.endpoints });
    report.checks.push({ name: 'openapi', ok: oapi.status === 200 && oapi.json && oapi.json.openapi === '3.0.0' });
    report.checks.push({ name: 'tools', ok: tools.status === 200 && tools.json && Array.isArray(tools.json.tools) && tools.json.tools.length > 0 });

    // Insights for Opportunity
    const ins = await fetchJson(`${base}/objects/Opportunity/insights`);
    report.checks.push({ name: 'insights_opportunity', ok: ins.status === 200 && ins.json && ins.json.summary && ins.json.sample });

    // insights.run as JSON
    if (ins.json && Array.isArray(ins.json.suggestions) && ins.json.suggestions.length) {
      const runBody = { suggestion: ins.json.suggestions[0], fields: ins.json.sample && ins.json.sample.fields };
      const run = await fetchJson(`${base}/objects/Opportunity/insights/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(runBody) });
      report.checks.push({ name: 'insights_run_json', ok: run.status === 200 && run.json && Array.isArray(run.json.records), status: run.status, error: run.json && run.json.error, raw: run.raw && run.raw.slice(0,200) });
    }

    // Context markdown (no persist)
    const ctx = await request(`${base}/objects/Opportunity/context`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ persist: false }) });
    const ctxBody = await ctx.body.text();
    report.checks.push({ name: 'context_markdown', ok: ctx.statusCode === 200 && /^#\s*Opportunity/m.test(ctxBody) });

  } catch (err) {
    report.error = err && err.message ? err.message : String(err);
  } finally {
    report.finished = new Date().toISOString();
    try { await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8'); } catch (_) {}
    server.kill();
  }

  console.log(`[selftest] Report written to ${REPORT_PATH}`);
}

run().catch((e) => {
  console.error('[selftest] Fatal:', e && e.message ? e.message : e);
  process.exit(1);
});


