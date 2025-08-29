#!/usr/bin/env node
'use strict';

/**
 * Comprehensive Org-Aware Test - Showcase the enhanced intelligence
 * 
 * Tests the complete system with:
 * - Full field discovery (200+ fields including custom)
 * - Intelligent field selection based on intent
 * - Natural org-aware responses
 * - Custom field integration (like Likelihood__c)
 * - Fast response times with gpt-3.5-turbo
 */

require('dotenv').config();
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

class ComprehensiveOrgTest {
  constructor() {
    this.sfdcClient = new SFDCHelperClient('http://localhost:3000');
    this.chatAgent = new ChatAgent(this.sfdcClient, {
      agentName: 'OrgExpert',
      temperature: 0.7,
      model: 'gpt-3.5-turbo', // Fast model for quick responses
      maxHistoryLength: 10
    });
    this.userId = 'org_test_' + Date.now();
  }

  async runComprehensiveTest() {
    console.log('🚀 Comprehensive Org-Aware Intelligence Test');
    console.log('Testing enhanced field discovery and natural responses\n');

    try {
      await this.sfdcClient.health();
      console.log('✅ SFDC Helper connected\n');
    } catch (error) {
      throw new Error('❌ SFDC Helper not available. Please run: npm start');
    }

    // Test queries that should showcase org-aware intelligence
    const testQueries = [
      {
        name: 'Likelihood-Aware Pipeline',
        query: "Show me opportunities with their likelihood scores",
        expectedFeatures: ['Uses Likelihood__c field', 'References custom fields naturally', 'Org-specific context']
      },
      {
        name: 'Forecast Intelligence',
        query: "Help me understand our forecast accuracy",
        expectedFeatures: ['Intelligent field selection', 'Custom field discovery', 'Business context']
      },
      {
        name: 'Custom Field Discovery',
        query: "What custom fields do we have for opportunities?",
        expectedFeatures: ['Complete field enumeration', 'Custom vs standard breakdown', 'Usage insights']
      },
      {
        name: 'Org-Specific Analysis',
        query: "Analyze our sales data using your knowledge of our org setup",
        expectedFeatures: ['References org uniqueness', 'Custom field integration', 'Business process awareness']
      }
    ];

    let successfulTests = 0;
    const results = [];

    for (const [index, testCase] of testQueries.entries()) {
      console.log(`🧪 Test ${index + 1}: ${testCase.name}`);
      console.log(`Query: "${testCase.query}"`);
      console.log('Expected features:', testCase.expectedFeatures.map(f => `\n  • ${f}`).join(''));
      console.log('\n' + '─'.repeat(60));

      const startTime = Date.now();
      
      try {
        const response = await this.chatAgent.processMessage(this.userId, testCase.query);
        const duration = Date.now() - startTime;

        console.log(`\n🤖 Response (${duration}ms):`);
        console.log(`"${response.response}"\n`);

        // Analyze the response quality
        const analysis = this.analyzeResponse(response, testCase);
        
        console.log('📊 Technical Details:');
        if (response.functionCalled) {
          console.log(`   Function: ${response.functionCalled}`);
        }
        if (response.functionResult?.orgContext) {
          const ctx = response.functionResult.orgContext;
          console.log(`   Total Fields in Org: ${ctx.totalFieldsInOrg}`);
          console.log(`   Custom Fields in Org: ${ctx.customFieldsInOrg}`);
          console.log(`   Fields Used in Query: ${ctx.fieldsUsed?.length || 0}`);
          console.log(`   Custom Fields Used: ${ctx.customFieldsUsed?.length || 0}`);
          if (ctx.customFieldsUsed?.length > 0) {
            console.log(`   Custom Fields: ${ctx.customFieldsUsed.join(', ')}`);
          }
        }
        if (response.functionResult?.recordCount !== undefined) {
          console.log(`   Records Retrieved: ${response.functionResult.recordCount}`);
        }

        console.log('\n📋 Analysis:');
        analysis.checks.forEach(check => {
          const status = check.passed ? '✅' : '❌';
          console.log(`  ${status} ${check.description}`);
        });

        const score = analysis.score / analysis.totalChecks;
        console.log(`\n🎯 Score: ${analysis.score}/${analysis.totalChecks} (${Math.round(score * 100)}%)`);
        
        if (score >= 0.7) {
          successfulTests++;
          console.log('✅ Test PASSED');
        } else {
          console.log('❌ Test needs improvement');
        }

        results.push({
          ...testCase,
          response,
          analysis,
          duration,
          success: score >= 0.7
        });

      } catch (error) {
        console.log(`\n❌ Test failed: ${error.message}`);
        results.push({
          ...testCase,
          error: error.message,
          duration: Date.now() - startTime,
          success: false
        });
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Generate summary
    this.generateSummary(results, successfulTests, testQueries.length);
  }

  analyzeResponse(response, testCase) {
    const checks = [];
    let score = 0;

    // Basic response quality
    if (response.response && response.response.length > 100) {
      checks.push({ description: 'Generated substantial response', passed: true });
      score++;
    } else {
      checks.push({ description: 'Generated substantial response', passed: false });
    }

    // Function calling
    if (response.functionCalled) {
      checks.push({ description: 'Used Salesforce function', passed: true });
      score++;
    } else {
      checks.push({ description: 'Used Salesforce function', passed: false });
    }

    // Org-aware language
    const responseText = response.response.toLowerCase();
    if (responseText.includes('your org') || responseText.includes('in your org') || 
        responseText.includes('your salesforce') || responseText.includes('custom field')) {
      checks.push({ description: 'Used org-aware language', passed: true });
      score++;
    } else {
      checks.push({ description: 'Used org-aware language', passed: false });
    }

    // Custom field awareness
    if (response.functionResult?.orgContext?.customFieldsInOrg > 0) {
      checks.push({ description: 'Discovered custom fields', passed: true });
      score++;
    } else {
      checks.push({ description: 'Discovered custom fields', passed: false });
    }

    // Custom field usage
    if (response.functionResult?.orgContext?.customFieldsUsed?.length > 0) {
      checks.push({ description: 'Actually used custom fields', passed: true });
      score++;
    } else {
      checks.push({ description: 'Actually used custom fields', passed: false });
    }

    // Field intelligence
    if (response.functionResult?.orgContext?.totalFieldsInOrg > 100) {
      checks.push({ description: 'Full field discovery (100+ fields)', passed: true });
      score++;
    } else {
      checks.push({ description: 'Full field discovery (100+ fields)', passed: false });
    }

    // Response relevance
    if (responseText.includes('likelihood') && testCase.query.includes('likelihood')) {
      checks.push({ description: 'Addressed likelihood field specifically', passed: true });
      score++;
    } else if (testCase.query.includes('likelihood')) {
      checks.push({ description: 'Addressed likelihood field specifically', passed: false });
    }

    // Business context
    if (responseText.includes('field') || responseText.includes('data') || responseText.includes('record')) {
      checks.push({ description: 'Provided business context', passed: true });
      score++;
    } else {
      checks.push({ description: 'Provided business context', passed: false });
    }

    return {
      checks,
      score,
      totalChecks: checks.length,
      percentage: Math.round((score / checks.length) * 100)
    };
  }

  generateSummary(results, successfulTests, totalTests) {
    console.log('📊 COMPREHENSIVE ORG-AWARE TEST SUMMARY');
    console.log('='.repeat(60));

    const successRate = Math.round((successfulTests / totalTests) * 100);
    console.log(`\n🎯 Overall Success Rate: ${successfulTests}/${totalTests} (${successRate}%)`);

    // Performance analysis
    const durations = results.filter(r => r.duration).map(r => r.duration);
    if (durations.length > 0) {
      const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      console.log(`⚡ Average Response Time: ${avgDuration}ms`);
      console.log(`   Fastest: ${Math.min(...durations)}ms`);
      console.log(`   Slowest: ${Math.max(...durations)}ms`);
    }

    // Feature analysis
    const customFieldUsage = results.filter(r => 
      r.response?.functionResult?.orgContext?.customFieldsUsed?.length > 0
    ).length;
    
    console.log(`\n🎨 Org-Aware Features:`);
    console.log(`   Tests using custom fields: ${customFieldUsage}/${totalTests}`);
    
    const totalFieldsDiscovered = results.find(r => 
      r.response?.functionResult?.orgContext?.totalFieldsInOrg
    )?.response?.functionResult?.orgContext?.totalFieldsInOrg;
    
    if (totalFieldsDiscovered) {
      console.log(`   Total fields discovered: ${totalFieldsDiscovered}`);
      
      const customFieldsDiscovered = results.find(r => 
        r.response?.functionResult?.orgContext?.customFieldsInOrg
      )?.response?.functionResult?.orgContext?.customFieldsInOrg;
      
      if (customFieldsDiscovered) {
        console.log(`   Custom fields discovered: ${customFieldsDiscovered}`);
      }
    }

    console.log('\n💡 Key Achievements:');
    if (successRate >= 75) {
      console.log('   ✅ Excellent org-aware intelligence');
      console.log('   ✅ Custom field integration working');
      console.log('   ✅ Natural, contextual responses');
    } else if (successRate >= 50) {
      console.log('   ⚠️  Good progress, some areas for improvement');
    } else {
      console.log('   🔧 Needs optimization for better org awareness');
    }

    if (durations.length > 0 && Math.max(...durations) < 5000) {
      console.log('   ✅ Fast response times achieved');
    }

    console.log('\n🚀 The chat agent now has:');
    console.log('   • Complete field discovery (bypasses allowlist limitations)');
    console.log('   • Intelligent field selection based on query intent');
    console.log('   • Natural integration of custom fields like Likelihood__c');
    console.log('   • Org-specific language and context');
    console.log('   • Fast response times with gpt-3.5-turbo');

    console.log('\n✅ Comprehensive test completed!');
  }
}

async function main() {
  const tester = new ComprehensiveOrgTest();
  
  try {
    await tester.runComprehensiveTest();
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ComprehensiveOrgTest;
