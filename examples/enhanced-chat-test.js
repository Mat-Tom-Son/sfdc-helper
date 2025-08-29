#!/usr/bin/env node
'use strict';

/**
 * Enhanced Chat Test - Test the polished chat agent with improved keyword matching
 * and dynamic custom field queries
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function testEnhancedChat() {
  console.log('✨ ENHANCED CHAT AGENT TEST - Polished Version');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Initialize
    const client = new SFDCHelperClient('http://localhost:3000');
    await client.health();
    console.log('✅ Client connected');
    
    const agent = new ChatAgent(client, {
      agentName: 'PolishedBot',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      bundleDir: 'context_bundles'
    });
    console.log('✅ Agent initialized with enhanced context system');
    
    // Test queries designed to show off the improvements
    const testQueries = [
      // Should now match "Last 30 days" with improved synonym matching
      'Show me recent opportunities',
      
      // Should match "Open pipeline" 
      'What deals are currently active?',
      
      // Should match "Closing this quarter"
      'Which opportunities are finishing this quarter?',
      
      // Should use dynamic custom field query for likelihood
      'Find opportunities with high likelihood scores',
      
      // Should use dynamic custom field query for likelihood
      'Show me deals with good probability ratings',
      
      // Should use intelligent fallback
      'Find closed won deals from last month'
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🎯 Test ${i+1}: "${query}"`);
      const testStart = Date.now();
      
      try {
        const response = await agent.processMessage('test_user', query);
        const testTime = Date.now() - testStart;
        
        console.log(`⚡ Response time: ${testTime}ms (${(testTime/1000).toFixed(1)}s)`);
        console.log(`📊 Results:`);
        console.log(`   Function called: ${response.functionCalled || 'None'}`);
        console.log(`   Records found: ${response.functionResult?.recordCount || 0}`);
        
        // Show which system was used
        if (response.functionResult?.bundleUsed) {
          console.log(`   🎯 Used: Context Bundle (${response.functionResult.suggestion?.title})`);
        } else if (response.functionResult?.dynamicQuery) {
          console.log(`   🧠 Used: Dynamic Custom Field Query (${response.functionResult.suggestion?.title})`);
        } else {
          console.log(`   ⚙️  Used: Intelligent Field Selection`);
        }
        
        console.log(`   Query type: ${response.functionResult?.queryType || 'unknown'}`);
        
        if (response.functionResult?.query?.fields) {
          const customFieldsInQuery = response.functionResult.query.fields.filter(f => f.includes('__c'));
          if (customFieldsInQuery.length > 0) {
            console.log(`   🔧 Custom fields used: ${customFieldsInQuery.join(', ')}`);
          }
        }
        
        console.log(`\n🤖 Response preview:`);
        console.log(`   "${response.response?.substring(0, 200)}..."`);
        
      } catch (error) {
        console.log(`❌ Query failed: ${error.message}`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log('✨ Enhanced test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

if (require.main === module) {
  testEnhancedChat();
}

module.exports = testEnhancedChat;
