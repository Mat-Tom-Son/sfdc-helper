#!/usr/bin/env node
'use strict';

/**
 * Quick Integration Example - Drop this into your project
 * 
 * This shows how easy it is to add org-aware chat to any Node.js project
 */

require('dotenv').config();

// Import SFDC Helper and Chat Agent
const SFDCHelperClient = require('../src/client');
const { QuickSetup, Utils } = require('../src/chat');

async function quickIntegrationDemo() {
  console.log('🚀 QUICK INTEGRATION DEMO');
  console.log('Drop-in Salesforce Chat Agent');
  console.log('=' .repeat(40));

  try {
    // Step 1: Connect to your SFDC Helper server
    const sfdcClient = new SFDCHelperClient('http://localhost:3000');
    await sfdcClient.health();
    console.log('✅ Connected to Salesforce');

    // Step 2: Choose your agent type (or create custom)
    console.log('\n🤖 Available Agent Types:');
    console.log('- customerService: Helpful and informative');
    console.log('- sales: Proactive and goal-oriented');  
    console.log('- analytics: Data-focused and precise');
    console.log('- executive: High-level insights');

    // Step 3: Create your agent (pick one)
    const agent = QuickSetup.sales(sfdcClient, {
      // Optional customization
      agentName: 'My Sales Assistant',
      bundleDir: 'context_bundles' // Path to your context bundles
    });
    
    console.log('✅ Sales agent created');

    // Step 4: Optional - Setup context bundles (first time only)
    console.log('\n📦 Setting up context bundles...');
    // Uncomment this for first-time setup:
    // const bundleResults = await Utils.setupCommonBundles(sfdcClient);
    // console.log('✅ Context bundles ready');

    // Step 5: Start chatting!
    console.log('\n💬 Testing chat functionality...');
    const testResults = await Utils.testChatAgent(agent, 'demo_user');
    
    // Show results
    console.log('\n📊 Test Results:');
    testResults.forEach(result => {
      if (result.success) {
        console.log(`✅ "${result.query}" - ${result.duration}ms - ${result.recordCount} records`);
        console.log(`   ${result.responsePreview}`);
      } else {
        console.log(`❌ "${result.query}" - Error: ${result.error}`);
      }
    });

    // Step 6: Use in your application
    console.log('\n🎯 Ready for production use!');
    console.log('Example usage:');
    console.log(`
    // In your application:
    const response = await agent.processMessage(userId, userMessage);
    console.log(response.response); // Send this to your user
    `);

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Example Express.js integration
function expressExample() {
  console.log('\n🌐 Express.js Integration Example:');
  console.log(`
const express = require('express');
const SFDCHelperClient = require('sfdc-helper-client');
const { QuickSetup } = require('sfdc-helper-chat');

const app = express();
app.use(express.json());

// Setup chat agent
const sfdcClient = new SFDCHelperClient('http://localhost:3000');
const chatAgent = QuickSetup.sales(sfdcClient);

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    const response = await chatAgent.processMessage(userId, message);
    
    res.json({
      success: true,
      message: response.response,
      recordCount: response.functionResult?.recordCount || 0,
      queryType: response.functionResult?.queryType
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => console.log('Chat API ready on port 3001'));
  `);
}

// Example React integration
function reactExample() {
  console.log('\n⚛️  React Integration Example:');
  console.log(`
// Frontend React component
import React, { useState } from 'react';

function SalesforceChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'user123', 
          message 
        })
      });
      
      const data = await res.json();
      setResponse(data.message);
    } catch (error) {
      setResponse('Error: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <input 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about your Salesforce data..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
      <div>{response}</div>
    </div>
  );
}
  `);
}

if (require.main === module) {
  quickIntegrationDemo()
    .then(() => {
      expressExample();
      reactExample();
    })
    .catch(console.error);
}

module.exports = { quickIntegrationDemo, expressExample, reactExample };
