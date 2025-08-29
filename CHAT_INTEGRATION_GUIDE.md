# 🤖 SFDC Helper Chat Agent - Integration Guide

Drop-in conversational AI for Salesforce with org-aware intelligence. Get up and running in minutes!

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install dotenv
```

### 2. Set Environment Variables

```bash
# .env file
# Optional: HTTP LLM adapter endpoint you already host in your app
# The adapter should accept a JSON payload and return a minimal response (see below)
LLM_HTTP_URL=https://your-app.example.com/api/llm-chat

SALESFORCE_USERNAME=your_sf_username
SALESFORCE_PASSWORD=your_sf_password
SALESFORCE_SECURITY_TOKEN=your_sf_token
```

### 3. Basic Setup (BYO-LLM)

```javascript
const SFDCHelperClient = require('./src/client');
const { QuickSetup } = require('./src/chat');
const { HttpLlmAdapter } = require('./src/chat/LlmAdapter');

// Connect to SFDC Helper
const sfdcClient = new SFDCHelperClient('http://localhost:3000');

// Option A: Use an HTTP adapter (recommended when you already expose AI endpoints)
const llm = new HttpLlmAdapter(process.env.LLM_HTTP_URL);
const agent = QuickSetup.sales(sfdcClient, { llmAdapter: llm });

// Option B: Provide your own adapter implementing createChatCompletion({...})
// const agent = QuickSetup.sales(sfdcClient, { llmAdapter: myAdapter });

// Start chatting!
const response = await agent.processMessage('user123', 'Show me recent opportunities');
console.log(response.response);
```

#### HTTP Adapter contract
- Request body sent by SFDC Helper:
```json
{
  "model": "gpt-4.1",
  "messages": [{"role":"system","content":"..."},{"role":"user","content":"..."}],
  "tools": [ { "name": "query_salesforce", "parameters": {"type":"object", ... } } ],
  "toolChoice": "auto",
  "temperature": 0.7,
  "maxTokens": 1000
}
```
- Expected response body from your endpoint:
```json
{
  "content": "text response here",
  "functionCall": { "name": "query_salesforce", "arguments": "{\"objectName\":\"Opportunity\",...}" }
}
```
Either field is optional; if `functionCall` is present, the agent will execute it and follow up with another LLM call to produce a final reply.

## 🎯 Agent Types

Choose the right agent for your use case:

### 📞 Customer Service
```javascript
const agent = QuickSetup.customerService(sfdcClient, {
  agentName: 'Support Assistant'
});
```
- **Best for**: Help desk, customer inquiries
- **Style**: Helpful, informative, patient

### 💰 Sales  
```javascript
const agent = QuickSetup.sales(sfdcClient, {
  agentName: 'Sales Assistant'
});
```
- **Best for**: Pipeline management, opportunity tracking
- **Style**: Proactive, goal-oriented, motivating

### 📊 Analytics
```javascript
const agent = QuickSetup.analytics(sfdcClient, {
  agentName: 'Data Assistant'
});
```
- **Best for**: Reports, data analysis, insights
- **Style**: Precise, data-focused, detailed

### 🎩 Executive
```javascript
const agent = QuickSetup.executive(sfdcClient, {
  agentName: 'Executive Assistant'  
});
```
- **Best for**: High-level summaries, strategic insights
- **Style**: Concise, strategic, big-picture

## ⚙️ Custom Configuration

```javascript
const { createChatAgent } = require('./src/chat');
const { HttpLlmAdapter } = require('./src/chat/LlmAdapter');

const agent = createChatAgent(sfdcClient, {
  agentName: 'My Custom Assistant',
  model: 'gpt-4.1',                 // Arbitrary label passed to your adapter
  temperature: 0.7,                 // 0.0 = precise, 1.0 = creative
  maxHistoryLength: 20,             // conversation memory
  bundleDir: 'context_bundles',     // path to context bundles
  
  // Goal management
  goalManager: {
    persistPath: 'data/goals.json',
    autoPersist: true,
    maxGoalsPerUser: 10
  },

  // Provide your adapter (HTTP or custom)
  llmAdapter: new HttpLlmAdapter(process.env.LLM_HTTP_URL)
});
```

## 📦 Context Bundles Setup

Context bundles provide pre-computed, org-specific intelligence for faster responses.

### First-Time Setup
```javascript
const { Utils } = require('./src/chat');

// Generate bundles for common objects
const results = await Utils.setupCommonBundles(sfdcClient);
console.log('Context bundles ready!');
```

### Manual Bundle Generation
```javascript
// Generate bundle for specific object
const result = await Utils.generateContextBundle(sfdcClient, 'Opportunity', {
  persist: true,      // Save to disk
  runQueries: true,   // Include sample data
  sample: 50,         // Sample size
  verbose: false      // Quiet mode
});
```

### Bundle Structure
```
context_bundles/
  Opportunity_2025-01-15T10-30-00-000Z/
    ├── summary.md          # Object overview
    ├── queries.md          # Pre-tested query patterns  
    ├── usage.md            # Field usage patterns
    ├── picklists.md        # Valid picklist values
    ├── stages.md           # Opportunity stages
    ├── formulas.md         # Business logic
    └── validation_rules.md # Data constraints
