#!/usr/bin/env node
'use strict';

/**
 * Add Chat Endpoint to SFDC Helper Server
 * 
 * This adds a /chat endpoint for natural language queries
 */

const express = require('express');
const SFDCHelperClient = require('../src/client');
const { QuickSetup } = require('../src/chat');

const app = express();
app.use(express.json());

// Initialize chat agent
const sfdcClient = new SFDCHelperClient('http://localhost:3000');
const chatAgent = QuickSetup.sales(sfdcClient);

// Chat endpoint for natural language queries
app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    console.log(`[Chat] User ${userId || 'anonymous'}: ${message}`);
    
    const response = await chatAgent.processMessage(userId || 'default', message);
    
    res.json({
      success: true,
      message: response.response,
      recordCount: response.functionResult?.recordCount || 0,
      queryType: response.functionResult?.queryType,
      bundleUsed: response.functionResult?.bundleUsed || false,
      dynamicQuery: response.functionResult?.dynamicQuery || false
    });
    
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-api' });
});

const PORT = process.env.CHAT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 Chat API listening on http://localhost:${PORT}`);
  console.log(`📡 SFDC Helper: http://localhost:3000`);
  console.log(`\n💬 Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"message": "Show me recent opportunities"}'`);
});

module.exports = app;
