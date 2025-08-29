#!/usr/bin/env node
'use strict';

/**
 * Runtime Integration Test - Real Salesforce + OpenAI Testing
 * 
 * Tests the complete chat agent system with actual API calls to verify:
 * - SFDC Helper integration with real org data
 * - OpenAI function calling and conversation flow
 * - Org-aware intelligence and context usage
 * - Natural conversation responses
 */

// Load environment variables from .env file
require('dotenv').config();

const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

class RuntimeIntegrationTest {
  constructor() {
    this.sfdcClient = new SFDCHelperClient('http://localhost:3000');
    this.chatAgent = null;
    this.userId = 'runtime_test_' + Date.now();
    this.testResults = [];
  }

  async initialize() {
    console.log('🚀 Runtime Integration Test');
    console.log('Testing real Salesforce + OpenAI integration\n');

    // Verify SFDC Helper is running
    try {
      await this.sfdcClient.health();
      console.log('✅ SFDC Helper server is running');
    } catch (error) {
      throw new Error('❌ SFDC Helper server not available. Please run: npm start');
    }

    // Verify OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('❌ OPENAI_API_KEY not found in environment');
    }
    console.log('✅ OpenAI API key is configured');

    // Initialize chat agent
    this.chatAgent = new ChatAgent(this.sfdcClient, {
      agentName: 'TestBot',
      temperature: 0.7,
      model: 'gpt-3.5-turbo', // Fast model for testing
      maxHistoryLength: 15
    });
    
    console.log('✅ Using gpt-3.5-turbo for fast responses');

