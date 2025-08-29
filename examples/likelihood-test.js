#!/usr/bin/env node
'use strict';

/**
 * Likelihood Field Test - Direct test using all org fields
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function testLikelihood() {
  console.log('🎯 Testing Likelihood__c Field Access\n');
  
  const sfdcClient = new SFDCHelperClient('http://localhost:3000');
  
  try {
    // Get ALL fields from describe (not just allowlist)
    console.log('📋 Getting all Opportunity fields from org...');
    const describe = await sfdcClient.describeObject('Opportunity');
    const allFields = describe.fields.map(f => f.name);
    
    console.log(`   Total fields in org: ${allFields.length}`);
    
    // Check for custom fields
    const customFields = allFields.filter(f => f.includes('__c'));
    console.log(`   Custom fields: ${customFields.length}`);
    
    // Look for likelihood
    const likelihoodFields = allFields.filter(f => f.toLowerCase().includes('likelihood'));
    console.log(`   Likelihood fields: ${likelihoodFields.join(', ') || 'None found'}`);
    
    if (likelihoodFields.length > 0) {
      console.log('\n💡 Testing direct query with likelihood field...');
      
      // Create a safe query with likelihood
      const testFields = ['Id', 'Name', 'StageName', 'Amount', likelihoodFields[0]];
      
      const result = await sfdcClient.safeQuery('Opportunity', {
        fields: testFields,
        limit: 3
      });
      
      console.log(`✅ Successfully queried with ${likelihoodFields[0]}!`);
      console.log(`   Records returned: ${result.records?.length || 0}`);
      
      if (result.records?.length > 0) {
        const sample = result.records[0];
        console.log(`   Sample data: ${JSON.stringify(sample, null, 2)}`);
      }
      
      // Test with chat agent using explicit fields
      console.log('\n🤖 Testing with chat agent...');
      const chatAgent = new ChatAgent(sfdcClient, {
        agentName: 'LikelihoodBot',
        model: 'gpt-3.5-turbo',
        temperature: 0.7
      });
      
      const response = await chatAgent.processMessage(
        'test_user',
        "Show me opportunities with their likelihood scores",
        { fields: testFields }
      );
      
      console.log(`🤖 Chat Response: "${response.response.substring(0, 300)}..."`);
      
    } else {
      console.log('❌ No likelihood fields found in your org');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testLikelihood();
}
