# Goal-Aware Chat Agent

A conversational AI assistant for Salesforce that pairs org-aware intelligence and goal tracking with your own LLM endpoint to create warm, helpful interactions.

## Architecture

### Core Components

- `Goal.js` - Goal class and templates for multi-step objectives
- `GoalManager.js` - Goal lifecycle management and persistence  
- `ChatAgent.js` - Main conversational AI using a pluggable LLM adapter

### Key Features

🎯 Goal-Oriented Conversations - Set and track multi-step objectives across conversation turns

🧠 Org-Aware Intelligence - Leverages your SFDC Helper's context bundles and field discovery

💬 Warm Personality - Conversational, helpful responses vs. cold data fetching

🔄 Multi-Turn Memory - Remembers context and builds on previous conversations

📊 Proactive Updates - Mentions goal-relevant findings naturally in responses

## Quick Start

### 1. Optional LLM Adapter Env
```bash
export LLM_HTTP_URL="https://your-app.example.com/api/llm-chat"
```

### 2. Run Demo
```bash
# Automated demo
npm run chat

# Interactive mode
npm run chat:interactive
```

## Usage Example

```javascript
const SFDCHelperClient = require('../src/client');
const ChatAgent = require('../src/chat/ChatAgent');
const { HttpLlmAdapter } = require('../src/chat/LlmAdapter');

// Initialize
const sfdcClient = new SFDCHelperClient('http://localhost:3000');
const chatAgent = new ChatAgent(sfdcClient, {
  llmAdapter: process.env.LLM_HTTP_URL ? new HttpLlmAdapter(process.env.LLM_HTTP_URL) : undefined
});

// Have a conversation
const response = await chatAgent.processMessage(
  'user123', 
  "I'm worried about our Q4 pipeline"
);

console.log(response.response);
// "I can help you assess your pipeline health! Let me create a goal for us..."
```

## Goal Templates

The system includes predefined goal templates:

- `pipeline_health` - Analyze pipeline performance and bottlenecks
- `deal_rescue` - Identify and rescue stalled deals  
- `forecast_accuracy` - Improve sales forecasting
- `territory_analysis` - Analyze territory/rep performance
- `customer_health` - Assess customer relationship health
- `sales_process_optimization` - Improve sales process efficiency

## Conversation Flow

### Goal Creation
```
User: "Our pipeline feels messy"
Agent: "Let me create a Pipeline Health Assessment goal for us..."
       [Creates goal and starts step 1]
```

### Progress Tracking
```
User: "What did we find yesterday?"
Agent: "Great question! Our Pipeline Health Assessment is 75% complete:
        ✓ Analyzed current pipeline
        ✓ Identified bottlenecks  
        ✓ Assessed deal velocity
        → Currently: Suggesting actions..."
```

### Proactive Updates
```
User: "Show me recent opportunities"
Agent: "Here are recent opportunities... 
        🎯 Goal Update: 3 of these relate to our stalled deals analysis!"
```

## Configuration Options

```javascript
const chatAgent = new ChatAgent(sfdcClient, {
  agentName: 'Sage',              // Assistant name
  temperature: 0.7,               // Creativity (0-1)
  model: 'gpt-4.1',               // Arbitrary label passed to your adapter
  maxHistoryLength: 20,           // Conversation memory
  goalManager: {
    maxGoalsPerUser: 5,           // Max concurrent goals
    autoPersist: true,            // Auto-save goals
    persistPath: './data/goals.json'
  }
});
```

## Goal Persistence

Goals are automatically persisted to JSON files for continuity across sessions:

```json
{
  "goals": {
    "pipeline_health_1234567890": {
      "id": "pipeline_health_1234567890",
      "type": "pipeline_health", 
      "userId": "user123",
      "status": "active",
      "currentStep": 2,
      "progress": [...],
      "context": {...}
    }
  }
}
```

## Tool Function Integration

The agent exposes tool (function) definitions to the LLM to enable structured actions:

- `query_salesforce` - Execute org-aware SOQL queries
- `get_org_insights` - Retrieve contextual org information
- `create_goal` - Set up new multi-step objectives
- `update_goal_progress` - Track completion of goal steps
- `get_active_goals` - Check current goal status

## Extending the System

### Custom Goal Templates
```javascript
GoalTemplates.addCustomTemplate('custom_analysis', {
  name: 'Custom Analysis',
  steps: ['gather_data', 'analyze_patterns', 'create_report'],
  successCriteria: 'User has comprehensive analysis report'
});
```

### Custom Functions
Add new tool definitions to the `ChatAgent.functions` array and implement handlers in `executeFunctionCall()`.

## Best Practices

1. Keep Goals Focused - 3-5 steps work best for user engagement
2. Use Org Context - Reference specific field usage and patterns  
3. Be Proactive - Surface goal-relevant data in regular responses
4. Warm Communication - Acknowledge user intent and explain significance
5. Track Progress - Always show where you are in multi-step processes

## Troubleshooting

### Common Issues

"LLM adapter not configured"
- Provide `llmAdapter` in ChatAgent options or set `LLM_HTTP_URL` to use the built-in HTTP adapter

"SFDC Helper not available"  
- Ensure `npm start` is running on port 3000
- Check SFDC Helper server health endpoint

"Goals not persisting"
- Check write permissions for data directory
- Verify `autoPersist: true` in options

### Debug Mode
```javascript
const chatAgent = new ChatAgent(sfdcClient, {
  debug: true  // Enables detailed logging
});
```

## Architecture Decisions

### Why Goal-Oriented?
Traditional chatbots feel transactional because they only respond to immediate queries. Goals create collaborative partnerships where the agent helps accomplish multi-step objectives.

### Why a Pluggable LLM Adapter?
A pluggable adapter cleanly separates conversation management from business logic (SFDC Helper) while letting you bring your own LLM provider.

### Why Lightweight Persistence?
JSON file storage keeps the system simple while providing essential continuity. Can be upgraded to databases as needed.

---

**Ready to build goal-oriented Salesforce conversations!** 🚀