```

## 🌐 Web Integration Examples

### Express.js API
```javascript
const express = require('express');
const { QuickSetup } = require('./src/chat');
const { HttpLlmAdapter } = require('./src/chat/LlmAdapter');

const app = express();
app.use(express.json());

const sfdcClient = new SFDCHelperClient('http://localhost:3000');
const chatAgent = QuickSetup.sales(sfdcClient, { llmAdapter: new HttpLlmAdapter(process.env.LLM_HTTP_URL) });

app.post('/api/chat', async (req, res) => {
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

app.listen(3001);
```

### React Component
```jsx
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
        body: JSON.stringify({ userId: 'user123', message })
      });
      
      const data = await res.json();
      setResponse(data.message);
    } catch (error) {
      setResponse('Error: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="chat-container">
      <div className="response">{response}</div>
      <input 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about your Salesforce data..."
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
    </div>
  );
}
```

### WebSocket Real-time Chat
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    try {
      const { userId, message } = JSON.parse(data);
      const response = await chatAgent.processMessage(userId, message);
      
      ws.send(JSON.stringify({
        type: 'response',
        message: response.response,
        recordCount: response.functionResult?.recordCount || 0
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
});
```

## 🎛️ Advanced Features

### Goal Tracking
```javascript
// The agent automatically tracks multi-step goals
const response = await agent.processMessage('user123', 
  'I need to analyze our Q4 pipeline and create a forecast'
);

// Check user's active goals
const goals = agent.goalManager.getActiveGoals('user123');
console.log(`User has ${goals.length} active goals`);
```

### Custom Field Intelligence
```javascript
// The agent automatically discovers and uses custom fields
const response = await agent.processMessage('user123',
  'Show me opportunities with high likelihood scores'
);

// Uses your org's Likelihood__c field automatically!
```

### Performance Monitoring
```javascript
// Get cache statistics
const stats = agent.contextReader.getCacheStats();
console.log('Cache stats:', stats);

// Preload common bundles for better performance
await agent.contextReader.preloadBundles(['Opportunity', 'Account']);
```

## 🔧 Troubleshooting

### Common Issues

**1. "LLM adapter not configured"**
- Provide `llmAdapter` when creating the agent, or set `LLM_HTTP_URL` to use the built-in HTTP adapter.

**2. "Context bundles not found"**
```javascript
// Generate bundles first
await Utils.setupCommonBundles(sfdcClient);
```

**3. "Slow response times"**
- Ensure your LLM endpoint is reachable and performant
- Ensure context bundles are generated
- Reduce `maxHistoryLength`

### Performance Tips

1. **Use Context Bundles**: Pre-compute org intelligence
2. **Adapter-side Caching**: Cache LLM responses where appropriate
3. **Cache Warming**: Preload common bundles
4. **Limit History**: Keep `maxHistoryLength` reasonable (20-50)

## 📚 Example Queries

The agent understands natural language queries about your Salesforce data:

```javascript
// Pipeline management
"Show me opportunities in our pipeline"
"What deals are closing this quarter?"
"Find high-value opportunities"

// Custom field queries  
"Show me opportunities with high likelihood scores"
"Find deals with good ratings"
"What opportunities have custom field data?"

// Analytics
"Show me closed won deals from last month"
"What's our win rate this quarter?"
"Find opportunities by stage"

// Goal-oriented
"Help me analyze our Q4 pipeline"
"I need to create a sales forecast"
"Track progress on our deals"
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
SFDC_HELPER_URL=https://your-sfdc-helper.com
LOG_LEVEL=info
# Optional: point to your LLM endpoint used by the HTTP adapter
LLM_HTTP_URL=https://your-app.example.com/api/llm-chat
```

### Scaling Considerations
- **Rate Limiting**: Apply at your LLM endpoint
- **Caching**: Use Redis or similar for shared cache across instances
- **Monitoring**: Track response times and error rates
- **Fallbacks**: Return a helpful message on LLM failures

### Security
- **API Keys**: Store securely, rotate regularly  
- **User Auth**: Validate user permissions
- **Data Access**: Respect Salesforce sharing rules
- **Audit Logging**: Track chat interactions

---

## 🎉 You're Ready!

Your org-aware Salesforce chat agent is ready to deploy. It will:

✅ **Understand your org** - Uses custom fields and business processes  
✅ **Respond quickly** - Context bundles + intelligent caching  
✅ **Track goals** - Multi-turn conversation memory  
✅ **Scale easily** - Drop into any Node.js application  

Need help? Check the examples in the `/examples` directory!
