#!/usr/bin/env node
'use strict';

/**
 * Fast Debug Test - Quick analysis without the slow parts
 * 
 * This test focuses on the core functionality without the 85-second bottleneck
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

class FastDebugTest {
  constructor() {
    this.sfdcClient = new SFDCHelperClient('http://localhost:3000');
    this.chatAgent = null;
    this.userId = 'fast_test_' + Date.now();
    this.totalStartTime = Date.now();
  }

  log(message, startTime = null) {
    const now = Date.now();
    const elapsed = startTime ? `(${now - startTime}ms)` : '';
    const total = `[+${now - this.totalStartTime}ms]`;
    console.log(`${total} ${message} ${elapsed}`);
  }

  async runFastTest() {
    console.log('⚡ FAST DEBUG TEST - Core Functionality Analysis');
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
        agentName: 'FastBot',
        temperature: 0.7,
        model: 'gpt-3.5-turbo',
        maxHistoryLength: 5
      });
      this.log('✅ ChatAgent initialized', stepStart);

      // Step 2: Test core Salesforce operations (skip slow insights)
      console.log('\n📊 Step 2: Testing core Salesforce operations...');
      await this.testCoreSalesforceOperations();

      // Step 3: Test field discovery and custom field detection
      console.log('\n🔍 Step 3: Testing field discovery...');
      await this.testFieldDiscovery();

      // Step 4: Test LLM adapter integration (optional)
      console.log('\n🤖 Step 4: Testing LLM adapter integration...');
      await this.testLlmAdapterIntegration();

      // Step 5: Test direct query with custom fields
      console.log('\n🎯 Step 5: Testing custom field queries...');
      await this.testCustomFieldQueries();

    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`);
      console.error('\nFull error:', error);
    }

    const totalTime = Date.now() - this.totalStartTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log('✅ Fast test completed!');
  }

  async testCoreSalesforceOperations() {
    // Test 1: Allowlist
    let stepStart = Date.now();
    this.log('  📋 Getting allowlist...');
    const allowlist = await this.sfdcClient.getAllowlist();
    this.log(`  ✅ Allowlist: ${Object.keys(allowlist.objects || {}).length} objects`, stepStart);
    console.log(`      Objects: ${Object.keys(allowlist.objects || {}).join(', ')}`);

    // Test 2: Object describe (the good part)
    stepStart = Date.now();
    this.log('  📋 Describing Opportunity...');
    const describe = await this.sfdcClient.describeObject('Opportunity');
    const allFields = describe.fields.map(f => f.name);
    const customFields = allFields.filter(f => f.includes('__c'));
    this.log(`  ✅ Describe: ${allFields.length} fields (${customFields.length} custom)`, stepStart);
    
    console.log(`      Total fields: ${allFields.length}`);
    console.log(`      Custom fields: ${customFields.length}`);
    console.log(`      Likelihood__c found: ${allFields.includes('Likelihood__c') ? '✅ YES' : '❌ NO'}`);
    if (customFields.length > 0) {
      console.log(`      Sample custom: ${customFields.slice(0, 5).join(', ')}`);
    }

    // Test 3: Simple query
    stepStart = Date.now();
    this.log('  📋 Simple query with custom fields...');
    const query = {
      object: 'Opportunity',
      fields: ['Id', 'Name', 'StageName', 'Amount', 'Likelihood__c'],
      limit: 2
    };
    console.log(`      Query: ${JSON.stringify(query, null, 2)}`);
    
    try {
      const result = await this.sfdcClient.safeQuery('Opportunity', query);
      this.log(`  ✅ Query: ${result.records?.length || 0} records`, stepStart);
      
      if (result.records?.length > 0) {
        console.log(`      Sample record fields: ${Object.keys(result.records[0]).join(', ')}`);
        console.log(`      Sample record: ${JSON.stringify(result.records[0], null, 2)}`);
      }
    } catch (error) {
      this.log(`  ❌ Query failed: ${error.message}`, stepStart);
      console.log(`      Error details: ${error.stack}`);
    }
  }

  async testFieldDiscovery() {
    // Test allowlist vs describe comparison
    let stepStart = Date.now();
    this.log('  🔍 Comparing field discovery methods...');
    
    const allowlistFields = await this.sfdcClient.getAvailableFields('Opportunity');
    const describe = await this.sfdcClient.describeObject('Opportunity');
    const allFields = describe.fields.map(f => f.name);
    const customFields = allFields.filter(f => f.includes('__c'));
    
    this.log(`  ✅ Field discovery comparison complete`, stepStart);
    
    console.log(`      Allowlist fields: ${allowlistFields.length}`);
    console.log(`      Full org fields: ${allFields.length}`);
    console.log(`      Missing from allowlist: ${allFields.length - allowlistFields.length}`);
    console.log(`      Custom fields available: ${customFields.length}`);
    
    // Test intelligent field selection
    stepStart = Date.now();
    const selectedFields = this.chatAgent.selectIntelligentFields(
      'Opportunity', 
      'show opportunities with likelihood scores',
      allFields,
      customFields
    );
    this.log(`  ✅ Intelligent selection: ${selectedFields.length} fields`, stepStart);
    console.log(`      Selected: ${selectedFields.join(', ')}`);
  }

  async testLlmAdapterIntegration() {
    const { HttpLlmAdapter } = require('../src/chat/LlmAdapter');
    const url = process.env.LLM_HTTP_URL;
    if (!url) {
      this.log('  ⚠️  Skipping: LLM_HTTP_URL not set');
      return;
    }
    const adapter = new HttpLlmAdapter(url);
    let stepStart = Date.now();
    this.log('  🤖 Testing LLM adapter call...');
    const response = await adapter.createChatCompletion({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'You are a Salesforce assistant.' },
        { role: 'user', content: 'Show me opportunities with high likelihood scores' }
      ],
      tools: [
        {
          name: 'query_salesforce',
          parameters: { type: 'object', properties: { objectName: { type: 'string' }, intent: { type: 'string' } }, required: ['objectName','intent'] }
        }
      ],
      toolChoice: 'auto',
      temperature: 0.2,
      maxTokens: 200
    });
    this.log(`  ✅ LLM adapter call complete`, stepStart);
    const choice = response.choices[0];
    if (choice.message.function_call) {
      console.log(`      Function: ${choice.message.function_call.name}`);
      console.log(`      Arguments: ${choice.message.function_call.arguments}`);
    } else {
      console.log(`      Content: ${choice.message.content}`);
    }
  }

  async testCustomFieldQueries() {
    // Test direct custom field access
    let stepStart = Date.now();
    this.log('  🎯 Testing Likelihood__c access...');
    
    try {
      // Test if we can query Likelihood__c directly
      const result = await this.sfdcClient.safeQuery('Opportunity', {
        fields: ['Id', 'Name', 'StageName', 'Likelihood__c'],
        where: [{ field: 'Likelihood__c', op: '!=', value: null }],
        limit: 5
      });
      
      this.log(`  ✅ Likelihood__c query: ${result.records?.length || 0} records`, stepStart);
      
      if (result.records?.length > 0) {
        console.log(`      Records with Likelihood__c:`);
        result.records.forEach((record, i) => {
          console.log(`        ${i+1}. ${record.Name}: ${record.Likelihood__c}`);
        });
      } else {
        console.log(`      No records found with Likelihood__c values`);
      }
      
    } catch (error) {
      this.log(`  ❌ Likelihood__c query failed: ${error.message}`, stepStart);
      
      // Try without the WHERE clause
      try {
        stepStart = Date.now();
        this.log('  🎯 Trying Likelihood__c without filter...');
        const result = await this.sfdcClient.safeQuery('Opportunity', {
          fields: ['Id', 'Name', 'StageName', 'Likelihood__c'],
          limit: 5
        });
        
        this.log(`  ✅ Likelihood__c query (no filter): ${result.records?.length || 0} records`, stepStart);
        
        if (result.records?.length > 0) {
          console.log(`      Sample records:`);
          result.records.forEach((record, i) => {
            console.log(`        ${i+1}. ${record.Name}: Likelihood__c = ${record.Likelihood__c || 'null'}`);
          });
        }
      } catch (error2) {
        this.log(`  ❌ Likelihood__c query failed again: ${error2.message}`, stepStart);
      }
    }
  }
}

async function main() {
  const tester = new FastDebugTest();
  
  try {
    await tester.runFastTest();
  } catch (error) {
    console.error('\n💥 Fast test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = FastDebugTest;
