#!/usr/bin/env node
'use strict';

/**
 * SFDC Helper Client SDK Usage Examples
 * 
 * This demonstrates how easy it is to build org-aware chatbot integrations
 * using the SFDC Helper Client SDK.
 */

const SFDCHelperClient = require('../src/client');

async function examples() {
  // Initialize client
  const client = new SFDCHelperClient('http://localhost:3000');
  
  try {
    console.log('🚀 SFDC Helper Client SDK Examples\n');
    
    // 1. Health check and org info
    console.log('1. Getting org information...');
    const health = await client.health();
    console.log('Health:', health.status);
    
    const orgInfo = await client.getOrgInfo();
    console.log('Org:', orgInfo.identity.organization_id);
    console.log('User:', orgInfo.identity.display_name);
    
    // 2. Discover what's available in this org
    console.log('\n2. Discovering org capabilities...');
    const allowlistStats = await client.getAllowlistStats();
    if (allowlistStats.dynamic) {
      console.log('Dynamic discovery active!');
      Object.entries(allowlistStats.stats).forEach(([obj, stats]) => {
        console.log(`  ${obj}: ${stats.totalFields} fields (${stats.staticFields} static + ${stats.discoveredFields} discovered)`);
      });
    }
    
    // 3. Get available fields for Opportunity (org-aware)
    console.log('\n3. Getting available Opportunity fields...');
    const oppFields = await client.getAvailableFields('Opportunity');
    console.log(`Found ${oppFields.length} available fields:`, oppFields.slice(0, 10).join(', '), '...');
    
    // 4. Simple safe query
    console.log('\n4. Running a simple safe query...');
    const recentOpps = await client.safeQuery('Opportunity', {
      where: [
        { field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:30' }
      ],
      limit: 5,
      flatten: true
    });
    console.log(`Found ${recentOpps.records?.length || 0} recent opportunities`);
    if (recentOpps.records?.[0]) {
      console.log('Sample record fields:', Object.keys(recentOpps.records[0]));
    }
    
    // 5. Smart query with natural language intent
    console.log('\n5. Building smart query from intent...');
    const smartQuery = await client.buildSmartQuery('Opportunity', 'show me open opportunities');
    console.log('Intent:', smartQuery.intent);
    console.log('Matched suggestion:', smartQuery.suggestion?.title || 'None (using fallback)');
    console.log('Query fields:', smartQuery.query.fields.slice(0, 5).join(', '), '...');
    
    // Execute the smart query
    const smartResults = await client.executeSmartQuery('Opportunity', 'show me recent deals');
    console.log(`Smart query returned ${smartResults.results.records?.length || 0} records`);
    
    // 6. Get object insights
    console.log('\n6. Getting object insights...');
    const insights = await client.getObjectInsights('Opportunity');
    console.log('Object insights:');
    console.log(`  Fields: ${insights.summary?.fieldCount || 0}`);
    console.log(`  Record types: ${insights.recordTypes?.length || 0}`);
    console.log(`  Suggestions: ${insights.suggestions?.length || 0}`);
    
    // 7. Analytics
    console.log('\n7. Getting field usage analytics...');
    const topFields = await client.getTopFields('Opportunity', 5);
    console.log('Top 5 most-used fields:', topFields.map(f => f.field).join(', '));
    
    // 8. Generate context bundle (org learning)
    console.log('\n8. Generating context bundle to improve org awareness...');
    const contextBundle = await client.generateContextBundle('Opportunity', {
      persist: true,
      runQueries: true,
      sample: 10
    });
    console.log('Context bundle generated:', contextBundle.files?.join(', '));
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running examples:', error.message);
    if (error.status) {
      console.error('HTTP Status:', error.status);
    }
  }
}

// Chatbot integration example
async function chatbotExample() {
  console.log('\n🤖 Chatbot Integration Example\n');
  
  const client = new SFDCHelperClient('http://localhost:3000');
  
  // Simulate chatbot queries
  const queries = [
    'show me recent opportunities',
    'find open cases',
    'get my tasks',
    'show leads from last week'
  ];
  
  for (const query of queries) {
    try {
      console.log(`User: "${query}"`);
      
      // Extract object from query (simple pattern matching)
      let objectName = 'Opportunity'; // default
      if (query.includes('case')) objectName = 'Case';
      if (query.includes('task')) objectName = 'Task';
      if (query.includes('lead')) objectName = 'Lead';
      
      // Use smart query to understand intent
      const result = await client.executeSmartQuery(objectName, query, { limit: 3 });
      
      console.log(`Bot: Found ${result.results.records?.length || 0} ${objectName.toLowerCase()}s`);
      if (result.suggestion) {
        console.log(`     (Used suggestion: "${result.suggestion.title}")`);
      }
      console.log('');
      
    } catch (error) {
      console.log(`Bot: Sorry, I couldn't process that query: ${error.message}\n`);
    }
  }
}

if (require.main === module) {
  examples()
    .then(() => chatbotExample())
    .catch(console.error);
}

module.exports = { examples, chatbotExample };
