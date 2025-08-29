#!/usr/bin/env node
'use strict';

/**
 * Optimized Chat Test - Test the performance-optimized chat agent
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function testOptimizedChat() {
  console.log('🚀 OPTIMIZED CHAT AGENT TEST');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Initialize
    const client = new SFDCHelperClient('http://localhost:3000');
    await client.health();
    console.log('✅ Client connected');
    
    const agent = new ChatAgent(client, {
      agentName: 'OptimizedBot',
      model: 'gpt-3.5-turbo',
      temperature: 0.7
    });
    console.log('✅ Agent initialized');
    
    // Test the optimized chat pipeline
    console.log('\n🎯 Testing optimized chat pipeline...');
    const query = "Show me opportunities with likelihood scores";
    const testStart = Date.now();
    
    const response = await agent.processMessage('test_user', query);
    const testTime = Date.now() - testStart;
    
    console.log(`⚡ Chat response time: ${testTime}ms (${(testTime/1000).toFixed(1)}s)`);
    console.log(`\n📊 Results:`);
    console.log(`   Function called: ${response.functionCalled || 'None'}`);
    console.log(`   Records found: ${response.functionResult?.recordCount || 0}`);
    console.log(`   Fields used: ${response.functionResult?.orgContext?.fieldsUsed?.length || 0}`);
    console.log(`   Custom fields used: ${response.functionResult?.orgContext?.customFieldsUsed?.length || 0}`);
    
    if (response.functionResult?.orgContext?.customFieldsUsed?.length > 0) {
      console.log(`   Custom fields: ${response.functionResult.orgContext.customFieldsUsed.join(', ')}`);
    }
    
    console.log(`\n🤖 Response:`);
    console.log(`   "${response.response}"`);
    
    // Test another query
    console.log('\n🎯 Testing another query...');
    const query2 = "Find closed won opportunities";
    const test2Start = Date.now();
    
    const response2 = await agent.processMessage('test_user', query2);
    const test2Time = Date.now() - test2Start;
    
    console.log(`⚡ Second response time: ${test2Time}ms (${(test2Time/1000).toFixed(1)}s)`);
    console.log(`📊 Records: ${response2.functionResult?.recordCount || 0}`);
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log('✅ Optimized test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

if (require.main === module) {
  testOptimizedChat();
}

module.exports = testOptimizedChat;
