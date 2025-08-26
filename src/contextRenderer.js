'use strict';

function truncate(text, max = 8000) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function renderTable(records, maxRows = 10) {
  const rows = Array.isArray(records) ? records.slice(0, maxRows) : [];
  if (!rows.length) return '';
  const headerSet = new Set();
  for (const r of rows) {
    for (const k of Object.keys(r)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);
  const lines = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('|' + headers.map(() => '---').join('|') + '|');
  for (const r of rows) {
    lines.push('| ' + headers.map((h) => (r[h] === null || r[h] === undefined ? '' : String(r[h]))).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function renderInsightsMarkdown(insights) {
  const s = insights.summary || {};
  const topFields = insights.topFields || [];
  const sample = insights.sample || {};
  const picklists = insights.picklists || [];
  const fieldsDetail = insights.fieldsDetail || [];
  const defaultLayout = insights.defaultLayout || { fields: [], sections: [] };
  const reports = insights.reports || [];
  const relationships = insights.relationships || { relatedTo: [], relatedFrom: [] };
  const recordTypes = insights.recordTypes || [];
  const layouts = insights.layouts || [];
  const suggestions = insights.suggestions || [];
  const recent = insights.recentViewed || { records: [] };

  const lines = [];
  lines.push(`# ${s.objectName} (${s.label})`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Label: ${s.label}`);
  lines.push(`- Plural: ${s.labelPlural}`);
  lines.push(`- Key Prefix: ${s.keyPrefix}`);
  lines.push(`- Queryable: ${s.queryable}`);
  lines.push(`- Searchable: ${s.searchable}`);
  lines.push(`- Fields: ${s.fieldsCount}`);
  lines.push(`- Allowlisted: ${s.allowlist && s.allowlist.allowlisted}`);
  if (s.allowlist) {
    lines.push(`- Default Fields: ${(s.allowlist.defaultFields || []).join(', ')}`);
  }

  if (recordTypes.length) {
    lines.push('');
    lines.push('## Record Types');
    for (const rt of recordTypes) {
      lines.push(`- ${rt.name} (${rt.developerName})${rt.default ? ' [default]' : ''}${rt.active ? '' : ' [inactive]'}`);
    }
  }

  if (layouts.length) {
    lines.push('');
    lines.push('## Layouts');
    for (const l of layouts) lines.push(`- ${l.name}`);
  }

  if (defaultLayout && (defaultLayout.fields || []).length) {
    lines.push('');
    lines.push('## Default Layout (fields)');
    lines.push((defaultLayout.fields || []).join(', '));
  }

  if (topFields.length) {
    lines.push('');
    lines.push('## Top Queried Fields');
    for (const tf of topFields) lines.push(`- ${tf.field}: ${tf.count}`);
  }

  if (picklists.length) {
    lines.push('');
    lines.push('## Picklists');
    for (const p of picklists) {
      lines.push(`- ${p.field}: ${p.values.map((v) => v.value).join(', ')}`);
    }
  }

  if (relationships.relatedTo && relationships.relatedTo.length) {
    lines.push('');
    lines.push('## References To Other Objects');
    for (const r of relationships.relatedTo.slice(0, 20)) {
      lines.push(`- ${r.field}${r.relationshipName ? ` (${r.relationshipName})` : ''} → ${r.targets.join(', ')}`);
    }
  }

  if (relationships.relatedFrom && relationships.relatedFrom.length) {
    lines.push('');
    lines.push('## Referenced From Other Objects');
    for (const r of relationships.relatedFrom.slice(0, 20)) {
      lines.push(`- ${r.object}.${r.field}${r.relationshipName ? ` (${r.relationshipName})` : ''}`);
    }
  }

  if (sample && sample.records && sample.records.length) {
    lines.push('');
    lines.push('## Sample Records');
    lines.push('Query:');
    if (sample.query) lines.push('```sql\n' + truncate(sample.query, 2000) + '\n```');
    lines.push(renderTable(sample.records, 10));
  }

  if (suggestions.length) {
    lines.push('');
    lines.push('## Suggested Filters (Safe)');
    for (const sug of suggestions) {
      lines.push(`- ${sug.title}: ${JSON.stringify(sug.where)}`);
    }
  }

  if (fieldsDetail.length) {
    lines.push('');
    lines.push('## Fields Detail');
    for (const f of fieldsDetail) {
      lines.push(`- ${f.name} (${f.label}) [${f.type}]${f.nillable ? '' : ' [required]'}${f.updateable ? '' : ' [read-only]'}`);
    }
  }

  if (reports.length) {
    lines.push('');
    lines.push('## Recent Reports (Top 10)');
    for (const r of reports) {
      lines.push(`- ${r.name} [${r.format}] ${r.lastRunDate || ''}`);
      if (r.filters && r.filters.length) lines.push(`  filters: ${JSON.stringify(r.filters)}`);
    }
  }

  // Suggested API calls (curl) to guide downstream agents
  const baseUrl = 'http://localhost:3000';
  const safeFields = (sample && Array.isArray(sample.fields) && sample.fields.length)
    ? sample.fields
    : ((s.allowlist && s.allowlist.defaultFields) || []);

  lines.push('');
  lines.push('## Suggested API Calls');

  // Insights
  lines.push('### Insights');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/objects/${s.objectName}/insights' | jq`);
  lines.push('```');

  // Picklists
  lines.push('### Picklists');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/picklists' | jq`);
  lines.push('```');

  // Stages & forecast mapping
  lines.push('### Stages & forecast mapping');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/stages' | jq`);
  lines.push('```');

  // Validation rules (Tooling API)
  lines.push('### Validation rules');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/validation-rules' | jq`);
  lines.push('```');

  // List views (with optional describe)
  lines.push('### List views');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/list-views?limit=10' | jq`);
  lines.push('```');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/list-views?limit=5&describe=true' | jq`);
  lines.push('```');

  // Opportunity-specific: stage history metrics
  if (s.objectName === 'Opportunity') {
    lines.push('### Stage history metrics');
    lines.push('```bash');
    lines.push(`curl -sS '${baseUrl}/sobjects/Opportunity/stage-history?limitOpps=500' | jq`);
    lines.push('```');
  }

  // Safe-query for each suggestion (limit to first 3)
  if (suggestions.length) {
    lines.push('### Safe queries for common filters');
    const maxSug = Math.min(3, suggestions.length);
    for (let i = 0; i < maxSug; i++) {
      const sug = suggestions[i];
      const payload = {
        object: s.objectName,
        fields: safeFields,
        where: sug.where,
        limit: sug.limit || 200,
        flatten: true,
      };
      const json = JSON.stringify(payload).replace(/'/g, "'\\''");
      lines.push(`#### ${sug.title}`);
      lines.push('```bash');
      lines.push(`curl -sS -X POST '${baseUrl}/safe-query' \\\n  -H 'Content-Type: application/json' \\\n  --data '${json}' | jq '.records[0:5]'`);
      lines.push('```');

      // CSV export via insights.run
      const runPayload = { suggestion: sug, fields: safeFields, format: 'csv' };
      const runJson = JSON.stringify(runPayload).replace(/'/g, "'\\''");
      lines.push('```bash');
      lines.push(`curl -sS -X POST '${baseUrl}/objects/${s.objectName}/insights/run' \\\n  -H 'Content-Type: application/json' \\\n  --data '${runJson}' > ${s.objectName.toLowerCase()}_${i + 1}.csv`);
      lines.push('```');
    }
  }

  // Allowlist / describe
  lines.push('### Schema discovery');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/allowlist' | jq`);
  lines.push('```');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/describe' | jq '.fields | length'`);
  lines.push('```');

  // Organization settings (global context)
  lines.push('### Organization settings');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/org/settings' | jq`);
  lines.push('```');

  // Requirements (always-required + stage-gated inferred)
  lines.push('### Requirements (always-required and stage-gated)');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/requirements' | jq`);
  lines.push('```');

  // Data quality snapshot (fill rates, picklist usage)
  lines.push('### Data quality snapshot');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/usage?sample=500' | jq`);
  lines.push('```');

  // Opportunity-specific: closed date rule
  if (s.objectName === 'Opportunity') {
    lines.push('### Closed date rule (detector)');
    lines.push('```bash');
    lines.push(`curl -sS '${baseUrl}/sobjects/Opportunity/closed-date-rule?sample=500' | jq`);
    lines.push('```');
  }

  // Formula fields explained
  lines.push('### Formula and summary fields');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/formulas' | jq`);
  lines.push('```');

  // Automations
  lines.push('### Automations (Flows & Triggers)');
  lines.push('```bash');
  lines.push(`curl -sS '${baseUrl}/sobjects/${s.objectName}/automations' | jq`);
  lines.push('```');

  // Regenerate/persist context
  lines.push('### Regenerate and persist this context');
  lines.push('```bash');
  lines.push(`curl -sS -X POST '${baseUrl}/objects/${s.objectName}/context' \\\n  -H 'Content-Type: application/json' \\\n  --data '{"persist":true,"dir":"context"}' | jq`);
  lines.push('```');

  return lines.join('\n');
}

module.exports = { renderInsightsMarkdown };



// Segmented render for timestamped export bundles
function renderLines(lines) {
  return lines.join('\n');
}

function renderSummarySection(insights) {
  const s = insights.summary || {};
  const lines = [];
  lines.push(`# ${s.objectName} (${s.label})`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Label: ${s.label}`);
  lines.push(`- Plural: ${s.labelPlural}`);
  lines.push(`- Key Prefix: ${s.keyPrefix}`);
  lines.push(`- Queryable: ${s.queryable}`);
  lines.push(`- Searchable: ${s.searchable}`);
  lines.push(`- Fields: ${s.fieldsCount}`);
  if (s.allowlist) {
    lines.push(`- Allowlisted: ${s.allowlist.allowlisted}`);
    lines.push(`- Default Fields: ${(s.allowlist.defaultFields || []).join(', ')}`);
  }
  return renderLines(lines);
}

function renderPicklistsSection(insights) {
  const picklists = insights.picklists || [];
  const lines = [];
  lines.push(`# Picklists for ${insights.summary.objectName}`);
  lines.push('');
  for (const p of picklists) {
    lines.push(`- ${p.field}: ${p.values.map(v => v.value).join(', ')}`);
  }
  return renderLines(lines);
}

function renderStagesSection(extra) {
  const lines = [];
  lines.push(`# Stages`);
  lines.push('');
  if (extra && Array.isArray(extra.stages)) {
    // Show as table
    const table = renderTable(extra.stages.map(s => ({
      label: s.label || s.value,
      sortOrder: s.sortOrder,
      forecastCategory: s.forecastCategory || s.forecastCategoryName || '',
      defaultProbability: s.defaultProbability !== undefined ? s.defaultProbability : ''
    })), 50);
    if (table) lines.push(table);
  }
  return renderLines(lines);
}

function renderValidationRulesSection(extra) {
  const lines = [];
  lines.push(`# Validation Rules`);
  lines.push('');
  for (const r of (extra && extra.rules) || []) {
    lines.push(`- ${r.name}${r.active ? '' : ' [inactive]'}: ${r.errorMessage || ''}${r.errorDisplayField ? ` (field: ${r.errorDisplayField})` : ''}`);
  }
  return renderLines(lines);
}

function renderRequirementsSection(extra) {
  const lines = [];
  lines.push(`# Requirements`);
  lines.push('');
  lines.push('## Always required');
  lines.push((extra.alwaysRequired || []).join(', '));
  if (extra.stageRequirements && extra.stageRequirements.length) {
    lines.push('');
    lines.push('## Stage-gated requirements');
    for (const row of extra.stageRequirements) {
      lines.push(`- ${row.stage}: ${row.requiredFields.join(', ')}`);
    }
  }
  return renderLines(lines);
}

function renderFormulasSection(extra, objectName) {
  const lines = [];
  lines.push(`# Formula and Summary Fields (${objectName})`);
  lines.push('');
  for (const f of (extra && extra.formulas) || []) {
    lines.push(`### ${f.label || f.name} (${f.name})`);
    lines.push(`- Type: ${f.type}${f.calculated ? ' [calculated]' : ''}`);
    if (f.formula) {
      lines.push('```');
      lines.push(truncate(f.formula, 4000));
      lines.push('```');
    }
    if (f.inlineHelpText) lines.push(`- Help: ${f.inlineHelpText}`);
    lines.push('');
  }
  return renderLines(lines);
}

function renderAutomationsSection(extra, objectName) {
  const lines = [];
  lines.push(`# Automations (${objectName})`);
  lines.push('');
  lines.push('## Flows');
  for (const f of (extra.flows || [])) {
    lines.push(`- ${f.label} [${f.status}] ${f.triggerType || ''} ${f.triggerObject || ''}`);
  }
  lines.push('');
  lines.push('## Apex Triggers');
  for (const t of (extra.triggers || [])) {
    const ev = t.events || {};
    const evs = Object.entries(ev).filter(([, v]) => v).map(([k]) => k).join(', ');
    lines.push(`- ${t.name} [${t.status}] events: ${evs}`);
  }
  return renderLines(lines);
}

function renderListViewsSection(extra, objectName) {
  const lines = [];
  lines.push(`# List Views (${objectName})`);
  lines.push('');
  for (const lv of (extra.listViews || [])) {
    lines.push(`- ${lv.name} (${lv.developerName})`);
    if (lv.query) lines.push(`  query: ${truncate(lv.query, 1000)}`);
    if (Array.isArray(lv.columns) && lv.columns.length) lines.push(`  columns: ${lv.columns.join(', ')}`);
    if (Array.isArray(lv.orderBy) && lv.orderBy.length) lines.push(`  orderBy: ${JSON.stringify(lv.orderBy)}`);
  }
  return renderLines(lines);
}

function renderUsageSection(extra, objectName) {
  const lines = [];
  lines.push(`# Data Quality Snapshot (${objectName})`);
  lines.push('');
  const low = (extra.fillRates || []).slice(0, 20).map(x => ({ field: x.field, rate: Number((x.rate * 100).toFixed(1)) + '%' }));
  const table = renderTable(low, 20);
  if (table) lines.push(table);
  lines.push('');
  lines.push('## Picklist usage (top)');
  for (const pu of (extra.picklistUsage || [])) {
    lines.push(`- ${pu.field}: ${(pu.values || []).slice(0, 10).map(v => `${v.value}(${v.count})`).join(', ')}`);
  }
  return renderLines(lines);
}

function renderStageHistorySection(extra) {
  const lines = [];
  lines.push(`# Stage History Metrics`);
  lines.push('');
  const table = renderTable((extra.stages || []).map(s => ({ stage: s.stage, averageDays: s.averageDays })), 50);
  if (table) lines.push(table);
  lines.push('');
  lines.push('## Common transitions');
  for (const t of (extra.transitions || []).slice(0, 20)) {
    lines.push(`- ${t.transition}: ${t.count}`);
  }
  return renderLines(lines);
}

function renderClosedDateRuleSection(extra) {
  const lines = [];
  lines.push(`# Closed Date Rule`);
  lines.push('');
  lines.push(`- Winner field: ${extra.winnerField}`);
  const table = renderTable(extra.evidence || [], 20);
  if (table) lines.push(table);
  return renderLines(lines);
}

function renderOrgSettingsSection(extra) {
  const lines = [];
  lines.push(`# Org Settings`);
  lines.push('');
  lines.push('## Organization');
  lines.push('```json');
  lines.push(truncate(JSON.stringify(extra.organization || {}, null, 2), 4000));
  lines.push('```');
  lines.push('');
  lines.push('## Company Information');
  lines.push('```json');
  lines.push(truncate(JSON.stringify(extra.companyInformation || {}, null, 2), 4000));
  lines.push('```');
  return renderLines(lines);
}

function renderQueriesSection(queryRuns, objectName) {
  const lines = [];
  lines.push(`# Query Library (${objectName})`);
  lines.push('');
  for (const q of queryRuns) {
    lines.push(`## ${q.title}`);
    lines.push('Payload:');
    lines.push('```json');
    lines.push(JSON.stringify(q.payload, null, 2));
    lines.push('```');
    if (Array.isArray(q.records) && q.records.length) {
      lines.push('Sample Records:');
      lines.push(renderTable(q.records, 10));
    }
    lines.push('');
  }
  return renderLines(lines);
}

// Build segmented files mapping
function renderInsightsSegments(insights, extras) {
  const objectName = insights.summary && insights.summary.objectName;
  const files = {};
  files['summary.md'] = renderSummarySection(insights);
  files['picklists.md'] = renderPicklistsSection(insights);
  if (extras.stages) files['stages.md'] = renderStagesSection(extras.stages);
  if (extras.validationRules) files['validation_rules.md'] = renderValidationRulesSection(extras.validationRules);
  if (extras.requirements) files['requirements.md'] = renderRequirementsSection(extras.requirements);
  if (extras.formulas) files['formulas.md'] = renderFormulasSection(extras.formulas, objectName);
  if (extras.automations) files['automations.md'] = renderAutomationsSection(extras.automations, objectName);
  if (extras.listViews) files['list_views.md'] = renderListViewsSection(extras.listViews, objectName);
  if (extras.usage) files['usage.md'] = renderUsageSection(extras.usage, objectName);
  if (extras.stageHistory) files['stage_history.md'] = renderStageHistorySection(extras.stageHistory);
  if (extras.closedDateRule) files['closed_date_rule.md'] = renderClosedDateRuleSection(extras.closedDateRule);
  if (extras.orgSettings) files['org_settings.md'] = renderOrgSettingsSection(extras.orgSettings);
  if (Array.isArray(extras.queryRuns)) files['queries.md'] = renderQueriesSection(extras.queryRuns, objectName);
  return files;
}

module.exports.renderInsightsSegments = renderInsightsSegments;