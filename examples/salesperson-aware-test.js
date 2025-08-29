#!/usr/bin/env node
'use strict';

/**
 * Comprehensive Salesperson-Aware Chat Agent Test
 * 
 * Tests all the new salesperson-aware capabilities including:
 * - User lookup functionality
 * - Territory filtering
 * - Owner-based queries
 * - Sales performance analysis
 * - Context bundle enhancements
 */

require('dotenv').config();

const SFDCHelperClient = require('../src/client');
const { QuickSetup } = require('../src/chat');

const CHAT_URL = 'http://localhost:3000/chat';

async function testSalespersonAwareness() {
  console.log('🎯 SALESPERSON-AWARE CHAT AGENT TEST');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: User Lookup Capability
    console.log('\n📋 TEST 1: User Lookup Capability');
    console.log('-'.repeat(30));
    
    const userLookupQueries = [
      "Who is John in our system?",
      "Find user Sarah",
      "Look up Mike's information",
      "Show me users with 'Smith' in their name"
    ];
    
    for (const query of userLookupQueries) {
      await testQuery(query, 'User Lookup');
    }
    
    // Test 2: Territory-Based Queries
    console.log('\n📋 TEST 2: Territory-Based Queries');
    console.log('-'.repeat(30));
    
    const territoryQueries = [
      "Show me my opportunities",
      "What deals does Sarah own?",
      "Find John's pipeline",
      "Show me Mike's territory performance",
      "How is my territory doing?"
    ];
    
    for (const query of territoryQueries) {
      await testQuery(query, 'Territory Analysis');
    }
    
    // Test 3: Sales Performance Patterns
    console.log('\n📋 TEST 3: Sales Performance Patterns');
    console.log('-'.repeat(30));
    
    const performanceQueries = [
      "What deals are at risk?",
      "Show me neglected opportunities",
      "Which proposals are due this week?",
      "What's our win rate analysis?",
      "Find high-value pipeline deals"
    ];
    
    for (const query of performanceQueries) {
      await testQuery(query, 'Performance Analysis');
    }
    
    // Test 4: Enhanced Context Bundle Matching
    console.log('\n📋 TEST 4: Enhanced Context Bundle Matching');
    console.log('-'.repeat(30));
    
    const contextQueries = [
      "Show me at-risk pipeline deals",
      "High-value pipeline analysis",
      "Proposal deadline management",
      "Territory performance dashboard",
      "Client relationship health check"
    ];
    
    for (const query of contextQueries) {
      await testQuery(query, 'Context Bundle');
    }
    
    // Test 5: Natural Language Sales Patterns
    console.log('\n📋 TEST 5: Natural Language Sales Patterns');
    console.log('-'.repeat(30));
    
    const naturalQueries = [
      "What deals need my attention?",
      "How's my team performing?",
      "Which reps need help?",
      "What proposals are urgent?",
      "Show me stalled deals"
    ];
    
    for (const query of naturalQueries) {
      await testQuery(query, 'Natural Language');
    }
    
    console.log('\n✅ SALESPERSON-AWARE TEST COMPLETED');
    console.log('All new functionality has been tested!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

async function testQuery(message, category) {
  console.log(`\n🔸 [${category}] "${message}"`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: 'salesperson_test',
        message 
      })
    });
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    if (data.success) {
      console.log(`   ✅ Success (${duration}ms)`);
      console.log(`   📊 Records: ${data.recordCount || 0}`);
      console.log(`   🔧 Query Type: ${data.queryType || 'unknown'}`);
      console.log(`   🎯 Bundle Used: ${data.bundleUsed ? 'Yes' : 'No'}`);
      console.log(`   🧠 Dynamic: ${data.dynamicQuery ? 'Yes' : 'No'}`);
      console.log(`   👤 Owner Filtered: ${data.ownerFiltered ? 'Yes' : 'No'}`);
      
      // Show function called if available
      if (data.functionCalled) {
        console.log(`   🔧 Function: ${data.functionCalled}`);
      }
      
      // Show territory analysis if available
      if (data.territoryAnalysis) {
        console.log(`   📈 Territory Analysis: ${data.territoryAnalysis.recordCount} records analyzed`);
        if (data.territoryAnalysis.metrics) {
          console.log(`   💰 Metrics: ${JSON.stringify(data.territoryAnalysis.metrics)}`);
        }
      }
      
      console.log(`   💬 Response: "${data.message.substring(0, 150)}..."`);
    } else {
      console.log(`   ❌ Failed: ${data.error}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Test direct function usage
async function testDirectFunctions() {
  console.log('\n🧪 DIRECT FUNCTION TESTING');
  console.log('=' .repeat(30));
  
  try {
    const sfdcClient = new SFDCHelperClient('http://localhost:3000');
    const chatAgent = QuickSetup.sales(sfdcClient);
    
    // Test user lookup
    console.log('\n🔍 Testing User Lookup:');
    const userResult = await chatAgent.lookupUser({ query: 'admin', field: 'Name' });
    console.log(`   Found ${userResult.resultCount} users`);
    if (userResult.users.length > 0) {
      console.log(`   First user: ${userResult.users[0].Name} (${userResult.users[0].Email})`);
    }
    
    // Test territory query
    console.log('\n🏢 Testing Territory Query:');
    const territoryResult = await chatAgent.queryTerritoryData({
      objectName: 'Opportunity',
      intent: 'pipeline analysis',
      options: { limit: 5 }
    });
    console.log(`   Found ${territoryResult.recordCount} opportunities`);
    if (territoryResult.territoryAnalysis) {
      console.log(`   Analysis: ${JSON.stringify(territoryResult.territoryAnalysis.metrics || {})}`);
    }
    
    console.log('\n✅ Direct function tests completed');
    
  } catch (error) {
    console.error('\n❌ Direct function test failed:', error.message);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--direct')) {
    testDirectFunctions().catch(console.error);
  } else {
    testSalespersonAwareness().catch(console.error);
  }
}

module.exports = { testSalespersonAwareness, testDirectFunctions };
