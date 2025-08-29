#!/usr/bin/env node
'use strict';

/**
 * Test Runner - Runs all chat agent tests
 */

const path = require('path');

// Simple test aggregator
class TestSuite {
  constructor() {
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.suites = [];
  }

  async runSuite(name, testFile) {
    console.log(`\n🧪 Running ${name} Tests`);
    console.log('='.repeat(50));
    
    try {
      const testModule = require(testFile);
      const runner = testModule.runner || testModule;
      
      const success = await runner.run();
      
      this.totalPassed += runner.passed || 0;
      this.totalFailed += runner.failed || 0;
      
      this.suites.push({
        name,
        passed: runner.passed || 0,
        failed: runner.failed || 0,
        success
      });
      
      return success;
    } catch (error) {
      console.error(`❌ Failed to run ${name} tests:`, error.message);
      this.totalFailed += 1;
      this.suites.push({
        name,
        passed: 0,
        failed: 1,
        success: false,
        error: error.message
      });
      return false;
    }
  }

  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    
    this.suites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      const details = suite.error ? 
        `Error: ${suite.error}` : 
        `${suite.passed} passed, ${suite.failed} failed`;
      
      console.log(`${status} ${suite.name}: ${details}`);
    });
    
    console.log('\n🎯 Overall Results:');
    console.log(`   Total Passed: ${this.totalPassed}`);
    console.log(`   Total Failed: ${this.totalFailed}`);
    console.log(`   Success Rate: ${this.totalPassed + this.totalFailed > 0 ? 
      Math.round((this.totalPassed / (this.totalPassed + this.totalFailed)) * 100) : 0}%`);
    
    return this.totalFailed === 0;
  }
}

async function runAllTests() {
  const suite = new TestSuite();
  
  console.log('🚀 Chat Agent Test Suite');
  console.log('Starting comprehensive tests...\n');
  
  // Run all test suites
  const testSuites = [
    ['Goal System', './Goal.test.js'],
    ['Goal Manager', './GoalManager.test.js'],
    ['Chat Agent', './ChatAgent.test.js']
  ];
  
  let allPassed = true;
  
  for (const [name, file] of testSuites) {
    const testPath = path.join(__dirname, file);
    const success = await suite.runSuite(name, testPath);
    allPassed = allPassed && success;
  }
  
  // Print final summary
  const overallSuccess = suite.printSummary();
  
  if (overallSuccess) {
    console.log('\n🎉 All tests passed! The chat agent is ready to use.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
  
  return overallSuccess;
}

// Integration test with actual SFDC Helper (if available)
async function runIntegrationTest() {
  console.log('\n🔗 Integration Test');
  console.log('='.repeat(30));
  
  try {
    const SFDCHelperClient = require('../../client');
    const client = new SFDCHelperClient('http://localhost:3000');
    
    // Test SFDC Helper connection
    await client.health();
    console.log('✅ SFDC Helper server is running');
    
    // Test basic functionality
    const allowlist = await client.getAllowlist();
    console.log(`✅ Retrieved allowlist with ${Object.keys(allowlist).length} objects`);
    
    return true;
  } catch (error) {
    console.log('⚠️  SFDC Helper integration test skipped:', error.message);
    console.log('   Make sure to run "npm start" to test full integration');
    return false;
  }
}

// LLM HTTP adapter smoke test (if URL available)
async function runLlmAdapterTest() {
  console.log('\n🤖 LLM Adapter Test');
  console.log('='.repeat(30));
  
  const url = process.env.LLM_HTTP_URL;
  if (!url) {
    console.log('⚠️  LLM adapter test skipped: LLM_HTTP_URL not set');
    return false;
  }
  try {
    const res = await (await require('undici').request(url, {
      method: 'POST',
      body: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'ping' }] }),
      headers: { 'Content-Type': 'application/json' }
    })).body.json();
    console.log('✅ LLM endpoint reachable');
    if (res && (res.content || res.functionCall)) console.log('✅ Valid response shape');
    return true;
  } catch (error) {
    console.log('❌ LLM adapter test failed:', error.message);
    return false;
  }
}

// Performance test
async function runPerformanceTest() {
  console.log('\n⚡ Performance Test');
  console.log('='.repeat(25));
  
  try {
    const { MockSFDCClient } = require('./ChatAgent.test');
    const ChatAgent = require('../ChatAgent');
    
    const mockSFDC = new MockSFDCClient();
    const agent = new ChatAgent(mockSFDC, { 
      openaiApiKey: 'test-key',
      model: 'gpt-3.5-turbo'
    });
    
    // Test conversation creation performance
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      agent.getConversation(`user_${i}`);
    }
    
    const conversationTime = Date.now() - startTime;
    console.log(`✅ Created 100 conversations in ${conversationTime}ms`);
    
    // Test goal creation performance
    const goalStartTime = Date.now();
    
    for (let i = 0; i < 50; i++) {
      try {
        agent.goalManager.createGoal('pipeline_health', `user_${i % 10}`);
      } catch (error) {
        // Expected to hit max goals limit
      }
    }
    
    const goalTime = Date.now() - goalStartTime;
    console.log(`✅ Goal operations completed in ${goalTime}ms`);
    
    // Test memory usage
    const memUsage = process.memoryUsage();
    console.log(`✅ Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
    
    return true;
  } catch (error) {
    console.log('❌ Performance test failed:', error.message);
    return false;
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      // Run unit tests
      const unitTestSuccess = await runAllTests();
      
      // Run integration tests
      await runIntegrationTest();
      await runLlmAdapterTest();
      await runPerformanceTest();
      
      // Exit with appropriate code
      process.exit(unitTestSuccess ? 0 : 1);
      
    } catch (error) {
      console.error('\n💥 Test runner failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { runAllTests, runIntegrationTest, runLlmAdapterTest };
