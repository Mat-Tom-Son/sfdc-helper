'use strict';

function toolsSchema(baseUrl) {
  return {
    schema_version: '1.0',
    tools: [
      {
        name: 'sf_allowlist',
        description: 'List allowlisted objects and fields',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/allowlist`,
        input_schema: { type: 'object', properties: {}, additionalProperties: false }
      },
      {
        name: 'sf_object_insights',
        description: 'Summarize an object: fields, picklists, sample records, and usage',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/objects/{name}/insights`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_object_insights_run',
        description: 'Execute an insights suggestion via safe-query and return JSON/NDJSON/CSV',
        type: 'http',
        method: 'POST',
        url: `${baseUrl}/objects/{name}/insights/run`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            suggestion: { type: 'object' },
            fields: { type: 'array', items: { type: 'string' } },
            format: { type: 'string', enum: ['json','ndjson','csv'] }
          },
          required: ['name','suggestion'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_object_context_markdown',
        description: 'Generate markdown context for an object; can persist to disk',
        type: 'http',
        method: 'POST',
        url: `${baseUrl}/objects/{name}/context`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' }, persist: { type: 'boolean' }, dir: { type: 'string' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_describe_object',
        description: 'Describe a Salesforce object',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/describe`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_picklists',
        description: 'Get picklist values for an object',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/picklists`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_stages',
        description: 'Get stages for an object (Opportunity uses OpportunityStage mapping)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/stages`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_validation_rules',
        description: 'List validation rules for an object (Tooling API, read-only)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/validation-rules`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_list_views',
        description: 'List list views for an object, optionally include describe details',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/list-views`,
        path_params: ['name'],
        input_schema: {
          type: 'object',
          properties: { name: { type: 'string' }, limit: { type: 'integer' }, describe: { type: 'boolean' } },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_opportunity_stage_history',
        description: 'Stage history metrics for Opportunity (average days per stage, common transitions)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/Opportunity/stage-history`,
        input_schema: {
          type: 'object',
          properties: { limitOpps: { type: 'integer' } },
          additionalProperties: false
        }
      },
      {
        name: 'sf_safe_query',
        description: 'Run an allowlisted, read-only SOQL query with validation and optional flattening',
        type: 'http',
        method: 'POST',
        url: `${baseUrl}/safe-query`,
        input_schema: {
          type: 'object',
          properties: {
            object: { type: 'string' },
            fields: { type: 'array', items: { type: 'string' } },
            where: {
              oneOf: [
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      op: { type: 'string' },
                      value: {}
                    },
                    required: ['field', 'op', 'value'],
                    additionalProperties: false
                  }
                },
                { type: 'object', additionalProperties: {} }
              ]
            },
            orderBy: {
              oneOf: [
                { type: 'object', properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['ASC','DESC'] } }, required: ['field'] },
                { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['ASC','DESC'] } }, required: ['field'] } }
              ]
            },
            limit: { type: 'integer', minimum: 1 },
            flatten: { type: 'boolean' }
          },
          required: ['object'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_query',
        description: 'Run raw SOQL (read-only), prefer sf_safe_query when possible',
        type: 'http',
        method: 'POST',
        url: `${baseUrl}/query`,
        input_schema: {
          type: 'object',
          properties: { soql: { type: 'string' }, limit: { type: 'integer', minimum: 1 } },
          required: ['soql'],
          additionalProperties: false
        }
      },
      {
        name: 'sf_search',
        description: 'Run SOSL search',
        type: 'http',
        method: 'POST',
        url: `${baseUrl}/search`,
        input_schema: { type: 'object', properties: { sosl: { type: 'string' } }, required: ['sosl'], additionalProperties: false }
      },
      {
        name: 'sf_recent_records',
        description: 'Get user-centric recent records for an object',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/recent-records`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' }, limit: { type: 'integer' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_changes_since',
        description: 'List changes since a timestamp (SystemModstamp/LastModifiedDate)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/changes/{name}`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' }, since: { type: 'string' }, limit: { type: 'integer' } }, required: ['name','since'], additionalProperties: false }
      },
      {
        name: 'sf_reports_top',
        description: 'List top recently run reports',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/reports/top`,
        input_schema: { type: 'object', properties: { limit: { type: 'integer' } }, additionalProperties: false }
      },
      {
        name: 'sf_report_describe',
        description: 'Describe a report structure and filters',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/reports/{id}/describe`,
        path_params: ['id'],
        input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }
      },
      {
        name: 'sf_report_run',
        description: 'Run a report and return JSON or CSV (read-only)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/reports/{id}/run`,
        path_params: ['id'],
        input_schema: { type: 'object', properties: { id: { type: 'string' }, format: { type: 'string', enum: ['json','csv'] }, includeDetails: { type: 'boolean' } }, required: ['id'], additionalProperties: false }
      },
      {
        name: 'sf_org_settings',
        description: 'Get org-level settings (currency, timezone, fiscal year, sandbox, etc.)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/org/settings`,
        input_schema: { type: 'object', properties: {}, additionalProperties: false }
      },
      {
        name: 'sf_requirements',
        description: 'Get always-required fields and stage-gated requirements inferred from validation rules',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/requirements`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_usage',
        description: 'Data quality snapshot: fill rates and picklist usage (sampled)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/usage`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' }, sample: { type: 'integer' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_opportunity_closed_date_rule',
        description: 'Detect dominant closed date field for Opportunity (evidence-based)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/Opportunity/closed-date-rule`,
        input_schema: { type: 'object', properties: { sample: { type: 'integer' } }, additionalProperties: false }
      },
      {
        name: 'sf_formulas',
        description: 'List formula/summary fields for an object (best-effort, read-only)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/formulas`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false }
      },
      {
        name: 'sf_automations',
        description: 'List active Flows and Apex Triggers related to an object (read-only)',
        type: 'http',
        method: 'GET',
        url: `${baseUrl}/sobjects/{name}/automations`,
        path_params: ['name'],
        input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false }
      }
    ]
  };
}

module.exports = { toolsSchema };