    // Get org context for test planning
    const orgContext = await this.chatAgent.getOrgContext();
    console.log(`✅ Connected to org with ${orgContext.objects.length} objects`);
    console.log(`   Dynamic discovery: ${orgContext.dynamicDiscovery ? 'Active' : 'Inactive'}\n`);
  }

  /**
   * Define 5 comprehensive test queries that exercise different aspects
   */
  getTestQueries() {
    return [
      {
        id: 'pipeline_overview',
        query: "Give me an overview of our current sales pipeline",
        expectedBehavior: [
          'Should query Opportunity data',
          'Should provide stage breakdown and totals',
          'Should reference org-specific patterns',
          'Should offer actionable insights'
        ]
      },
      {
        id: 'deal_velocity',
        query: "Are there any deals that seem to be moving slowly?",
        expectedBehavior: [
          'Should analyze opportunity stage durations',
          'Should compare against org averages',
          'Should identify specific slow-moving deals',
          'Should suggest next steps'
        ]
      },
      {
        id: 'account_analysis',
        query: "Show me our biggest customers and their recent activity",
        expectedBehavior: [
          'Should query Account data with amounts/revenue',
          'Should include recent opportunities or cases',
          'Should rank by significance',
          'Should provide customer health insights'
        ]
      },
      {
        id: 'forecast_accuracy',
        query: "How confident should I be in our quarterly forecast?",
        expectedBehavior: [
          'Should analyze close dates and probabilities',
          'Should reference historical patterns',
          'Should identify risk factors',
          'Should provide confidence assessment'
        ]
      },
      {
        id: 'follow_up_context',
        query: "What should I focus on this week based on what we just discussed?",
        expectedBehavior: [
          'Should reference previous conversation context',
          'Should synthesize insights from prior queries',
          'Should provide prioritized action items',
          'Should demonstrate conversation memory'
        ]
      }
    ];
  }

  async runTestQuery(testCase) {
    console.log(`\n🧪 Test: ${testCase.id}`);
    console.log(`Query: "${testCase.query}"`);
    console.log('Expected behavior:', testCase.expectedBehavior.map(b => `\n  • ${b}`).join(''));
    console.log('\n' + '─'.repeat(60));

    const startTime = Date.now();
    
    try {
      // Execute the query
      const response = await this.chatAgent.processMessage(this.userId, testCase.query);
      const duration = Date.now() - startTime;

      // Analyze the response
      const analysis = this.analyzeResponse(response, testCase);
      
      // Display results
      console.log(`\n🤖 Response (${duration}ms):`);
      console.log(`"${response.response}"\n`);

      if (response.functionCalled) {
        console.log(`🔧 Function Used: ${response.functionCalled}`);
        
        if (response.functionResult) {
          if (response.functionResult.recordCount !== undefined) {
            console.log(`📊 Records Found: ${response.functionResult.recordCount}`);
          }
          if (response.functionResult.queryType) {
            console.log(`🔍 Query Type: ${response.functionResult.queryType}`);
          }
        }
      }

      if (response.goalUpdates && response.goalUpdates.length > 0) {
        console.log(`🎯 Goal Updates: ${response.goalUpdates.length}`);
      }

      // Show analysis
      console.log('\n📋 Analysis:');
      analysis.checks.forEach(check => {
        const status = check.passed ? '✅' : '❌';
        console.log(`  ${status} ${check.description}`);
      });

      console.log(`\n📊 Score: ${analysis.score}/${analysis.totalChecks} checks passed`);
      
      // Store results
      this.testResults.push({
        ...testCase,
        response,
        analysis,
        duration,
        success: analysis.score === analysis.totalChecks
      });

      return analysis.score === analysis.totalChecks;

    } catch (error) {
      console.log(`\n❌ Test failed: ${error.message}`);
      
      this.testResults.push({
        ...testCase,
        error: error.message,
        duration: Date.now() - startTime,
        success: false
      });
      
      return false;
    }
  }

  analyzeResponse(response, testCase) {
    const checks = [];
    let score = 0;

    // Basic response quality checks
    if (response.response && response.response.length > 50) {
      checks.push({ description: 'Generated substantial response', passed: true });
      score++;
    } else {
      checks.push({ description: 'Generated substantial response', passed: false });
    }

    // Function calling checks
    if (response.functionCalled) {
      checks.push({ description: 'Used appropriate Salesforce function', passed: true });
      score++;
    } else {
      checks.push({ description: 'Used appropriate Salesforce function', passed: false });
    }

    // Data retrieval checks
    if (response.functionResult && response.functionResult.recordCount !== undefined) {
      if (response.functionResult.recordCount > 0) {
        checks.push({ description: 'Retrieved actual Salesforce data', passed: true });
        score++;
      } else {
        checks.push({ description: 'Retrieved actual Salesforce data', passed: false });
      }
    } else {
      checks.push({ description: 'Retrieved actual Salesforce data', passed: false });
    }

    // Conversational quality checks
    const responseText = response.response.toLowerCase();
    
    // Check for org-aware language
    if (responseText.includes('your org') || responseText.includes('in your') || 
        responseText.includes('based on your') || responseText.includes('your typical')) {
      checks.push({ description: 'Used org-aware language', passed: true });
      score++;
    } else {
      checks.push({ description: 'Used org-aware language', passed: false });
    }

    // Check for helpful insights (not just data dump)
    if (responseText.includes('interesting') || responseText.includes('notice') || 
        responseText.includes('worth mentioning') || responseText.includes('suggests')) {
      checks.push({ description: 'Provided insights beyond raw data', passed: true });
      score++;
    } else {
      checks.push({ description: 'Provided insights beyond raw data', passed: false });
    }

    // Check for actionable suggestions
    if (responseText.includes('should') || responseText.includes('recommend') || 
        responseText.includes('suggest') || responseText.includes('might want') ||
        responseText.includes('would you like')) {
      checks.push({ description: 'Offered actionable suggestions', passed: true });
      score++;
    } else {
      checks.push({ description: 'Offered actionable suggestions', passed: false });
    }

    // Specific test case checks
    if (testCase.id === 'follow_up_context') {
      // Check if it references previous conversation
      if (responseText.includes('discussed') || responseText.includes('talked about') ||
          responseText.includes('looked at') || responseText.includes('found')) {
        checks.push({ description: 'Referenced previous conversation context', passed: true });
        score++;
      } else {
        checks.push({ description: 'Referenced previous conversation context', passed: false });
      }
    }

    return {
      checks,
      score,
      totalChecks: checks.length,
      percentage: Math.round((score / checks.length) * 100)
    };
  }

  async runAllTests() {
    const testQueries = this.getTestQueries();
    let passedTests = 0;

    console.log(`\n📋 Running ${testQueries.length} comprehensive test queries...\n`);

    for (const testCase of testQueries) {
      const success = await this.runTestQuery(testCase);
      if (success) passedTests++;
      
      // Brief pause between tests to avoid rate limiting
      await this.sleep(1000);
    }

    return { passedTests, totalTests: testQueries.length };
  }

  generateSummaryReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(80));

    // Overall statistics
    const totalTests = results.totalTests;
    const passedTests = results.passedTests;
    const successRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n🎯 Overall Results:`);
    console.log(`   Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`);
    
    // Performance statistics
    const durations = this.testResults.filter(r => r.duration).map(r => r.duration);
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`\n⚡ Performance:`);
    console.log(`   Average Response Time: ${avgDuration}ms`);
    console.log(`   Fastest Response: ${minDuration}ms`);
    console.log(`   Slowest Response: ${maxDuration}ms`);

    // Quality analysis
    const allChecks = this.testResults.flatMap(r => r.analysis?.checks || []);
    const passedChecks = allChecks.filter(c => c.passed).length;
    const totalChecks = allChecks.length;
    const qualityScore = Math.round((passedChecks / totalChecks) * 100);

    console.log(`\n🎨 Response Quality:`);
    console.log(`   Quality Checks Passed: ${passedChecks}/${totalChecks} (${qualityScore}%)`);

    // Detailed breakdown
    console.log(`\n📋 Detailed Results:`);
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const score = result.analysis ? `${result.analysis.score}/${result.analysis.totalChecks}` : 'Error';
      console.log(`   ${status} ${result.id}: ${score} checks (${result.duration || 0}ms)`);
    });

    // Function usage analysis
    const functionsUsed = this.testResults
      .filter(r => r.response?.functionCalled)
      .map(r => r.response.functionCalled);
    
    console.log(`\n🔧 Functions Used:`);
    const functionCounts = {};
    functionsUsed.forEach(fn => functionCounts[fn] = (functionCounts[fn] || 0) + 1);
    Object.entries(functionCounts).forEach(([fn, count]) => {
      console.log(`   ${fn}: ${count} times`);
    });

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (successRate >= 80) {
      console.log('   🎉 Excellent! The chat agent is performing very well.');
    } else if (successRate >= 60) {
      console.log('   ⚠️  Good performance with room for improvement.');
    } else {
      console.log('   🔧 Performance needs attention. Check error logs above.');
    }

    if (avgDuration > 2000) {
      console.log('   ⚡ Consider optimizing for faster response times.');
    }

    if (qualityScore < 80) {
      console.log('   📝 Review system prompts to improve response quality.');
    }

    console.log('\n✅ Integration test completed!');
    return { successRate, qualityScore, avgDuration };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const tester = new RuntimeIntegrationTest();
  
  try {
    await tester.initialize();
    const results = await tester.runAllTests();
    const summary = tester.generateSummaryReport(results);
    
    // Exit with appropriate code
    process.exit(summary.successRate >= 80 ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Integration test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RuntimeIntegrationTest;
