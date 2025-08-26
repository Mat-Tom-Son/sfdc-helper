'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { getConnection } = require('./sfConnection');
const { extractObjectName, extractFields } = require('./soqlUtils');
const analytics = require('./analytics');
const { buildSafeSoql, escapeSoqlLiteral } = require('./safeQuery');
const { flattenRecords } = require('./flatten');
const { OBJECTS, getAllowedFields, getDefaultFields } = require('./allowlist');
const { manifest, openapi } = require('./manifest');
const { toolsSchema } = require('./tools');
const { generateObjectInsights } = require('./insights');
const { toNdjson, toCsv } = require('./format');
const { renderInsightsMarkdown, renderInsightsSegments } = require('./contextRenderer');
const { errorHandlerMiddleware, asyncHandler, enhanceError } = require('./errorHandler');
const fs = require('fs');
const path = require('path');

// Initialize dynamic allowlist
let dynamicAllowlist = null;
try {
  dynamicAllowlist = require('./dynamicAllowlist');
} catch (_) {
  console.log('[server] Dynamic allowlist not available, using static only');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize dynamic allowlist on startup
async function initializeDynamicAllowlist() {
  if (dynamicAllowlist) {
    try {
      const contextBundlesDir = path.resolve(process.cwd(), 'context_bundles');
      await dynamicAllowlist.initialize(contextBundlesDir);
      console.log('[server] Dynamic allowlist initialized');
    } catch (err) {
      console.warn('[server] Failed to initialize dynamic allowlist:', err.message);
    }
  }
}

// Initialize on startup
initializeDynamicAllowlist();

function getEnv(name, defaultValue) {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : defaultValue;
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Dynamic allowlist stats and refresh
app.get('/allowlist/stats', async (_req, res) => {
  if (!dynamicAllowlist) {
    return res.json({ 
      dynamic: false, 
      message: 'Dynamic allowlist not available, using static allowlist only' 
    });
  }
  
  try {
    const stats = dynamicAllowlist.getDiscoveryStats(OBJECTS);
    res.json({ dynamic: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/allowlist/refresh', async (_req, res) => {
  if (!dynamicAllowlist) {
    return res.status(400).json({ 
      error: 'Dynamic allowlist not available' 
    });
  }
  
  try {
    const contextBundlesDir = path.resolve(process.cwd(), 'context_bundles');
    await dynamicAllowlist.analyzeContextBundles(contextBundlesDir);
    const stats = dynamicAllowlist.getDiscoveryStats(OBJECTS);
    res.json({ 
      message: 'Dynamic allowlist refreshed', 
      stats 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /query?soql=...&limit=200&next=nextUrl
// - If next is provided, it will be used with conn.queryMore for pagination
app.get('/query', asyncHandler(async (req, res) => {
  const soql = req.query.soql;
  const limit = parsePositiveInt(req.query.limit, undefined);
  const nextUrl = req.query.next;

  if (!soql && !nextUrl) {
    return res.status(400).json({ error: 'Provide soql or next parameter.' });
  }

  try {
    const conn = await getConnection();
    let result;

    if (nextUrl) {
      result = await conn.queryMore(nextUrl);
    } else {
      if (limit && /\blimit\b/i.test(soql) === false) {
        // If client asked for limit and query has none, append it
        const soqlWithLimit = `${soql.trim()} LIMIT ${limit}`;
        result = await conn.query(soqlWithLimit);
      } else {
        result = await conn.query(soql);
      }
    }

    try {
      const objectName = extractObjectName(soql || '');
      const fields = extractFields(soql || '');
      await analytics.recordQueryEvent({ kind: 'soql', objectName, fields, soql: soql || null, resultCount: (result.records || []).length });
    } catch (_) {}

    res.json({
      totalSize: result.totalSize,
      done: result.done,
      next: result.nextRecordsUrl || null,
      records: result.records,
    });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// POST /query - JSON body { soql: string, limit?: number }
app.post('/query', async (req, res) => {
  const soql = req.body && req.body.soql;
  const limit = parsePositiveInt(req.body && req.body.limit, undefined);

  if (!soql) return res.status(400).json({ error: 'Missing body.soql' });

  try {
    const conn = await getConnection();
    const finalSoql = limit && /\blimit\b/i.test(soql) === false ? `${soql.trim()} LIMIT ${limit}` : soql;
    const result = await conn.query(finalSoql);
    try {
      const objectName = extractObjectName(finalSoql || '');
      const fields = extractFields(finalSoql || '');
      await analytics.recordQueryEvent({ kind: 'soql', objectName, fields, soql: finalSoql, resultCount: (result.records || []).length });
    } catch (_) {}
    res.json({
      totalSize: result.totalSize,
      done: result.done,
      next: result.nextRecordsUrl || null,
      records: result.records,
    });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Reports: Top recent reports (by LastRunDate)
app.get('/reports/top', async (req, res) => {
  const limit = parsePositiveInt(req.query.limit, 10);
  try {
    const conn = await getConnection();
    const r = await conn.query(`SELECT Id, Name, DeveloperName, LastRunDate, Format FROM Report WHERE Format != null ORDER BY LastRunDate DESC NULLS LAST LIMIT ${limit}`);
    res.json({ totalSize: r.totalSize, records: r.records });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Report describe
app.get('/reports/:id/describe', async (req, res) => {
  const id = req.params.id;
  try {
    const conn = await getConnection();
    const resp = await conn.request(`/services/data/v${conn.version}/analytics/reports/${id}/describe`);
    res.json(resp);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Report run
// GET /reports/:id/run?format=json|csv&includeDetails=true|false
app.get('/reports/:id/run', async (req, res) => {
  const id = req.params.id;
  const format = (req.query.format || 'json').toString().toLowerCase();
  const includeDetails = String(req.query.includeDetails || 'false').toLowerCase() === 'true';
  try {
    const conn = await getConnection();
    const url = `/services/data/v${conn.version}/analytics/reports/${id}${includeDetails ? '?includeDetails=true' : ''}`;
    if (format === 'csv') {
      const csv = await conn.request({ url, method: 'GET', headers: { Accept: 'text/csv' } });
      res.type('text/csv').send(csv);
    } else {
      const json = await conn.request(url);
      res.json(json);
    }
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Validation rules (read-only via Tooling API)
// GET /sobjects/:name/validation-rules
// Returns active validation rules with key details, including error messages and target field if present
app.get('/sobjects/:name/validation-rules', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    const soql = `SELECT Id, ValidationName, Active, Description, ErrorMessage, ErrorDisplayField, EntityDefinition.DeveloperName FROM ValidationRule WHERE EntityDefinition.DeveloperName = '${name}' ORDER BY ValidationName`;
    const r = await conn.tooling.query(soql);
    const rules = (r.records || []).map(v => ({
      id: v.Id,
      name: v.ValidationName,
      active: v.Active,
      description: v.Description || null,
      errorMessage: v.ErrorMessage || null,
      errorDisplayField: v.ErrorDisplayField || null,
      object: (v.EntityDefinition && v.EntityDefinition.DeveloperName) || name
    }));
    res.json({ object: name, count: rules.length, rules });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Formula fields and rollups (read-only)
// GET /sobjects/:name/formulas
app.get('/sobjects/:name/formulas', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    const desc = await conn.sobject(name).describe();
    const items = [];
    for (const f of desc.fields || []) {
      if (f.calculated || f.type === 'summary') {
        items.push({
          name: f.name,
          label: f.label,
          type: f.type,
          calculated: !!f.calculated,
          formula: f.calculated ? (f.calculatedFormula || null) : null,
          inlineHelpText: f.inlineHelpText || null
        });
      }
    }

    // Best-effort Tooling enrichment for custom fields (optional)
    try {
      const q = await conn.tooling.query(`SELECT Id, DeveloperName, TableEnumOrId, DataType, InlineHelpText, Description, Metadata FROM CustomField WHERE TableEnumOrId='${name}'`);
      for (const cf of q.records || []) {
        try {
          const meta = cf.Metadata || {};
          if (meta && (meta.formula || meta.summaryOperation)) {
            const fullName = (meta.fullName || cf.DeveloperName) + '__c';
            const existing = items.find(it => it.name === fullName);
            const entry = existing || { name: fullName, label: (meta.label || cf.DeveloperName), type: (cf.DataType || 'string'), calculated: true, formula: null, inlineHelpText: cf.InlineHelpText || null };
            if (meta.formula) entry.formula = meta.formula;
            if (!existing) items.push(entry);
          }
        } catch (_) {}
      }
    } catch (_) {}

    res.json({ object: name, count: items.length, formulas: items });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Automations (read-only): Flows and Apex triggers targeting the object
// GET /sobjects/:name/automations
app.get('/sobjects/:name/automations', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    // Record-triggered / autolaunched flows referencing this object
    let flows = [];
    try {
      const fq = await conn.tooling.query("SELECT Id, MasterLabel, ApiVersion, Status, ProcessType, TriggerType, TriggerObject, TriggerOrder FROM Flow WHERE Status = 'Active'");
      flows = (fq.records || []).map(f => ({
        id: f.Id,
        label: f.MasterLabel,
        status: f.Status,
        processType: f.ProcessType,
        triggerType: f.TriggerType || null,
        triggerObject: f.TriggerObject || null,
        triggerOrder: f.TriggerOrder || null,
        related: f.TriggerObject ? (f.TriggerObject === name) : null,
      }));
      // If we got nothing, attempt FlowDefinitionView as a fallback
      if (!flows.length) {
        try {
          const fdv = await conn.tooling.query("SELECT DurableId, DeveloperName, MasterLabel, IsActive FROM FlowDefinitionView WHERE IsActive = true");
          flows = (fdv.records || []).map(f => ({ id: f.DurableId || null, label: f.MasterLabel, status: f.IsActive ? 'Active' : 'Inactive', processType: null, triggerType: null, triggerObject: null, triggerOrder: null, related: null }));
        } catch (_) {}
      }
    } catch (_) {}

    // Apex triggers bound to this object
    let triggers = [];
    try {
      const tq = await conn.tooling.query(`SELECT Id, Name, TableEnumOrId, ApiVersion, Status, UsageBeforeInsert, UsageAfterInsert, UsageBeforeUpdate, UsageAfterUpdate, UsageBeforeDelete, UsageAfterDelete, UsageAfterUndelete FROM ApexTrigger WHERE TableEnumOrId='${name}'`);
      triggers = (tq.records || []).map(t => ({
        id: t.Id,
        name: t.Name,
        object: t.TableEnumOrId,
        status: t.Status,
        apiVersion: t.ApiVersion,
        events: {
          beforeInsert: !!t.UsageBeforeInsert,
          afterInsert: !!t.UsageAfterInsert,
          beforeUpdate: !!t.UsageBeforeUpdate,
          afterUpdate: !!t.UsageAfterUpdate,
          beforeDelete: !!t.UsageBeforeDelete,
          afterDelete: !!t.UsageAfterDelete,
          afterUndelete: !!t.UsageAfterUndelete,
        }
      }));
    } catch (_) {}

    res.json({ object: name, flows, triggers });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Requirements (read-only): always-required from describe + stage-gated derived from validation rules
// GET /sobjects/:name/requirements
app.get('/sobjects/:name/requirements', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    // Always-required from describe (nillable === false) -> exclude system id fields
    const desc = await conn.sobject(name).describe();
    const always = [];
    for (const f of desc.fields || []) {
      if (f.nillable === false && f.createable !== false && f.name !== 'Id') {
        always.push(f.name);
      }
    }

    // Stage-gated: parse common patterns in validation rule formulas
    const r = await conn.tooling.query(`SELECT ValidationName, Active, ErrorMessage, ErrorDisplayField, EntityDefinition.DeveloperName FROM ValidationRule WHERE EntityDefinition.DeveloperName='${name}' AND Active = true`);
    const stageRequirements = {}; // stage -> Set(fields)
    const addReq = (stage, field) => {
      if (!stage || !field) return;
      const key = String(stage);
      if (!stageRequirements[key]) stageRequirements[key] = new Set();
      stageRequirements[key].add(field);
    };
    const stageFieldNames = ['StageName', 'Kymanox_Opp_Status__c', 'ForecastCategory', 'ForecastCategoryName'];
    // Build stage vocabulary from picklists
    const stageVocab = new Set();
    for (const f of desc.fields || []) {
      if (stageFieldNames.includes(f.name) && Array.isArray(f.picklistValues)) {
        for (const v of f.picklistValues) if (v && v.value) stageVocab.add(String(v.value));
      }
    }
    for (const vr of r.records || []) {
      const msg = (vr.ErrorMessage || '').toLowerCase();
      const displayField = vr.ErrorDisplayField || '';
      // Heuristics: infer field from error display or message tokens
      let inferredField = displayField || null;
      if (!inferredField) {
        const candidates = (desc.fields || []).map(f => f.name).filter(n => /__c$/.test(n) || ['Amount','CloseDate','StageName','Type'].includes(n));
        for (const c of candidates) {
          if (msg.includes(c.toLowerCase())) { inferredField = c; break; }
        }
      }
      // Infer stage from common keywords in message
      let inferredStage = null;
      for (const st of stageVocab) {
        if (st && msg.includes(String(st).toLowerCase())) { inferredStage = st; break; }
      }
      // Also parse common formula-like snippets in messages: ISPICKVAL(StageName,'Proposing')
      if (!inferredStage) {
        const m = msg.match(/ispickval\(\s*stagename\s*,\s*'([^']+)'\s*\)/);
        if (m && m[1]) inferredStage = m[1];
      }
      if (inferredStage && inferredField) addReq(inferredStage, inferredField);
    }

    const stageRequirementsOut = Object.entries(stageRequirements).map(([stage, set]) => ({ stage, requiredFields: Array.from(set).sort() }));
    res.json({ object: name, alwaysRequired: always.sort(), stageRequirements: stageRequirementsOut });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Identity
app.get('/me', async (_req, res) => {
  try {
    const conn = await getConnection();
    const identity = await conn.identity();
    res.json(identity);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Limits
app.get('/limits', async (_req, res) => {
  try {
    const conn = await getConnection();
    const limits = await conn.limits();
    res.json(limits);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Org settings (read-only)
// GET /org/settings
// - Returns commonly useful org-level settings detected via describe + query intersection
app.get('/org/settings', async (_req, res) => {
  try {
    const conn = await getConnection();
    // Discover available Organization fields
    const orgDesc = await conn.sobject('Organization').describe();
    const available = new Set((orgDesc.fields || []).map(f => f.name));
    const desired = [
      'Name',
      'IsSandbox',
      'OrganizationType',
      'InstanceName',
      'DefaultCurrencyIsoCode',
      'IsMultiCurrencyOrganization',
      'DefaultTimeZoneSidKey',
      'FiscalYearStartMonth'
    ];
    const select = desired.filter(f => available.has(f));
    let org = {};
    if (select.length) {
      const soql = `SELECT ${select.join(', ')} FROM Organization LIMIT 1`;
      const r = await conn.query(soql);
      org = (r.records && r.records[0]) || {};
    }

    // CompanyInformation sometimes holds fiscal/timezone data in some orgs
    let company = {};
    try {
      const ciDesc = await conn.sobject('CompanyInformation').describe();
      const ciAvail = new Set((ciDesc.fields || []).map(f => f.name));
      const ciDesired = ['FiscalYearStartMonth', 'FiscalYearStartMonthName', 'TimeZoneSidKey', 'DefaultCurrencyIsoCode'];
      const ciSelect = ciDesired.filter(f => ciAvail.has(f));
      if (ciSelect.length) {
        const r2 = await conn.query(`SELECT ${ciSelect.join(', ')} FROM CompanyInformation LIMIT 1`);
        company = (r2.records && r2.records[0]) || {};
      }
    } catch (_) {
      company = { available: false, note: 'CompanyInformation not accessible with current permissions' };
    }

    res.json({ organization: org, companyInformation: company });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Global describe
app.get('/describe', async (_req, res) => {
  try {
    const conn = await getConnection();
    const desc = await conn.describeGlobal();
    res.json(desc);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Object describe
app.get('/sobjects/:name/describe', async (req, res) => {
  try {
    const conn = await getConnection();
    const name = req.params.name;
    const desc = await conn.sobject(name).describe();
    res.json(desc);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Recent records by object
app.get('/sobjects/:name/recent-records', async (req, res) => {
  const name = req.params.name;
  const limit = parsePositiveInt(req.query.limit, 10);
  try {
    const conn = await getConnection();
    const soql = `SELECT Id, Name, LastViewedDate FROM RecentlyViewed WHERE Type = '${name}' ORDER BY LastViewedDate DESC LIMIT ${limit}`;
    const result = await conn.query(soql);
    res.json({ totalSize: result.totalSize, records: result.records });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Picklists for an object
app.get('/sobjects/:name/picklists', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    const desc = await conn.sobject(name).describe();
    const picklists = [];
    for (const f of desc.fields || []) {
      if (f.picklistValues && f.picklistValues.length) {
        picklists.push({ field: f.name, values: f.picklistValues.map(v => ({ value: v.value, label: v.label, active: v.active })) });
      }
    }
    res.json({ object: name, picklists });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// List views for an object (read-only)
// GET /sobjects/:name/list-views?limit=20&describe=false
// - Uses SOQL to fetch ListView records for the sobject
// - If describe=true, augments each with REST listview describe (query, columns, order)
app.get('/sobjects/:name/list-views', async (req, res) => {
  const name = req.params.name;
  const limit = parsePositiveInt(req.query.limit, 20);
  const includeDescribe = String(req.query.describe || 'false').toLowerCase() === 'true';
  try {
    const conn = await getConnection();
    const soql = `SELECT Id, Name, DeveloperName, SobjectType FROM ListView WHERE SobjectType = '${name}' LIMIT ${limit}`;
    const r = await conn.query(soql);
    let items = (r.records || []).map(lv => ({ id: lv.Id, name: lv.Name, developerName: lv.DeveloperName, sobjectType: lv.SobjectType }));

    if (includeDescribe && items.length) {
      const described = [];
      for (const lv of items) {
        try {
          const url = `/services/data/v${conn.version}/sobjects/${name}/listviews/${lv.id}/describe`;
          const desc = await conn.request(url);
          described.push({
            ...lv,
            columns: Array.isArray(desc && desc.columns) ? desc.columns.map(c => c.fieldNameOrPath || c.name || c) : [],
            orderBy: Array.isArray(desc && desc.orderBy) ? desc.orderBy : [],
            query: (desc && desc.query) || null,
          });
        } catch (_) {
          described.push(lv);
        }
      }
      items = described;
    }

    res.json({ object: name, count: items.length, listViews: items });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Stages & forecast mapping (read-only)
// GET /sobjects/:name/stages
// - For Opportunity: uses OpportunityStage to return ordered stages with forecast categories and default probability
// - For other objects: returns StageName picklist (if present) as a fallback without forecast mapping
app.get('/sobjects/:name/stages', async (req, res) => {
  const name = req.params.name;
  try {
    const conn = await getConnection();
    if (name === 'Opportunity') {
      // OpportunityStage contains org-specific stage ordering and mappings
      const soql = 'SELECT MasterLabel, SortOrder, IsActive, IsClosed, IsWon, DefaultProbability, ForecastCategory, ForecastCategoryName FROM OpportunityStage ORDER BY SortOrder';
      const r = await conn.query(soql);
      const stages = (r.records || []).map(rec => ({
        label: rec.MasterLabel,
        sortOrder: rec.SortOrder,
        isActive: rec.IsActive,
        isClosed: rec.IsClosed,
        isWon: rec.IsWon,
        defaultProbability: rec.DefaultProbability,
        forecastCategory: rec.ForecastCategory,
        forecastCategoryName: rec.ForecastCategoryName,
      }));
      return res.json({ object: name, source: 'OpportunityStage', stages });
    }

    // Fallback: try to surface StageName picklist from describe
    const desc = await conn.sobject(name).describe();
    const stageField = (desc.fields || []).find(f => f.name === 'StageName');
    if (!stageField || !Array.isArray(stageField.picklistValues)) {
      return res.status(404).json({ error: `No stages available for object ${name}` });
    }
    const stages = stageField.picklistValues.map((v, idx) => ({
      label: v.label || v.value,
      value: v.value,
      isActive: !!v.active,
      sortOrder: idx,
    }));
    res.json({ object: name, source: 'describe', stages });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Stage history metrics for Opportunity (read-only)
// GET /sobjects/Opportunity/stage-history?limitOpps=500
// - Computes average days per stage and most common transitions using OpportunityHistory
app.get('/sobjects/Opportunity/stage-history', async (req, res) => {
  const limitOpps = parsePositiveInt(req.query.limitOpps, 500);
  try {
    const conn = await getConnection();
    // Pull a recent slice of closed and open opportunities to get diverse histories
    const opps = await conn.query(`SELECT Id, CreatedDate, CloseDate, StageName, IsClosed FROM Opportunity ORDER BY CreatedDate DESC LIMIT ${limitOpps}`);
    const oppIds = (opps.records || []).map(o => o.Id);
    if (!oppIds.length) return res.json({ totalOpportunities: 0, stages: [], transitions: [] });

    // Fetch stage history entries for those opps
    const chunks = [];
    for (let i = 0; i < oppIds.length; i += 200) chunks.push(oppIds.slice(i, i + 200));

    const histories = [];
    for (const chunk of chunks) {
      const soql = `SELECT OpportunityId, StageName, CreatedDate FROM OpportunityHistory WHERE OpportunityId IN ('${chunk.join("','")}') ORDER BY OpportunityId, CreatedDate`;
      const r = await conn.query(soql);
      histories.push(...(r.records || []));
    }

    // Compute durations per stage and transitions
    const stageDurations = new Map(); // stage -> totalMs
    const stageCounts = new Map();    // stage -> occurrences
    const transitionCounts = new Map(); // from->to -> count

    // Group by opportunity id
    const byOpp = new Map();
    for (const h of histories) {
      const arr = byOpp.get(h.OpportunityId) || [];
      arr.push({ stage: h.StageName, ts: new Date(h.CreatedDate).getTime() });
      byOpp.set(h.OpportunityId, arr);
    }
    for (const [oppId, events] of byOpp.entries()) {
      events.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < events.length; i++) {
        const cur = events[i];
        const next = events[i + 1] || null;
        // Duration until next stage (or ignore tail if no next)
        if (next) {
          const ms = Math.max(0, next.ts - cur.ts);
          stageDurations.set(cur.stage, (stageDurations.get(cur.stage) || 0) + ms);
          stageCounts.set(cur.stage, (stageCounts.get(cur.stage) || 0) + 1);
          const key = `${cur.stage} -> ${next.stage}`;
          transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
        }
      }
    }

    const stages = Array.from(stageCounts.keys()).map(stage => {
      const totalMs = stageDurations.get(stage) || 0;
      const count = stageCounts.get(stage) || 1;
      const avgDays = totalMs / count / (1000 * 60 * 60 * 24);
      return { stage, averageDays: Number(avgDays.toFixed(2)) };
    }).sort((a, b) => a.averageDays - b.averageDays);

    const transitions = Array.from(transitionCounts.entries())
      .map(([k, c]) => ({ transition: k, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({ totalOpportunities: oppIds.length, stages, transitions });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Data quality snapshot: fill rates and picklist usage (read-only)
// GET /sobjects/:name/usage?sample=500
app.get('/sobjects/:name/usage', async (req, res) => {
  const name = req.params.name;
  const sample = parsePositiveInt(req.query.sample, 500);
  try {
    const conn = await getConnection();
    const desc = await conn.sobject(name).describe();
    const allFields = (desc.fields || []).map(f => f.name);
    // Prioritize default/allowlisted fields if available
    const defaultFields = getDefaultFields(name) || [];
    const allowlisted = getAllowedFields(name) || [];
    const prioritized = Array.from(new Set([...defaultFields, ...allowlisted, ...allFields]));
    // Limit to a reasonable number per query; chunk to avoid overly wide selects
    const maxPerChunk = 100;
    const selectChunks = [];
    for (let i = 0; i < prioritized.length; i += maxPerChunk) {
      selectChunks.push(prioritized.slice(i, i + maxPerChunk));
    }

    // Accumulators
    const fieldFilledCounts = new Map();
    let totalRecords = 0;

    // Collect picklist definitions
    const picklistFields = (desc.fields || []).filter(f => Array.isArray(f.picklistValues) && f.picklistValues.length);
    const picklistUsage = new Map(); // field -> Map(value->count)
    for (const pf of picklistFields) picklistUsage.set(pf.name, new Map());

    let idSet = new Set();

    for (let idx = 0; idx < selectChunks.length; idx++) {
      const fields = ['Id', ...selectChunks[idx]];
      const soql = `SELECT ${fields.join(', ')} FROM ${name} ORDER BY CreatedDate DESC LIMIT ${sample}`;
      const r = await conn.query(soql);
      const records = Array.isArray(r.records) ? r.records : [];
      // Ensure we count each Id only once across chunks
      const idsThisChunk = new Set(records.map(rec => rec.Id));
      const isFirstChunk = idx === 0;
      if (isFirstChunk) {
        totalRecords = records.length;
        idSet = idsThisChunk;
      } else {
        // Align records to first-chunk Id set for consistent totals
        for (let i = records.length - 1; i >= 0; i--) {
          if (!idSet.has(records[i].Id)) records.splice(i, 1);
        }
      }

      for (const rec of records) {
        for (const field of selectChunks[idx]) {
          const val = rec[field];
          if (val !== null && val !== undefined && val !== '') {
            fieldFilledCounts.set(field, (fieldFilledCounts.get(field) || 0) + 1);
          }
          if (picklistUsage.has(field)) {
            const map = picklistUsage.get(field);
            if (typeof val === 'string' && val.includes(';')) {
              for (const part of val.split(';')) map.set(part, (map.get(part) || 0) + 1);
            } else if (val !== null && val !== undefined && val !== '') {
              map.set(val, (map.get(val) || 0) + 1);
            }
          }
        }
      }
    }

    const fillRates = [];
    for (const field of prioritized) {
      const filled = fieldFilledCounts.get(field) || 0;
      fillRates.push({ field, filled, total: totalRecords, rate: totalRecords ? filled / (totalRecords) : 0 });
    }
    fillRates.sort((a, b) => a.rate - b.rate);

    const picklistOut = [];
    for (const [field, map] of picklistUsage.entries()) {
      const values = Array.from(map.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 50);
      picklistOut.push({ field, values });
    }

    res.json({ object: name, sample: totalRecords, fillRates, picklistUsage: picklistOut });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Closed date rule detector (read-only)
// GET /sobjects/Opportunity/closed-date-rule?sample=500
app.get('/sobjects/Opportunity/closed-date-rule', async (req, res) => {
  const sample = parsePositiveInt(req.query.sample, 500);
  try {
    const conn = await getConnection();
    const desc = await conn.sobject('Opportunity').describe();
    const candidates = [];
    for (const f of desc.fields || []) {
      const isDate = f.type === 'date' || f.type === 'datetime';
      const looksClosed = /close/i.test(f.name) || /closed/i.test(f.name);
      if (isDate && looksClosed && f.name !== 'CloseDate') candidates.push(f.name);
    }
    // Include baseline CloseDate
    const selectFields = ['Id', 'CloseDate', ...candidates];
    const soql = `SELECT ${selectFields.join(', ')} FROM Opportunity WHERE IsClosed = true ORDER BY CloseDate DESC LIMIT ${sample}`;
    const r = await conn.query(soql);
    const records = Array.isArray(r.records) ? r.records : [];
    const total = records.length;
    const counts = new Map();
    for (const f of selectFields) counts.set(f, 0);
    for (const rec of records) {
      for (const f of selectFields) {
        const val = rec[f];
        if (val !== null && val !== undefined && val !== '') counts.set(f, (counts.get(f) || 0) + 1);
      }
    }
    const evidence = selectFields.filter(f => f !== 'Id').map(f => ({ field: f, filled: counts.get(f) || 0, total, rate: total ? (counts.get(f) || 0) / total : 0 }));
    evidence.sort((a, b) => b.rate - a.rate);
    const closeRate = evidence.find(e => e.field === 'CloseDate') || { rate: 0 };
    const best = evidence[0] || null;
    let winner = 'CloseDate';
    if (best && best.field !== 'CloseDate' && best.rate >= 0.9 && closeRate.rate < 0.9) {
      winner = best.field;
    }
    res.json({ object: 'Opportunity', sample: total, winnerField: winner, evidence });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Analytics endpoints
app.get('/analytics/queries/recent', async (req, res) => {
  const limit = parsePositiveInt(req.query.limit, 50);
  try {
    const items = await analytics.getRecentQueries(limit);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

app.get('/analytics/top-fields', async (req, res) => {
  const objectName = req.query.object || undefined;
  const top = parsePositiveInt(req.query.top, 20);
  try {
    const items = await analytics.getTopFields({ objectName, top });
    res.json({ object: objectName || null, items });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Manifest and simple OpenAPI document for LLM auto-discovery
app.get('/manifest', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(manifest(base));
});

app.get('/openapi.json', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(openapi(base));
});

app.get('/tools.json', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(toolsSchema(base));
});

// Object insights (org-aware summary for a single object)
app.get('/objects/:name/insights', async (req, res) => {
  const name = req.params.name;
  try {
    const verbose = String(req.query.verbose || 'false').toLowerCase() === 'true';
    const data = await generateObjectInsights(name, { verbose });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Execute a suggestion from insights via safe-query, with export formats
// POST /objects/:name/insights/run { suggestion: {...}, fields?:[], format?: json|ndjson|csv }
app.post('/objects/:name/insights/run', async (req, res) => {
  const name = req.params.name;
  const suggestion = req.body && req.body.suggestion;
  const fields = req.body && req.body.fields;
  const format = (req.body && req.body.format) || 'json';
  if (!suggestion || !Array.isArray(suggestion.where)) return res.status(400).json({ error: 'Missing suggestion.where' });
  try {
    const built = buildSafeSoql({ object: name, fields, where: suggestion.where, limit: suggestion.limit || 200 });
    const conn = await getConnection();
    const result = await conn.query(built.soql);
    const records = Array.isArray(result.records) ? result.records : [];
    if (format === 'ndjson') {
      res.type('application/x-ndjson').send(toNdjson(records));
    } else if (format === 'csv') {
      res.type('text/csv').send(toCsv(records));
    } else {
      res.json({ objectName: name, fieldsUsed: built.fieldsUsed, totalSize: result.totalSize, done: result.done, next: result.nextRecordsUrl || null, records });
    }
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Generate markdown context for an object. Body: { persist?: boolean, dir?: string }
app.post('/objects/:name/context', async (req, res) => {
  const name = req.params.name;
  const persist = !!(req.body && req.body.persist);
  const dir = (req.body && req.body.dir) || path.resolve(process.cwd(), 'context');
  try {
    const verbose = !!(req.body && req.body.verbose);
    const data = await generateObjectInsights(name, { verbose });
    const md = renderInsightsMarkdown(data);
    if (persist) {
      await fs.promises.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${name}.md`);
      await fs.promises.writeFile(filePath, md, 'utf8');
      return res.json({ ok: true, path: filePath });
    }
    res.type('text/markdown').send(md);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Segmented bundle export with timestamped folder and query runs
// POST /objects/:name/context/bundle { persist: true, dir?: string, runQueries?: boolean, sample?: number, verbose?: boolean }
app.post('/objects/:name/context/bundle', async (req, res) => {
  const name = req.params.name;
  const persist = !!(req.body && req.body.persist);
  const baseDir = (req.body && req.body.dir) || path.resolve(process.cwd(), 'context_bundles');
  const runQueries = !!(req.body && req.body.runQueries);
  const sample = parsePositiveInt(req.body && req.body.sample, 50);
  const verbose = !!(req.body && req.body.verbose);
  try {
    const conn = await getConnection();
    const insights = await generateObjectInsights(name, { verbose });

    // Fetch extras in parallel
    const [stages, validationRules, requirements, formulas, automations, listViews, usage, stageHistory, closedDateRule, orgSettings] = await Promise.all([
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/stages`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/validation-rules`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/requirements`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/formulas`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/automations`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/list-views?describe=true&limit=20`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/sobjects/${name}/usage?sample=500`)).json; } catch (_) { return null; }
      })(),
      (async () => {
        try { return name === 'Opportunity' ? await (await fetchLocal(`/sobjects/Opportunity/stage-history`)).json : null; } catch (_) { return null; }
      })(),
      (async () => {
        try { return name === 'Opportunity' ? await (await fetchLocal(`/sobjects/Opportunity/closed-date-rule?sample=500`)).json : null; } catch (_) { return null; }
      })(),
      (async () => {
        try { return await (await fetchLocal(`/org/settings`)).json; } catch (_) { return null; }
      })(),
    ]);

    const extras = { stages, validationRules, requirements, formulas, automations, listViews, usage, stageHistory, closedDateRule, orgSettings };

    // Optional: run some live safe queries for a small sample query library
    const queryRuns = [];
    if (runQueries && Array.isArray(insights.suggestions)) {
      const fields = (insights.sample && insights.sample.fields) || (insights.summary.allowlist && insights.summary.allowlist.defaultFields) || ['Id'];
      for (const sug of insights.suggestions.slice(0, 5)) {
        try {
          const built = buildSafeSoql({ object: name, fields, where: sug.where, limit: Math.min(sample, 50) });
          const r = await conn.query(built.soql);
          queryRuns.push({ title: sug.title, payload: { object: name, fields, where: sug.where, limit: Math.min(sample, 50) }, records: (r.records || []).slice(0, 10) });
        } catch (_) {}
      }
    }
    extras.queryRuns = queryRuns;

    const files = renderInsightsSegments(insights, extras);

    if (!persist) return res.json({ files });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(baseDir, `${name}_${ts}`);
    await fs.promises.mkdir(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      await fs.promises.writeFile(path.join(dir, file), content, 'utf8');
    }
    // Auto-refresh dynamic allowlist after generating context bundle
    if (dynamicAllowlist) {
      try {
        await dynamicAllowlist.analyzeContextBundles(baseDir);
        console.log('[server] Auto-refreshed dynamic allowlist after context bundle generation');
      } catch (refreshErr) {
        console.warn('[server] Failed to auto-refresh dynamic allowlist:', refreshErr.message);
      }
    }
    
    res.json({ ok: true, dir, files: Object.keys(files) });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Helper to call our own server without re-implementing logic (simple local request)
async function fetchLocal(pathname) {
  const base = `http://localhost:${port}`;
  const url = `${base}${pathname}`;
  const result = await (await require('undici').request(url)).body.json();
  return { json: result };
}

// Allowlist discoverability (org-aware facade for the bot)
app.get('/allowlist', (_req, res) => {
  const objects = {};
  for (const [name, spec] of Object.entries(OBJECTS)) {
    objects[name] = {
      fields: spec.fields,
      defaultFields: spec.defaultFields || [],
    };
  }
  res.json({ objects });
});

// Changes endpoint using SystemModstamp / LastModifiedDate
// GET /changes/:name?since=ISO&limit=200
app.get('/changes/:name', async (req, res) => {
  const name = req.params.name;
  const since = req.query.since;
  const limit = parsePositiveInt(req.query.limit, 100);
  if (!since) return res.status(400).json({ error: 'Missing since (ISO date/time)' });
  try {
    const conn = await getConnection();
    const fields = getDefaultFields(name).length ? getDefaultFields(name) : getAllowedFields(name).slice(0, 5);
    const selectList = fields.join(', ');
    // Salesforce requires unquoted ISO8601 for datetime comparisons
    const isoRe = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z$/;
    const sinceLiteral = isoRe.test(String(since)) ? String(since) : escapeSoqlLiteral(since);

    // Try SystemModstamp first, then fall back to LastModifiedDate
    let result;
    try {
      const soql1 = `SELECT ${selectList}, SystemModstamp FROM ${name} WHERE SystemModstamp >= ${sinceLiteral} ORDER BY SystemModstamp ASC LIMIT ${limit}`;
      result = await conn.query(soql1);
    } catch (e) {
      const soql2 = `SELECT ${selectList}, LastModifiedDate FROM ${name} WHERE LastModifiedDate >= ${sinceLiteral} ORDER BY LastModifiedDate ASC LIMIT ${limit}`;
      result = await conn.query(soql2);
    }

    res.json({ objectName: name, since, totalSize: result.totalSize, done: result.done, next: result.nextRecordsUrl || null, records: result.records });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Safe Query (READ-ONLY)
// Body: { object: string, fields?: string[], where?: Array<{field, op, value}> | {[field]: value}, orderBy?: Array<{ field, direction }> | { field, direction }, limit?: number, flatten?: boolean }
app.post('/safe-query', async (req, res) => {
  try {
    const payload = req.body || {};
    const built = buildSafeSoql(payload);
    const soql = built.soql;
    const conn = await getConnection();
    const result = await conn.query(soql);
    const records = payload.flatten ? flattenRecords(result.records) : result.records;

    try {
      const objectName = payload.object || extractObjectName(soql || '');
      const fields = built.fieldsUsed || payload.fields || extractFields(soql || '');
      await analytics.recordQueryEvent({ kind: 'safe_soql', objectName, fields, soql, resultCount: (records || []).length });
    } catch (_) {}

    res.json({ objectName: payload.object || null, fieldsUsed: built.fieldsUsed || payload.fields || null, totalSize: result.totalSize, done: result.done, next: result.nextRecordsUrl || null, records });
  } catch (err) {
    res.status(400).json({ error: err && err.message ? err.message : String(err) });
  }
});

// SOSL (READ-ONLY)
// Body: { sosl: string }
app.post('/search', async (req, res) => {
  const sosl = req.body && req.body.sosl;
  if (!sosl) return res.status(400).json({ error: 'Missing body.sosl' });
  try {
    const conn = await getConnection();
    const result = await conn.search(sosl);
    try {
      await analytics.recordQueryEvent({ kind: 'sosl', objectName: null, fields: [], soql: null, sosl, resultCount: Array.isArray(result) ? result.length : 0 });
    } catch (_) {}
    res.json({ items: result });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Add enhanced error handling middleware
app.use(errorHandlerMiddleware);

const port = parsePositiveInt(getEnv('PORT', '3000'), 3000);
app.listen(port, () => {
  console.log(`[server] Listening on http://localhost:${port}`);
});


