#!/usr/bin/env node
'use strict';

/**
 * Verbose Debug Test - Show exactly what's happening behind the scenes
 * 
 * This test breaks down every step with detailed timing to identify bottlenecks:
 * - Salesforce API calls
 * - OpenAI API calls  
 * - Field discovery processes
 * - Query construction
 * - Response processing
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

class VerboseDebugTest {
  constructor() {
    this.sfdcClient = new SFDCHelperClient('http://localhost:3000');
    this.chatAgent = null;
    this.userId = 'debug_test_' + Date.now();
    this.totalStartTime = Date.now();
  }

  log(message, startTime = null) {
    const now = Date.now();
    const elapsed = startTime ? `(${now - startTime}ms)` : '';
    const total = `[+${now - this.totalStartTime}ms]`;
    console.log(`${total} ${message} ${elapsed}`);
  }

  async runDebugTest() {
    console.log('🔍 VERBOSE DEBUG TEST - Behind the Scenes Analysis');
    console.log('=' .repeat(70));
    console.log(`Started at: ${new Date().toLocaleTimeString()}\n`);

    try {
      // Step 1: Initialize connections
      this.log('🚀 Step 1: Initializing connections...');
      let stepStart = Date.now();
      
      await this.sfdcClient.health();
      this.log('✅ SFDC Helper health check complete', stepStart);
      
      stepStart = Date.now();
      this.chatAgent = new ChatAgent(this.sfdcClient, {
        agentName: 'DebugBot',
        temperature: 0.7,
        model: 'gpt-3.5-turbo',
        maxHistoryLength: 5
      });
      this.log('✅ ChatAgent initialized', stepStart);

      // Step 2: Test simple Salesforce query (no OpenAI)
      console.log('\n📊 Step 2: Testing direct Salesforce queries...');
      await this.testDirectSalesforceQueries();

      // Step 3: Test LLM adapter without Salesforce
      console.log('\n🤖 Step 3: Testing LLM adapter response...');
      await this.testLlmAdapterResponse();

      // Step 4: Test full chat agent pipeline
      console.log('\n🔗 Step 4: Testing full chat agent pipeline...');
      await this.testFullPipeline();

      // Step 5: Test field discovery overhead
      console.log('\n🔍 Step 5: Testing field discovery overhead...');
      await this.testFieldDiscoveryOverhead();

    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`);
      console.error('\nFull error:', error);
    }

    const totalTime = Date.now() - this.totalStartTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log('✅ Debug test completed!');
  }

  async testDirectSalesforceQueries() {
    // Test 1: Simple allowlist query
    let stepStart = Date.now();
    this.log('  📋 Getting allowlist...');
    
    const allowlist = await this.sfdcClient.getAllowlist();
    this.log(`  ✅ Allowlist retrieved (${Object.keys(allowlist.objects || {}).length} objects)`, stepStart);
    console.log(`      Available objects: ${Object.keys(allowlist.objects || {}).join(', ')}`);
    console.log(`      Opportunity fields in allowlist: ${allowlist.objects?.Opportunity?.fields?.length || 0}`);

    // Test 2: Object describe
    stepStart = Date.now();
    this.log('  📋 Describing Opportunity object...');
    
    const describe = await this.sfdcClient.describeObject('Opportunity');
    const allFields = describe.fields.map(f => f.name);
    const customFields = allFields.filter(f => f.includes('__c'));
    this.log(`  ✅ Object described (${describe.fields.length} fields total)`, stepStart);
    console.log(`      Standard fields: ${allFields.length - customFields.length}`);
    console.log(`      Custom fields: ${customFields.length}`);
    console.log(`      Sample custom fields: ${customFields.slice(0, 5).join(', ')}`);
    console.log(`      Likelihood__c present: ${allFields.includes('Likelihood__c') ? '✅ YES' : '❌ NO'}`);

    // Test 3: Simple safe query
    stepStart = Date.now();
    this.log('  📋 Running simple safe query...');
    console.log(`      Query: SELECT Id, Name, StageName FROM Opportunity LIMIT 3`);
    
    const simpleQuery = await this.sfdcClient.safeQuery('Opportunity', {
      fields: ['Id', 'Name', 'StageName'],
      limit: 3
    });
    this.log(`  ✅ Simple query completed (${simpleQuery.records?.length || 0} records)`, stepStart);
    
    if (simpleQuery.records?.length > 0) {
      console.log(`      Sample record: ${JSON.stringify(simpleQuery.records[0], null, 2)}`);
    }

    // Test 4: Smart query (this might be slow)
    stepStart = Date.now();
    this.log('  📋 Running smart query (this may take a while)...');
    console.log(`      Intent: "recent opportunities"`);
    console.log(`      Options: { limit: 3 }`);
    
    try {
      const smartQuery = await this.sfdcClient.executeSmartQuery('Opportunity', 'recent opportunities', {
        limit: 3
      });
      this.log(`  ✅ Smart query completed (${smartQuery.results?.records?.length || 0} records)`, stepStart);
      
      console.log(`      Generated SOQL: ${smartQuery.query || 'Not provided'}`);
      console.log(`      Suggestion used: ${smartQuery.suggestion?.title || 'None'}`);
      console.log(`      Full response structure: ${Object.keys(smartQuery).join(', ')}`);
      
      if (smartQuery.results?.records?.length > 0) {
        console.log(`      Sample record fields: ${Object.keys(smartQuery.results.records[0]).join(', ')}`);
        console.log(`      Sample record: ${JSON.stringify(smartQuery.results.records[0], null, 2)}`);
      }
      
      if (smartQuery.error) {
        console.log(`      ❌ Error: ${smartQuery.error}`);
      }
    } catch (error) {
      this.log(`  ❌ Smart query failed: ${error.message}`, stepStart);
      console.log(`      Full error: ${error.stack}`);
    }
  }

  async testLlmAdapterResponse() {
    const { HttpLlmAdapter } = require('../src/chat/LlmAdapter');
    const url = process.env.LLM_HTTP_URL;
    if (!url) {
      this.log('  ⚠️  Skipping: LLM_HTTP_URL not set');
      return;
    }
    // Test 1: Simple adapter call
    let stepStart = Date.now();
    this.log('  🤖 Simple LLM adapter call...');
    const adapter = new HttpLlmAdapter(url);
    const simpleResponse = await adapter.createChatCompletion({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello, this is a test. Please respond briefly.' }],
      maxTokens: 50
    });
    this.log(`  ✅ Simple adapter call completed`, stepStart);
    console.log(`      Response: "${simpleResponse.choices[0].message.content || ''}"`);

    // Test 2: Adapter with tool definitions (no actual function execution)
    stepStart = Date.now();
    this.log('  🤖 LLM adapter with tool definitions...');
    const functionResponse = await adapter.createChatCompletion({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'You are a Salesforce assistant. You have access to query functions.' },
        { role: 'user', content: 'Show me some opportunities' }
      ],
      tools: [
        {
          name: 'query_salesforce',
          parameters: { type: 'object', properties: { objectName: { type: 'string' }, intent: { type: 'string' } } }
        }
      ],
      toolChoice: 'auto'
    });
    this.log(`  ✅ Adapter tool call completed`, stepStart);
    
    if (functionResponse.choices[0].message.function_call) {
      console.log(`      Function called: ${functionResponse.choices[0].message.function_call.name}`);
      console.log(`      Arguments: ${functionResponse.choices[0].message.function_call.arguments}`);
    } else {
      console.log(`      Response: "${functionResponse.choices[0].message.content || ''}"`);
    }
  }

  async testFullPipeline() {
    // Test the complete chat agent pipeline with detailed timing
    const query = "Show me opportunities with likelihood scores";
    
    this.log(`  🔗 Starting full pipeline for: "${query}"`);
    let pipelineStart = Date.now();
    
    try {
      // We'll manually trace through the ChatAgent.processMessage method
      this.log('  📋 Getting org context...');
      let stepStart = Date.now();
      const orgContext = await this.chatAgent.getOrgContext();
      this.log(`  ✅ Org context retrieved (${orgContext.objects?.length || 0} objects)`, stepStart);
      console.log(`      Org objects: ${orgContext.objects?.join(', ')}`);
      console.log(`      Dynamic discovery: ${orgContext.dynamicDiscovery ? 'Active' : 'Inactive'}`);

      this.log('  📋 Building system prompt...');
      stepStart = Date.now();
      const systemPrompt = this.chatAgent.buildSystemPrompt(this.userId, orgContext);
      this.log(`  ✅ System prompt built (${systemPrompt.length} chars)`, stepStart);
      console.log(`      System prompt preview: "${systemPrompt.substring(0, 200)}..."`);

      this.log('  🤖 Calling ChatAgent.processMessage (this may take a while)...');
      console.log(`      Query: "${query}"`);
      console.log(`      User ID: ${this.userId}`);
      
      stepStart = Date.now();
      const response = await this.chatAgent.processMessage(this.userId, query);
      this.log(`  ✅ Full pipeline completed`, stepStart);
      
      console.log(`\n  📊 Detailed Pipeline Results:`);
      console.log(`     Response length: ${response.response?.length || 0} characters`);
      console.log(`     Function called: ${response.functionCalled || 'None'}`);
      console.log(`     Records found: ${response.functionResult?.recordCount || 0}`);
      
      if (response.functionResult) {
        const result = response.functionResult;
        console.log(`     Generated query: ${result.query || 'Not provided'}`);
        console.log(`     Fields used: ${result.fieldsUsed?.join(', ') || 'None'}`);
        
        if (result.orgContext) {
          const ctx = result.orgContext;
          console.log(`     Total fields in org: ${ctx.totalFieldsInOrg || 0}`);
          console.log(`     Custom fields in org: ${ctx.customFieldsInOrg || 0}`);
          console.log(`     Custom fields used: ${ctx.customFieldsUsed?.join(', ') || 'None'}`);
        }
        
        if (result.records?.length > 0) {
          console.log(`     Sample record fields: ${Object.keys(result.records[0]).join(', ')}`);
          console.log(`     Sample record: ${JSON.stringify(result.records[0], null, 2)}`);
        }
      }

      console.log(`\n  🤖 Full Response:`);
      console.log(`     "${response.response}"`);

    } catch (error) {
      this.log(`  ❌ Pipeline failed: ${error.message}`, pipelineStart);
      console.log(`      Full error: ${error.stack}`);
      throw error;
    }
  }

  async testFieldDiscoveryOverhead() {
    // Compare different field discovery approaches
    
    // Method 1: Allowlist approach (current)
    this.log('  📋 Method 1: Using allowlist...');
    let stepStart = Date.now();
    
    const allowlistFields = await this.sfdcClient.getAvailableFields('Opportunity');
    this.log(`  ✅ Allowlist fields: ${allowlistFields.length} fields`, stepStart);

    // Method 2: Full describe approach (new)
    this.log('  📋 Method 2: Using full describe...');
    stepStart = Date.now();
    
    const describe = await this.sfdcClient.describeObject('Opportunity');
    const allFields = describe.fields.map(f => f.name);
    const customFields = allFields.filter(f => f.includes('__c'));
    this.log(`  ✅ Full describe: ${allFields.length} total fields (${customFields.length} custom)`, stepStart);

    // Method 3: Insights query
    this.log('  📋 Method 3: Getting insights...');
    stepStart = Date.now();
    
    const insights = await this.sfdcClient.getObjectInsights('Opportunity');
    this.log(`  ✅ Insights retrieved`, stepStart);

    console.log(`\n  📊 Field Discovery Comparison:`);
    console.log(`     Allowlist fields: ${allowlistFields.length}`);
    console.log(`     Total org fields: ${allFields.length}`);
    console.log(`     Custom fields available: ${customFields.length}`);
    console.log(`     Likelihood__c found: ${allFields.includes('Likelihood__c') ? '✅ Yes' : '❌ No'}`);
    
    if (customFields.length > 0) {
      console.log(`     Sample custom fields: ${customFields.slice(0, 5).join(', ')}`);
    }

    // Test intelligent field selection
    this.log('  🧠 Testing intelligent field selection...');
    stepStart = Date.now();
    
    const selectedFields = this.chatAgent.selectIntelligentFields(
      'Opportunity', 
      'show me opportunities with likelihood scores',
      allFields,
      customFields
    );
    this.log(`  ✅ Intelligent selection: ${selectedFields.length} fields chosen`, stepStart);
    console.log(`     Selected fields: ${selectedFields.join(', ')}`);
  }
}

async function main() {
  const tester = new VerboseDebugTest();
  
  try {
    await tester.runDebugTest();
  } catch (error) {
    console.error('\n💥 Debug test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = VerboseDebugTest;
