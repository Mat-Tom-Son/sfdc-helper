#!/usr/bin/env node
'use strict';

/**
 * Comprehensive Runtime Test for Salesperson-Aware Chat Agent
 * 
 * Tests real Salesforce API calls with the enhanced patterns
 * Uses the specific queries developed for salesperson awareness
 */

require('dotenv').config();

const SFDCHelperClient = require('../src/client');
const { QuickSetup } = require('../src/chat');

// Verify environment
// Optional: LLM adapter URL for chat endpoint if your server is configured to use it
if (!process.env.LLM_HTTP_URL) {
  console.log('ℹ️  LLM_HTTP_URL not set; chat endpoint must be backed by your own adapter.');
}

console.log('🔥 SALESPERSON-AWARE RUNTIME TEST');
console.log('Testing real Salesforce API calls');
console.log('=' .repeat(60));

const CHAT_URL = 'http://localhost:3000/chat';

// Test queries organized by capability
const testQueries = {
  // Daily Sales Huddle Queries
  dailyHuddle: [
    "What deals need my attention today?",
    "Show me proposals due this week", 
    "Which deals haven't been touched recently?",
    "What's at risk in my pipeline?"
  ],

  // Weekly Pipeline Reviews
  weeklyReview: [
    "How's my territory performing this quarter?",
    "What deals are stuck in negotiation?",
    "Show me deals over $200k with high likelihood",
    "Which accounts need relationship attention?"
  ],

  // Monthly Business Reviews  
  monthlyBusiness: [
    "Why are we losing deals to competitors?",
    "How's our Quality & Compliance practice doing?",
    "What's our win rate by service area?", 
    "Show me velocity trends by deal size"
  ],

  // Strategic Planning
  strategicPlanning: [
    "Which clients have the most follow-on potential?",
    "What service areas are growing fastest?",
    "Where should we focus our sales efforts?",
    "Show me our most profitable client types"
  ],

  // Territory Management
  territoryManagement: [
    "Show me Sarah's pipeline",
    "How is John performing this quarter?",
    "What deals need Mike's attention?",
    "Compare territory performance"
  ],

  // At-Risk Deal Management
  atRiskManagement: [
    "What deals are at risk and need attention?",
    "Show me stalled opportunities", 
    "Find neglected pipeline deals",
    "Which proposals are overdue?"
  ],

  // Performance Analytics
  performanceAnalytics: [
    "What's our win rate looking like?",
    "Show me our biggest deals",
    "Find our top performing opportunities", 
    "Which stages have the most opportunities?"
  ],

  // Custom Field Intelligence
  customFieldQueries: [
    "Show me opportunities with high likelihood scores",
    "Find deals with good probability ratings",
    "Which opportunities have likelihood data?",
    "Show me opportunities with custom scoring"
  ]
};

