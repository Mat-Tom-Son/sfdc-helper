#!/usr/bin/env node
'use strict';

/**
 * Quick Org-Aware Test - Test the enhanced org intelligence
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function quickTest() {
  console.log('🔍 Quick Org-Aware Intelligence Test\n');
  
  const sfdcClient = new SFDCHelperClient('http://localhost:3000');
  const chatAgent = new ChatAgent(sfdcClient, {
    agentName: 'OrgBot',
    temperature: 0.7,
    model: 'gpt-3.5-turbo', // Fast model
    maxHistoryLength: 5
  });

  try {
    // Test 1: Check what fields are available
    console.log('📋 Available Opportunity Fields:');
    const fields = await sfdcClient.getAvailableFields('Opportunity');
    console.log(`   Total: ${fields.length} fields`);
    
    const customFields = fields.filter(f => f.includes('__c'));
    console.log(`   Custom: ${customFields.length} fields`);
    if (customFields.length > 0) {
      console.log(`   Examples: ${customFields.slice(0, 5).join(', ')}`);
    }
    
    // Test 2: Quick query with org-aware response
    console.log('\n💬 Testing Org-Aware Response:');
    console.log('Query: "What fields do you have access to for opportunities?"');
    
    const startTime = Date.now();
    const response = await chatAgent.processMessage(
      'test_user', 
      "What fields do you have access to for opportunities?"
    );
    const duration = Date.now() - startTime;
    
    console.log(`\n🤖 Response (${duration}ms):`);
    console.log(`"${response.response}"`);
    
    if (response.functionResult?.orgContext) {
      console.log('\n📊 Org Context Detected:');
      console.log(`   Available Fields: ${response.functionResult.orgContext.availableFields}`);
      console.log(`   Custom Fields: ${response.functionResult.orgContext.customFields?.length || 0}`);
      if (response.functionResult.orgContext.customFields?.length > 0) {
        console.log(`   Custom Examples: ${response.functionResult.orgContext.customFields.slice(0, 3).join(', ')}`);
      }
    }
    
    // Test 3: Check if Likelihood__c is available
    console.log('\n🎯 Likelihood Field Check:');
    const hasLikelihood = fields.includes('Likelihood__c');
    console.log(`   Likelihood__c available: ${hasLikelihood ? '✅ Yes' : '❌ No'}`);
    
    if (hasLikelihood) {
      console.log('\n💡 Testing likelihood-aware query:');
      const likelihoodResponse = await chatAgent.processMessage(
        'test_user',
        "Show me opportunities with their likelihood scores"
      );
      console.log(`🤖 Likelihood Response: "${likelihoodResponse.response.substring(0, 200)}..."`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  quickTest();
}
