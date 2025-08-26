'use strict';

function manifest(baseUrl) {
  return {
    schema_version: '1.0',
    name_for_humans: 'Salesforce Read API',
    name_for_model: 'salesforce_read_api',
    description_for_humans: 'Org-aware, read-only endpoints for Salesforce data (safe SOQL, SOSL, schema, analytics).',
    description_for_model: 'Use these tools to discover org schema, query data safely (allowlisted fields and operators), search via SOSL, and paginate. All endpoints are read-only. Prefer /safe-query with allowed fields and validated operators. Include limit and follow next for pagination.',
    auth: { type: 'none' },
    api: {
      type: 'openapi',
      url: `${baseUrl}/openapi.json`
    },
    endpoints: {
      health: `${baseUrl}/health`,
      me: `${baseUrl}/me`,
      limits: `${baseUrl}/limits`,
      allowlist: `${baseUrl}/allowlist`,
      describe: `${baseUrl}/describe`,
      objectDescribe: `${baseUrl}/sobjects/{name}/describe`,
      picklists: `${baseUrl}/sobjects/{name}/picklists`,
      recentRecords: `${baseUrl}/sobjects/{name}/recent-records`,
      changes: `${baseUrl}/changes/{name}`,
      query: `${baseUrl}/query`,
      safeQuery: `${baseUrl}/safe-query`,
      search: `${baseUrl}/search`,
      analyticsTopFields: `${baseUrl}/analytics/top-fields`,
      analyticsRecentQueries: `${baseUrl}/analytics/queries/recent`,
      objectInsights: `${baseUrl}/objects/{name}/insights`
    }
  };
}

function openapi(baseUrl) {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Salesforce Read API',
      version: '1.0.0'
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/health': { get: { summary: 'Health', responses: { '200': { description: 'OK' } } } },
      '/me': { get: { summary: 'Identity', responses: { '200': { description: 'Identity' } } } },
      '/limits': { get: { summary: 'Limits', responses: { '200': { description: 'Limits' } } } },
      '/allowlist': { get: { summary: 'Allowlisted objects/fields', responses: { '200': { description: 'Allowlist' } } } },
      '/describe': { get: { summary: 'Global describe', responses: { '200': { description: 'Global describe' } } } },
      '/sobjects/{name}/describe': { get: { summary: 'Object describe', parameters: [{ name: 'name', in: 'path', required: true }], responses: { '200': { description: 'Describe' } } } },
      '/sobjects/{name}/picklists': { get: { summary: 'Object picklists', parameters: [{ name: 'name', in: 'path', required: true }], responses: { '200': { description: 'Picklists' } } } },
      '/sobjects/{name}/recent-records': { get: { summary: 'Recent records', parameters: [{ name: 'name', in: 'path', required: true }, { name: 'limit', in: 'query' }], responses: { '200': { description: 'Recent' } } } },
      '/changes/{name}': { get: { summary: 'Changes since timestamp', parameters: [{ name: 'name', in: 'path', required: true }, { name: 'since', in: 'query', required: true }, { name: 'limit', in: 'query' }], responses: { '200': { description: 'Changes' } } } },
      '/query': {
        get: { summary: 'SOQL with pagination', parameters: [{ name: 'soql', in: 'query' }, { name: 'limit', in: 'query' }, { name: 'next', in: 'query' }], responses: { '200': { description: 'Query result' } } },
        post: { summary: 'SOQL via body', requestBody: { required: true }, responses: { '200': { description: 'Query result' } } }
      },
      '/safe-query': { post: { summary: 'Allowlisted safe query', requestBody: { required: true }, responses: { '200': { description: 'Query result' }, '400': { description: 'Validation error' } } } },
      '/search': { post: { summary: 'SOSL search', requestBody: { required: true }, responses: { '200': { description: 'Search result' } } } },
      '/analytics/top-fields': { get: { summary: 'Top fields by usage', parameters: [{ name: 'object', in: 'query' }, { name: 'top', in: 'query' }], responses: { '200': { description: 'Top fields' } } } },
      '/analytics/queries/recent': { get: { summary: 'Recent query analytics', parameters: [{ name: 'limit', in: 'query' }], responses: { '200': { description: 'Recent queries' } } } }
      ,
      '/objects/{name}/insights': { get: { summary: 'Object insights', parameters: [{ name: 'name', in: 'path', required: true }], responses: { '200': { description: 'Insights' } } } },
      '/objects/{name}/insights/run': { post: { summary: 'Execute an insights suggestion', parameters: [{ name: 'name', in: 'path', required: true }], requestBody: { required: true }, responses: { '200': { description: 'Result' } } } }
      ,
      '/objects/{name}/context': { post: { summary: 'Generate object context markdown', parameters: [{ name: 'name', in: 'path', required: true }], requestBody: { required: false }, responses: { '200': { description: 'Markdown' } } } }
      ,
      '/reports/top': { get: { summary: 'Top recent reports', parameters: [{ name: 'limit', in: 'query' }], responses: { '200': { description: 'Top reports' } } } },
      '/reports/{id}/describe': { get: { summary: 'Report describe', parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: 'Describe' } } } },
      '/reports/{id}/run': { get: { summary: 'Run report', parameters: [{ name: 'id', in: 'path', required: true }, { name: 'format', in: 'query' }, { name: 'includeDetails', in: 'query' }], responses: { '200': { description: 'Report data' } } } }
    }
  };
}

module.exports = { manifest, openapi };