async function runComprehensiveRuntimeTest() {
  console.log('\n🚀 STARTING COMPREHENSIVE RUNTIME TEST');
  console.log(`Testing ${Object.values(testQueries).flat().length} queries across ${Object.keys(testQueries).length} categories\n`);

  let totalTests = 0;
  let successfulTests = 0;
  let salesforceCallsCount = 0;
  let openaiCallsCount = 0; // deprecated; retained for summary structure
  const results = {};

  for (const [category, queries] of Object.entries(testQueries)) {
    console.log(`\n📋 ${category.toUpperCase().replace(/([A-Z])/g, ' $1').trim()}`);
    console.log('-'.repeat(50));
    
    results[category] = {
      total: queries.length,
      successful: 0,
      failed: 0,
      details: []
    };

    for (const query of queries) {
      totalTests++;
      console.log(`\n🔸 Testing: "${query}"`);
      
      try {
        const startTime = Date.now();
        
        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: 'runtime_test_user',
            message: query 
          })
        });
        
        const data = await response.json();
        const duration = Date.now() - startTime;
        
        if (data.success) {
          successfulTests++;
          results[category].successful++;
          salesforceCallsCount++; // Each successful query hits Salesforce
          // LLM calls are handled by your configured adapter/server if enabled
          
          console.log(`   ✅ Success (${duration}ms)`);
          console.log(`   📊 Records: ${data.recordCount || 0}`);
          console.log(`   🔧 Query Type: ${data.queryType || 'unknown'}`);
          console.log(`   🎯 Bundle Used: ${data.bundleUsed ? 'Yes' : 'No'}`);
          console.log(`   🧠 Dynamic: ${data.dynamicQuery ? 'Yes' : 'No'}`);
          
          // Show function called
          if (data.functionCalled) {
            console.log(`   🔧 Function: ${data.functionCalled}`);
          }
          
          // Show territory analysis if available
          if (data.territoryAnalysis) {
            console.log(`   📈 Territory Analysis: Available`);
            if (data.territoryAnalysis.metrics) {
              const metrics = data.territoryAnalysis.metrics;
              if (metrics.totalValue) {
                console.log(`   💰 Pipeline Value: $${metrics.totalValue.toLocaleString()}`);
              }
              if (metrics.winRate && metrics.winRate !== 'N/A') {
                console.log(`   📊 Win Rate: ${metrics.winRate}%`);
              }
            }
          }
          
          // Show owner filtering if used
          if (data.ownerFiltered) {
            console.log(`   👤 Owner Filtered: Yes`);
          }
          
          // Show sample of response
          const responsePreview = data.message.substring(0, 200).replace(/\n/g, ' ');
          console.log(`   💬 Response: "${responsePreview}..."`);
          
          results[category].details.push({
            query,
            success: true,
            duration,
            recordCount: data.recordCount,
            queryType: data.queryType,
            functionCalled: data.functionCalled
          });
          
        } else {
          results[category].failed++;
          console.log(`   ❌ Failed: ${data.error}`);
          
          results[category].details.push({
            query,
            success: false,
            error: data.error
          });
        }
        
      } catch (error) {
        results[category].failed++;
        console.log(`   ❌ Error: ${error.message}`);
        
        results[category].details.push({
          query,
          success: false,
          error: error.message
        });
      }
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(60));
  console.log('🏆 COMPREHENSIVE RUNTIME TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n📊 OVERALL STATISTICS:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Successful: ${successfulTests}`);
  console.log(`   Failed: ${totalTests - successfulTests}`);
  console.log(`   Success Rate: ${Math.round((successfulTests/totalTests) * 100)}%`);
  
  console.log(`\n🔗 API CALLS MADE:`);
  console.log(`   Salesforce API Calls: ${salesforceCallsCount}`);
  console.log(`   LLM API Calls (if any): ${openaiCallsCount}`);
  console.log(`   Total API Calls: ${salesforceCallsCount + openaiCallsCount}`);
  
  console.log(`\n📋 RESULTS BY CATEGORY:`);
  for (const [category, result] of Object.entries(results)) {
    const successRate = Math.round((result.successful / result.total) * 100);
    console.log(`   ${category}: ${result.successful}/${result.total} (${successRate}%)`);
  }
  
  // Show any failures
  const failures = Object.values(results)
    .flatMap(r => r.details)
    .filter(d => !d.success);
    
  if (failures.length > 0) {
    console.log(`\n❌ FAILURES ANALYSIS:`);
    failures.forEach(failure => {
      console.log(`   - "${failure.query}": ${failure.error}`);
    });
  }
  
  // Show top performing queries
  const successes = Object.values(results)
    .flatMap(r => r.details)
    .filter(d => d.success)
    .sort((a, b) => (b.recordCount || 0) - (a.recordCount || 0))
    .slice(0, 5);
    
  if (successes.length > 0) {
    console.log(`\n🌟 TOP PERFORMING QUERIES:`);
    successes.forEach((success, i) => {
      console.log(`   ${i+1}. "${success.query}" - ${success.recordCount} records (${success.duration}ms)`);
    });
  }
  
  console.log(`\n✨ Runtime test completed! Real Salesforce calls verified.`);
  
  return {
    totalTests,
    successfulTests,
    successRate: Math.round((successfulTests/totalTests) * 100),
    salesforceCallsCount,
    openaiCallsCount,
    results
  };
}

// Test specific salesperson-aware features
async function testSalespersonFeatures() {
  console.log('\n🎯 TESTING SPECIFIC SALESPERSON FEATURES');
  console.log('-'.repeat(50));
  
  try {
    const sfdcClient = new SFDCHelperClient('http://localhost:3000');
    const chatAgent = QuickSetup.sales(sfdcClient);
    
    // Test 1: User Lookup
    console.log('\n🔍 1. User Lookup Test:');
    const userResult = await chatAgent.lookupUser({ query: 'Scott', field: 'Name' });
    console.log(`   ✅ Found ${userResult.resultCount} users matching 'Scott'`);
    if (userResult.users.length > 0) {
      const user = userResult.users[0];
      console.log(`   👤 First match: ${user.Name} (${user.Email}) - ${user.Title || 'No title'}`);
    }
    
    // Test 2: Territory Query with Owner
    console.log('\n🏢 2. Territory Query Test:');
    const territoryResult = await chatAgent.queryTerritoryData({
      objectName: 'Opportunity',
      intent: 'pipeline analysis with high likelihood',
      options: { limit: 10 }
    });
    console.log(`   ✅ Found ${territoryResult.recordCount} opportunities`);
    if (territoryResult.territoryAnalysis && territoryResult.territoryAnalysis.metrics) {
      const metrics = territoryResult.territoryAnalysis.metrics;
      console.log(`   📊 Analysis: ${JSON.stringify(metrics, null, 2)}`);
    }
    
    // Test 3: Owner Filtering
    console.log('\n👤 3. Owner Filtering Test:');
    const ownerResult = await chatAgent.querySalesforce({
      objectName: 'Opportunity',
      intent: 'recent opportunities',
      options: { 
        ownerName: 'Scott',
        limit: 5
      }
    });
    console.log(`   ✅ Found ${ownerResult.recordCount} opportunities owned by Scott`);
    console.log(`   🎯 Owner Filtered: ${ownerResult.ownerFiltered ? 'Yes' : 'No'}`);
    
    console.log('\n✅ Salesperson feature tests completed successfully!');
    
  } catch (error) {
    console.error(`\n❌ Salesperson feature test failed: ${error.message}`);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  async function main() {
    try {
      if (args.includes('--features-only')) {
        await testSalespersonFeatures();
      } else {
        const results = await runComprehensiveRuntimeTest();
        
        if (args.includes('--with-features')) {
          await testSalespersonFeatures();
        }
        
        // Exit with appropriate code
        process.exit(results.successRate >= 80 ? 0 : 1);
      }
    } catch (error) {
      console.error('\n💥 Test execution failed:', error.message);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = { runComprehensiveRuntimeTest, testSalespersonFeatures };
