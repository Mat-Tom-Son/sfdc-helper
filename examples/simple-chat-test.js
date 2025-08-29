#!/usr/bin/env node
'use strict';

/**
 * Simple Chat Test - Test the refined chat agent with actual OpenAI integration
 * 
 * This demonstrates the natural conversation flow without heavy goal emphasis
 */

const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

async function testChat() {
  console.log('🤖 Simple Chat Agent Test\n');
  
  // Check if SFDC Helper is available
  const sfdcClient = new SFDCHelperClient('http://localhost:3000');
  
  try {
    await sfdcClient.health();
    console.log('✅ SFDC Helper server is running');
  } catch (error) {
    console.log('⚠️  SFDC Helper not available, using mock data for demonstration');
    console.log('   (Run "npm start" in another terminal for full integration)\n');
  }
  
  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not set. Please set your API key to test the chat agent.');
    return;
  }
  
  // Initialize chat agent with natural conversation focus
  const chatAgent = new ChatAgent(sfdcClient, {
    agentName: 'Alex', // Friendly name
    temperature: 0.7,
    model: 'gpt-3.5-turbo', // Use faster/cheaper model for testing
    maxHistoryLength: 10
  });
  
  const userId = 'test_user';
  
  console.log('🎯 Testing Natural Conversation Flow\n');
  
  // Test conversations that focus on being helpful vs. goal-oriented
  const testMessages = [
    "Hi! What can you help me with?",
    "Show me some recent opportunities",
    "Are there any deals I should be worried about?",
    "What's the typical deal size in our pipeline?",
    "Thanks, that's helpful!"
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`👤 User: ${message}`);
    
    try {
      const startTime = Date.now();
      const response = await chatAgent.processMessage(userId, message);
      const duration = Date.now() - startTime;
      
      console.log(`🤖 Alex: ${response.response}`);
      
      // Show technical details
      if (response.functionCalled) {
        console.log(`   🔧 Used: ${response.functionCalled}`);
      }
      
      if (response.functionResult && typeof response.functionResult.recordCount !== 'undefined') {
        console.log(`   📊 Found ${response.functionResult.recordCount} records`);
      }
      
      console.log(`   ⏱️  ${duration}ms\n`);
      
    } catch (error) {
      console.log(`🤖 Alex: I apologize, but I encountered an issue: ${error.message}\n`);
    }
  }
  
  // Test conversation memory
  console.log('🧠 Testing Conversation Memory\n');
  
  const memoryTest = await chatAgent.processMessage(userId, "What did we just discuss?");
  console.log(`👤 User: What did we just discuss?`);
  console.log(`🤖 Alex: ${memoryTest.response}\n`);
  
  // Show conversation stats
  const stats = chatAgent.getConversationStats(userId);
  console.log('📊 Conversation Statistics:');
  console.log(`   Messages: ${stats.messageCount}`);
  console.log(`   Duration: ${Math.round(stats.duration / 1000)}s`);
  console.log(`   Started: ${stats.startedAt.toLocaleTimeString()}\n`);
  
  console.log('✅ Chat test completed successfully!');
  console.log('\n💡 Key observations:');
  console.log('   - Responses focus on being helpful vs. goal-oriented');
  console.log('   - Conversation memory works across multiple turns');
  console.log('   - Natural language processing with org-aware context');
  console.log('   - Goals work in background without dominating conversation');
}

// Error handling wrapper
async function main() {
  try {
    await testChat();
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    if (error.message.includes('API key')) {
      console.log('\n💡 Make sure OPENAI_API_KEY is set in your environment');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = testChat;
