#!/usr/bin/env node
'use strict';

/**
 * Comprehensive Prompt Test Suite
 * 
 * Tests all capabilities of the org-aware chat agent with real examples
 */

require('dotenv').config();

const testPrompts = {
  // =====================================
  // 1. BASIC DATA QUERIES
  // =====================================
  basicQueries: [
    "Show me recent opportunities",
    "What opportunities do we have?", 
    "List our current deals",
    "Display opportunity records",
    "Get me some opportunities"
  ],

  // =====================================
  // 2. CUSTOM FIELD INTELLIGENCE
  // =====================================
  customFieldQueries: [
    "Show me opportunities with high likelihood scores",
    "Find deals with good probability ratings", 
    "Which opportunities have likelihood data?",
    "Show me opportunities with custom scoring",
    "Find records with likelihood percentages",
    "What deals have probability fields filled out?"
  ],

  // =====================================
  // 3. CONTEXT BUNDLE PATTERNS
  // =====================================
  contextBundleQueries: [
    // Should match "Last 30 days" bundle
    "Show me recent opportunities",
    "What are our latest deals?",
    "Find new opportunities",
    "Show me current opportunities",
    
    // Should match "Open pipeline" bundle  
    "What deals are in our pipeline?",
    "Show me active opportunities",
    "What's in our sales pipeline?",
    "Display open deals",
    "What opportunities are we working on?",
    
    // Should match "Closing this quarter" bundle
    "What deals are closing this quarter?", 
    "Show me opportunities ending this quarter",
    "Which deals finish this quarter?",
    "What's closing in Q4?",
    "Find opportunities due this quarter"
  ],

  // =====================================
  // 4. BUSINESS INTELLIGENCE QUERIES
  // =====================================
  businessIntelligence: [
    "What's our win rate looking like?",
    "Show me our biggest deals",
    "Which opportunities are most valuable?",
    "What's the average deal size?",
    "Find our top performing opportunities",
    "Show me closed won deals",
    "What deals did we lose recently?",
    "Which stages have the most opportunities?",
    "What's our pipeline value?",
    "Show me deals over $100,000"
  ],

  // =====================================
  // 5. FILTERING & CRITERIA
  // =====================================
  filteringQueries: [
    "Show me opportunities in negotiation stage",
    "Find deals closing next month", 
    "What opportunities are over $50k?",
    "Show me closed won deals from last quarter",
    "Find opportunities in prospecting stage",
    "Which deals have amounts over 100000?",
    "Show me opportunities that are closed",
    "Find deals with stage 'Closed Won'",
    "What opportunities close in 2025?"
  ],

  // =====================================
  // 6. GOAL-ORIENTED CONVERSATIONS  
  // =====================================
  goalOrientedQueries: [
    "Help me analyze our Q4 pipeline",
    "I need to create a sales forecast",
    "Let's review our deal performance", 
    "I want to track our top opportunities",
    "Help me understand our conversion rates",
    "I need to prepare for a sales meeting",
    "Let's analyze our closed deals",
    "Help me identify at-risk opportunities"
  ],

  // =====================================
  // 7. NATURAL LANGUAGE VARIATIONS
  // =====================================
  naturalLanguageVariations: [
    "What's happening with our deals?",
    "How are we doing with sales?",
    "Give me the scoop on our opportunities", 
    "What's the latest on our pipeline?",
    "How's our sales performance?",
    "Tell me about our deal flow",
    "What's cooking in our pipeline?",
    "How are our numbers looking?"
  ],

  // =====================================
  // 8. COMPLEX ANALYTICAL QUERIES
  // =====================================
  analyticalQueries: [
    "Compare our won vs lost opportunities",
    "What patterns do you see in our deals?",
    "Which factors predict deal success?",
    "Analyze our opportunity stages",
    "What insights can you give about our pipeline?",
    "How do our custom fields correlate with wins?",
    "What trends do you notice in our data?",
    "Which opportunities need attention?"
  ],

  // =====================================
  // 9. SPECIFIC FIELD REFERENCES
  // =====================================
  specificFieldQueries: [
    "Show me opportunities with Likelihood__c values",
    "Find deals where Amount is greater than 200000",
    "What opportunities have StageName 'Negotiation'?", 
    "Show records with CloseDate this month",
    "Find opportunities where IsClosed is false",
    "Display deals with CurrencyIsoCode 'USD'",
    "Show me opportunities with RecordType 'Actual'"
  ],

  // =====================================
  // 10. CONVERSATIONAL FOLLOW-UPS
  // =====================================
  conversationalFollowUps: [
    "Tell me more about those deals",
    "What else can you show me?",
    "Can you dig deeper into that?",
    "What would you recommend next?",
    "How should I prioritize these?",
    "What actions should I take?",
    "What's most important here?",
    "What am I missing?"
  ],

  // =====================================
  // 11. EDGE CASES & ERROR HANDLING
  // =====================================
  edgeCases: [
    "Show me opportunities from 1999", // Should handle gracefully
    "Find deals with impossible criteria", // Should explain limitations  
    "What about invalid field names?", // Should suggest alternatives
    "Show me data that doesn't exist", // Should provide helpful response
    "Query something completely unrelated" // Should stay focused on Salesforce
  ],

  // =====================================
  // 12. MULTI-TURN CONVERSATIONS
  // =====================================
  multiTurnScenarios: [
    // Scenario 1: Pipeline Review
    {
      turn1: "Show me our pipeline opportunities",
      turn2: "Which of these have high likelihood?", 
      turn3: "What should I focus on first?"
    },
    
    // Scenario 2: Deal Analysis
    {
      turn1: "Find our biggest deals",
      turn2: "How are they progressing?",
      turn3: "What risks do you see?"
    },
    
    // Scenario 3: Performance Review
    {
      turn1: "Show me closed won deals",
      turn2: "What made these successful?",
      turn3: "How can we replicate this?"
    }
  ]
};

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE CHAT AGENT CAPABILITY TEST');
  console.log('=' .repeat(60));
  console.log('Testing all capabilities with real prompts\n');

  let totalTests = 0;
  let successfulTests = 0;

  for (const [category, prompts] of Object.entries(testPrompts)) {
    if (category === 'multiTurnScenarios') continue; // Skip multi-turn for now
    
    console.log(`\n📋 ${category.toUpperCase().replace(/([A-Z])/g, ' $1').trim()}`);
    console.log('-'.repeat(40));
    
    for (const prompt of prompts) {
      totalTests++;
      console.log(`\n🔸 Testing: "${prompt}"`);
      
      try {
        const startTime = Date.now();
        
        const response = await fetch('http://localhost:3000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: 'test_comprehensive',
            message: prompt 
          })
        });
        
        const data = await response.json();
        const duration = Date.now() - startTime;
        
        if (data.success) {
          successfulTests++;
          console.log(`✅ Success (${duration}ms) - ${data.recordCount} records`);
          console.log(`   Query Type: ${data.queryType || 'unknown'}`);
          console.log(`   Bundle Used: ${data.bundleUsed ? '🎯' : '❌'} Dynamic: ${data.dynamicQuery ? '🧠' : '❌'}`);
          console.log(`   Response: "${data.message.substring(0, 100)}..."`);
        } else {
          console.log(`❌ Failed: ${data.error}`);
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n🏆 TEST SUMMARY:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Successful: ${successfulTests}`);
  console.log(`   Success Rate: ${Math.round((successfulTests/totalTests) * 100)}%`);
  console.log(`\n✨ Comprehensive capability test completed!`);
}

async function runSampleTests() {
  console.log('🎯 SAMPLE CAPABILITY TESTS');
  console.log('=' .repeat(40));
  
  const samplePrompts = [
    "Show me recent opportunities",
    "Find deals with high likelihood scores", 
    "What's in our pipeline?",
    "Show me closed won deals over $100k",
    "Help me analyze our Q4 performance"
  ];
  
  for (const prompt of samplePrompts) {
    console.log(`\n🔸 "${prompt}"`);
    
    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${data.recordCount} records - ${data.queryType}`);
        console.log(`   "${data.message.substring(0, 150)}..."`);
      } else {
        console.log(`❌ ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }
  }
}

// Export for use
module.exports = { testPrompts, runComprehensiveTest, runSampleTests };

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--full')) {
    runComprehensiveTest().catch(console.error);
  } else {
    runSampleTests().catch(console.error);
  }
}
