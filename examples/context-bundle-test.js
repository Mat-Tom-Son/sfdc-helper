#!/usr/bin/env node
'use strict';

/**
 * Context Bundle Test - Test the context-bundle-aware chat agent
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function testContextBundleChat() {
  console.log('📦 CONTEXT BUNDLE CHAT AGENT TEST');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Initialize
    const client = new SFDCHelperClient('http://localhost:3000');
    await client.health();
    console.log('✅ Client connected');
    
    const agent = new ChatAgent(client, {
      agentName: 'ContextBot',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      bundleDir: 'context_bundles' // Use pre-computed context bundles
    });
    console.log('✅ Agent initialized with context bundle reader');
    
    // Test queries that should match context bundle patterns
    const testQueries = [
      'Show me recent opportunities',
      'What are the opportunities in our pipeline?', 
      'Show me deals closing this quarter',
      'Find opportunities with high likelihood',
      'Show me closed won deals'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🎯 Testing: "${query}"`);
      const testStart = Date.now();
      
      const response = await agent.processMessage('test_user', query);
      const testTime = Date.now() - testStart;
      
      console.log(`⚡ Response time: ${testTime}ms (${(testTime/1000).toFixed(1)}s)`);
      console.log(`📊 Results:`);
      console.log(`   Function called: ${response.functionCalled || 'None'}`);
      console.log(`   Records found: ${response.functionResult?.recordCount || 0}`);
      console.log(`   Bundle used: ${response.functionResult?.bundleUsed ? '✅ YES' : '❌ NO'}`);
      console.log(`   Query type: ${response.functionResult?.queryType || 'unknown'}`);
      
      if (response.functionResult?.suggestion) {
        console.log(`   Bundle pattern: ${response.functionResult.suggestion.title}`);
      }
      
      console.log(`\n🤖 Response preview:`);
      console.log(`   "${response.response?.substring(0, 150)}..."`);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log('✅ Context bundle test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

if (require.main === module) {
  testContextBundleChat();
}

module.exports = testContextBundleChat;
