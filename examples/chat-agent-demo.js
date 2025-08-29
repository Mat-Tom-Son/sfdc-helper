#!/usr/bin/env node
'use strict';

/**
 * Goal-Aware Chat Agent Demo
 * 
 * Demonstrates the conversational Salesforce assistant with goal tracking,
 * org-aware intelligence, and warm personality.
 */

const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');

class ChatAgentDemo {
  constructor() {
    // Initialize SFDC Helper client
    this.sfdcClient = new SFDCHelperClient('http://localhost:3000');
    
    // Initialize Chat Agent
    this.chatAgent = new ChatAgent(this.sfdcClient, {
      agentName: 'Sage', // Give our assistant a friendly name
      temperature: 0.7,
      maxHistoryLength: 15,
      goalManager: {
        maxGoalsPerUser: 5,
        autoPersist: true
      }
    });

    this.userId = 'demo_user_' + Date.now();
  }

  async runDemo() {
    console.log('🤖 Goal-Aware Salesforce Chat Agent Demo\n');
    
    try {
      // Check if SFDC Helper is running
      await this.sfdcClient.health();
      console.log('✅ SFDC Helper server is running\n');
    } catch (error) {
      console.error('❌ SFDC Helper server not available. Please run: npm start');
      return;
    }

    // Demo conversation scenarios
    const scenarios = [
      {
        name: 'Goal Creation & Pipeline Analysis',
        conversations: [
          "Hi! I'm worried about our Q4 pipeline performance",
          "What did you find about our pipeline?",
          "Which deals should I focus on first?",
          "How can I track progress on this?"
        ]
      },
      {
        name: 'Multi-Goal Management', 
        conversations: [
          "I also need to understand our customer health",
          "Show me our active goals",
          "What's the status of our pipeline analysis?"
        ]
      },
      {
        name: 'Contextual Follow-ups',
        conversations: [
          "Show me recent opportunities",
          "Are any of these related to our goals?",
          "What should I do next?"
        ]
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\n📋 ${scenario.name}`);
      console.log('═'.repeat(50));
      
      for (const message of scenario.conversations) {
        await this.processMessage(message);
        await this.sleep(1000); // Pause between messages for readability
      }
    }

    // Show final goal status
    console.log('\n🎯 Final Goal Status');
    console.log('═'.repeat(30));
    await this.showGoalStatus();

    console.log('\n✅ Demo completed!');
    console.log('\n💡 Try running the interactive demo: node examples/chat-agent-interactive.js');
  }

  async processMessage(userMessage) {
    console.log(`\n👤 User: ${userMessage}`);
    
    try {
      const startTime = Date.now();
      const response = await this.chatAgent.processMessage(this.userId, userMessage);
      const duration = Date.now() - startTime;

      console.log(`🤖 Sage: ${response.response}`);
      
      // Show additional context if available
      if (response.functionCalled) {
        console.log(`   🔧 Used: ${response.functionCalled}`);
      }
      
      if (response.goalUpdates && response.goalUpdates.length > 0) {
        console.log('   🎯 Goal Updates:');
        response.goalUpdates.forEach(update => {
          console.log(`     • ${update.goalName}: ${update.relevantData}`);
        });
      }

      if (response.functionResult && response.functionResult.recordCount !== undefined) {
        console.log(`   📊 Found ${response.functionResult.recordCount} records`);
      }

      console.log(`   ⏱️  Response time: ${duration}ms`);
      
    } catch (error) {
      console.log(`🤖 Sage: I apologize, but I encountered an error: ${error.message}`);
    }
  }

  async showGoalStatus() {
    try {
      const response = await this.chatAgent.getActiveGoals(this.userId);
      
      if (response.count === 0) {
        console.log('No active goals');
        return;
      }

      console.log(`Active Goals (${response.count}):`);
      response.activeGoals.forEach(goal => {
        console.log(`\n📈 ${goal.name}`);
        console.log(`   Progress: ${goal.progress.percentage}% (${goal.progress.completed}/${goal.progress.total})`);
        console.log(`   Current: ${goal.currentStep || 'Completed'}`);
        if (Object.keys(goal.context).length > 0) {
          console.log(`   Context: ${JSON.stringify(goal.context).substring(0, 100)}...`);
        }
      });
      
    } catch (error) {
      console.log('Could not retrieve goal status:', error.message);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Interactive mode for manual testing
async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const demo = new ChatAgentDemo();
  
  console.log('🤖 Interactive Chat Agent Demo');
  console.log('Type "exit" to quit, "goals" to see active goals\n');

  const askQuestion = () => {
    rl.question('👤 You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
      }

      if (input.toLowerCase() === 'goals') {
        await demo.showGoalStatus();
        askQuestion();
        return;
      }

      await demo.processMessage(input);
      askQuestion();
    });
  };

  try {
    await demo.sfdcClient.health();
    console.log('✅ Connected to SFDC Helper\n');
    askQuestion();
  } catch (error) {
    console.error('❌ SFDC Helper server not available. Please run: npm start');
    rl.close();
  }
}

// Check command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    interactiveMode().catch(console.error);
  } else {
    const demo = new ChatAgentDemo();
    demo.runDemo().catch(console.error);
  }
}

module.exports = ChatAgentDemo;
