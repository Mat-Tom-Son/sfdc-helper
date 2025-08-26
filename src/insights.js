'use strict';

const { getConnection } = require('./sfConnection');
const { getAllowedFields, getDefaultFields, isObjectAllowed } = require('./allowlist');
const { buildSafeSoql } = require('./safeQuery');
const { flattenRecords } = require('./flatten');
const analytics = require('./analytics');
const jsforce = require('jsforce');

function chooseSampleFields(objectName, describe) {
  let fields = getDefaultFields(objectName);
  if (fields && fields.length) return fields;
  const has = (name) => (describe.fields || []).some((f) => f.name === name);
  const pick = [];
  if (has('Id')) pick.push('Id');
  if (has('Name')) pick.push('Name');
  if (has('CreatedDate')) pick.push('CreatedDate');
  else if (has('LastModifiedDate')) pick.push('LastModifiedDate');
  // Owner.Name if possible
  const ownerRel = (describe.fields || []).find((f) => f.name === 'OwnerId' || f.relationshipName === 'Owner');
  if (ownerRel) pick.push('Owner.Name');
  return pick.length ? pick : (getAllowedFields(objectName).slice(0, 4) || ['Id']);
}

async function generateObjectInsights(objectName, options = {}) {
  const verbose = !!options.verbose;
  const log = (...args) => { if (verbose) console.log('[insights]', ...args); };

  log(`start ${objectName}`);
  const conn = await getConnection();
  log('describe start');
  const desc = await conn.sobject(objectName).describe();
  log('describe done');

  const sampleFields = chooseSampleFields(objectName, desc);

  let sampleQuery = null;
  let sampleRecords = [];
  try {
    log('sample query start (safe or raw)');
    if (isObjectAllowed(objectName)) {
      const built = buildSafeSoql({ object: objectName, fields: sampleFields, orderBy: { field: 'CreatedDate', direction: 'DESC' }, limit: 5 });
      sampleQuery = built.soql;
      const res = await conn.query(sampleQuery);
      sampleRecords = flattenRecords(res.records);
    } else {
      const selectList = sampleFields.join(', ');
      sampleQuery = `SELECT ${selectList} FROM ${objectName} ORDER BY CreatedDate DESC LIMIT 5`;
      const res = await conn.query(sampleQuery);
      sampleRecords = flattenRecords(res.records);
    }
    log('sample query done');
  } catch (_) {
    sampleQuery = null;
    sampleRecords = [];
  }

  // Picklists - full list
  const picklists = [];
  for (const f of desc.fields || []) {
    if (f.picklistValues && f.picklistValues.length) {
      picklists.push({ field: f.name, values: f.picklistValues.map((v) => ({ value: v.value, label: v.label, active: v.active })) });
    }
  }
  log('picklists collected', picklists.length);

  // Recent viewed
  let recent = { totalSize: 0, records: [] };
  try {
    log('recent viewed query start');
    const soql = `SELECT Id, Name, LastViewedDate FROM RecentlyViewed WHERE Type = '${objectName}' ORDER BY LastViewedDate DESC LIMIT 5`;
    const r = await conn.query(soql);
    recent = { totalSize: r.totalSize, records: r.records };
    log('recent viewed query done');
  } catch (_) { log('recent viewed query skipped'); }

  // Top fields analytics
  log('top fields start');
  const topFields = await analytics.getTopFields({ objectName, top: 10 });
  log('top fields done');

  // Record types (high-level)
  const recordTypes = Array.isArray(desc.recordTypeInfos)
    ? desc.recordTypeInfos.map((r) => ({
        name: r.name,
        developerName: r.developerName,
        recordTypeId: r.recordTypeId,
        default: !!r.defaultRecordTypeMapping,
        active: r.available,
      }))
    : [];

  // Layouts (names) and default layout fields (best effort)
  let layouts = [];
  let defaultLayout = { fields: [], sections: [] };
  try {
    log('layouts list (tooling) start');
    const q = await conn.tooling.query(`SELECT Id, Name, TableEnumOrId FROM Layout WHERE TableEnumOrId = '${objectName}' LIMIT 20`);
    layouts = (q.records || []).map((r) => ({ id: r.Id, name: r.Name }));
    log('layouts list (tooling) done', layouts.length);
  } catch (_) { log('layouts list (tooling) skipped'); }
  try {
    log('describeLayout start');
    let dl = null;
    try {
      dl = await conn.describeLayout(objectName, null);
    } catch (e1) {
      // Fall back to default record type, then try others until one works
      const rts = Array.isArray(desc.recordTypeInfos) ? desc.recordTypeInfos : [];
      const def = rts.find(r => r.defaultRecordTypeMapping) || rts[0];
      const idsToTry = [];
      if (def && def.recordTypeId) idsToTry.push(def.recordTypeId);
      for (const rt of rts) {
        if (rt && rt.recordTypeId && !idsToTry.includes(rt.recordTypeId)) idsToTry.push(rt.recordTypeId);
      }
      for (const rtId of idsToTry) {
        try {
          dl = await conn.describeLayout(objectName, rtId);
          log('describeLayout fallback succeeded with recordTypeId', rtId);
          break;
        } catch (e2) {}
      }
    }
    const layout = dl && dl.layouts && dl.layouts[0] || null;
    if (layout) {
      const fieldSet = new Set();
      const sections = [];
      const sectionsSrc = layout.detailLayoutSections || layout.layoutSections || [];
      for (const sec of sectionsSrc) {
        const secObj = { heading: sec.heading || '', columns: sec.columns || 1, fields: [] };
        const rows = sec.layoutRows || [];
        for (const row of rows) {
          const items = row.layoutItems || [];
          for (const it of items) {
            if (it && it.field) {
              fieldSet.add(it.field);
              secObj.fields.push(it.field);
              continue;
            }
            const comps = it && it.layoutComponents || [];
            for (const c of comps) {
              if (c && c.value) {
                fieldSet.add(c.value);
                secObj.fields.push(c.value);
              }
            }
          }
        }
        sections.push(secObj);
      }
      defaultLayout = { fields: Array.from(fieldSet), sections };
      log('describeLayout done');
    } else {
      log('describeLayout unavailable');
    }
  } catch (_) { log('describeLayout skipped'); }

  // All fields detail
  const fieldsDetail = (desc.fields || []).map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    length: f.length,
    nillable: f.nillable,
    unique: f.unique,
    updateable: f.updateable,
    calculated: f.calculated,
    referenceTo: f.referenceTo || [],
    picklist: Array.isArray(f.picklistValues) ? f.picklistValues.map((v) => ({ value: v.value, label: v.label, active: v.active })) : [],
  }));

  // Reports summary (top 10 by LastRunDate)
  let reports = [];
  try {
    log('reports summary start');
    const r = await conn.query(`SELECT Id, Name, DeveloperName, LastRunDate, Format FROM Report WHERE Format != null ORDER BY LastRunDate DESC NULLS LAST LIMIT 10`);
    for (const rec of r.records || []) {
      let filters = [];
      try {
        const resp = await conn.request(`/services/data/v${conn.version}/analytics/reports/${rec.Id}/describe`);
        if (resp && resp.reportDescribe && Array.isArray(resp.reportDescribe.reportFilters)) {
          filters = resp.reportDescribe.reportFilters.map((f) => ({ column: f.column, operator: f.operator, value: f.value, isRunPageEditable: f.isRunPageEditable }));
        }
      } catch (_) {}
      reports.push({ id: rec.Id, name: rec.Name, developerName: rec.DeveloperName, lastRunDate: rec.LastRunDate, format: rec.Format, filters });
    }
    log('reports summary done', reports.length);
  } catch (_) { log('reports summary skipped'); }

  // Relationships: outbound (this → others) and inbound (others → this)
  const relatedTo = [];
  for (const f of desc.fields || []) {
    if (f.type === 'reference' && Array.isArray(f.referenceTo) && f.referenceTo.length) {
      relatedTo.push({ field: f.name, relationshipName: f.relationshipName || null, targets: f.referenceTo });
    }
  }

  const relatedFrom = [];
  try {
    log('relationships inbound scan start');
    const global = await conn.describeGlobal();
    for (const so of global.sobjects || []) {
      if (!so.queryable) continue;
      try {
        const od = await conn.sobject(so.name).describe();
        for (const f of od.fields || []) {
          if (f.type === 'reference' && Array.isArray(f.referenceTo) && f.referenceTo.includes(objectName)) {
            relatedFrom.push({ object: so.name, field: f.name, relationshipName: f.relationshipName || null });
          }
        }
      } catch (_) {}
      if (relatedFrom.length >= 50) break; // cap
    }
    log('relationships inbound scan done', relatedFrom.length);
  } catch (_) { log('relationships inbound scan skipped'); }

  // Common filter suggestions (admin-friendly, read-only)
  const suggestions = [];
  const hasField = (name) => (desc.fields || []).some((f) => f.name === name);
  // Intentionally no user-specific suggestions; avoid identity lookups
  if (hasField('CreatedDate')) {
    suggestions.push({ title: 'Last 30 days', where: [{ field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:30' }], limit: 50 });
  }
  if (objectName === 'Opportunity') {
    if (hasField('StageName')) suggestions.push({ title: 'Open pipeline', where: [{ field: 'StageName', op: 'IN', value: ['Prospecting','Qualification','Proposal/Price Quote','Negotiation/Review'] }], limit: 50 });
    if (hasField('CloseDate')) suggestions.push({ title: 'Closing this quarter', where: [{ field: 'CloseDate', op: '=', value: 'THIS_QUARTER' }], limit: 50 });
  }
  log('suggestions prepared', suggestions.length);

  const summary = {
    objectName,
    label: desc.label,
    labelPlural: desc.labelPlural,
    keyPrefix: desc.keyPrefix,
    searchable: !!desc.searchable,
    feedEnabled: !!desc.feedEnabled,
    queryable: !!desc.queryable,
    fieldsCount: (desc.fields || []).length,
    allowlist: {
      defaultFields: getDefaultFields(objectName),
      fields: getAllowedFields(objectName),
      allowlisted: isObjectAllowed(objectName),
    },
  };

  const out = {
    summary,
    topFields,
    recordTypes,
    layouts,
    defaultLayout,
    fieldsDetail,
    reports,
    relationships: { relatedTo, relatedFrom },
    sample: {
      fields: sampleFields,
      query: sampleQuery,
      records: sampleRecords,
    },
    picklists,
    // recentViewed removed to avoid user-centric data
    suggestions,
  };
  log('done', objectName);
  return out;
}

module.exports = { generateObjectInsights };


