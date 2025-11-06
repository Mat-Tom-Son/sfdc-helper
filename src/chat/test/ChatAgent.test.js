'use strict';

/**
 * Tests for ChatAgent class - focusing on chat integration
 */

const ChatAgent = require('../ChatAgent');
const { TestRunner } = require('./Goal.test');

// Mock SFDC Client for testing
class MockSFDCClient {
  constructor() {
    this.mockData = {
      allowlist: {
        Opportunity: {
          fields: ['Id', 'Name', 'StageName', 'Amount', 'CloseDate'],
          defaultFields: ['Id', 'Name', 'StageName', 'Amount']
        },
        Account: {
          fields: ['Id', 'Name', 'Industry', 'Type'],
          defaultFields: ['Id', 'Name', 'Industry']
        }
      },
      stats: {
        dynamic: true,
        stats: {
          Opportunity: { totalFields: 50 },
          Account: { totalFields: 35 }
        }
      },
      insights: {
        summary: { fieldsCount: 50, allowlist: { allowlisted: true } },
        topFields: [
          { field: 'Name', usage: 95 },
          { field: 'StageName', usage: 88 },
          { field: 'Amount', usage: 82 }
        ],
        suggestions: [
          { title: 'Recent deals', where: [{ field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:30' }] },
          { title: 'Open pipeline', where: [{ field: 'StageName', op: 'IN', value: ['Prospecting', 'Qualification'] }] }
        ]
      },
      queryResult: {
        results: {
          records: [
            { Id: '001', Name: 'Test Opportunity', StageName: 'Prospecting', Amount: 50000 },
            { Id: '002', Name: 'Another Deal', StageName: 'Qualification', Amount: 75000 }
          ]
        },
        suggestion: { title: 'Recent deals' },
        query: { object: 'Opportunity' }
      }
    };
  }

  async getAllowlist() {
    return this.mockData.allowlist;
  }

  async getAllowlistStats() {
    return this.mockData.stats;
  }

  async getObjectInsights(objectName) {
    return this.mockData.insights;
  }

  async describeObject(objectName) {
    return {
      name: objectName,
      fields: [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'StageName', type: 'picklist' },
        { name: 'Amount', type: 'currency' },
        { name: 'CloseDate', type: 'date' },
        { name: 'Custom_Field__c', type: 'string' }
      ]
    };
  }

  async safeQuery(objectName, options = {}) {
    return this.mockData.queryResult.results;
  }

  async executeSmartQuery(objectName, intent, options = {}) {
    return this.mockData.queryResult;
  }

  async health() {
    return { status: 'ok' };
  }
}

// Mock LLM adapter for testing (without actual API calls)
class MockLlmAdapter {
  constructor() {
    this.lastCall = null;
  }

  async createChatCompletion(params) {
    this.lastCall = params;
    const lastMessage = params.messages[params.messages.length - 1];
    const content = String(lastMessage.content || '').toLowerCase();
    if (content.includes('show me') || content.includes('find') || content.includes('opportunities')) {
      return {
        choices: [{
          message: {
            function_call: {
              name: 'query_salesforce',
              arguments: JSON.stringify({ objectName: 'Opportunity', intent: lastMessage.content, options: { limit: 10 } })
            }
          }
        }]
      };
    }
    return {
      choices: [{ message: { content: `Echo: ${lastMessage.content}` } }]
    };
  }
}

const runner = new TestRunner();

// ChatAgent Creation Tests
runner.test('ChatAgent can be created with SFDC client', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter(), model: 'test-model' });
  
  runner.assert(agent.sfdcClient === mockSFDC, 'Should store SFDC client');
  runner.assert(agent.goalManager, 'Should have goal manager');
  runner.assert(agent.conversations instanceof Map, 'Should have conversations map');
  runner.assert(agent.functions.length > 0, 'Should have OpenAI functions defined');
});

runner.test('ChatAgent initializes tool functions correctly', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const functionNames = agent.functions.map(f => f.name);
  
  runner.assert(functionNames.includes('query_salesforce'), 'Should have query_salesforce function');
  runner.assert(functionNames.includes('get_org_insights'), 'Should have get_org_insights function');
  runner.assert(functionNames.includes('create_goal'), 'Should have create_goal function');
  
  // Check function parameters
  const queryFunction = agent.functions.find(f => f.name === 'query_salesforce');
  runner.assert(queryFunction.parameters.properties.objectName, 'Should have objectName parameter');
  runner.assert(queryFunction.parameters.properties.intent, 'Should have intent parameter');
});

// Conversation Management Tests
runner.test('ChatAgent manages conversation history', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const conversation = agent.getConversation('user123');
  
  runner.assert(conversation.userId === 'user123', 'Should create conversation for user');
  runner.assert(Array.isArray(conversation.history), 'Should have history array');
  runner.assert(conversation.startedAt instanceof Date, 'Should have start time');
  
  // Test conversation reuse
  const sameConversation = agent.getConversation('user123');
  runner.assert(conversation === sameConversation, 'Should reuse existing conversation');
});

runner.test('ChatAgent builds system prompt with org context', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const orgContext = await agent.getOrgContext();
  const prompt = agent.buildSystemPrompt('user123', orgContext);
  
  runner.assert(prompt.includes('Salesforce assistant'), 'Should identify as Salesforce assistant');
  runner.assert(prompt.includes('Opportunity'), 'Should mention available objects');
  runner.assert(prompt.includes('Dynamic field discovery'), 'Should mention org capabilities');
  runner.assert(prompt.includes('conversational'), 'Should emphasize conversational personality');
});

// Function Execution Tests  
runner.test('ChatAgent can execute query_salesforce function', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const result = await agent.querySalesforce({
    objectName: 'Opportunity',
    intent: 'show me recent deals',
    options: { limit: 5 }
  });
  
  runner.assert(result.results, 'Should return query results');
  runner.assert(result.interpretation, 'Should include interpretation');
  runner.assert(result.recordCount === 2, 'Should count records correctly');
  runner.assert(result.queryType, 'Should have a query type');
  runner.assert(['smart_query', 'org_aware_query', 'context_bundle_query', 'dynamic_custom_field_query'].includes(result.queryType), 'Should identify query type correctly');
});

runner.test('ChatAgent can execute get_org_insights function', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const result = await agent.getOrgInsights({ objectName: 'Opportunity' });
  
  runner.assert(result.objectName === 'Opportunity', 'Should return correct object name');
  runner.assert(result.insights, 'Should return insights');
  runner.assert(result.insights.topFields, 'Should include top fields');
  runner.assert(result.orgContext, 'Should include org context');
  runner.assert(result.orgContext.availableFields === 5, 'Should count available fields');
});

runner.test('ChatAgent can create goals', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { openaiApiKey: 'test-key' });
  
  const result = await agent.createGoal('user123', {
    goalType: 'pipeline_health',
    context: { objectName: 'Opportunity' }
  });
  
  runner.assert(result.goalId, 'Should return goal ID');
  runner.assert(result.goalName.includes('Pipeline'), 'Should return goal name');
  runner.assert(result.steps.length > 0, 'Should return goal steps');
  runner.assertEqual(result.created, true, 'Should confirm creation');
});

// Org Context Tests
runner.test('ChatAgent gets org context correctly', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const context = await agent.getOrgContext();
  
  runner.assert(Array.isArray(context.objects), 'Should return objects array');
  runner.assert(context.objects.includes('Opportunity'), 'Should include Opportunity');
  runner.assert(context.objects.includes('Account'), 'Should include Account');
  runner.assertEqual(context.dynamicDiscovery, true, 'Should indicate dynamic discovery');
});

runner.test('ChatAgent interprets query results with context', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const queryResult = {
    results: { records: [{ Id: '001' }, { Id: '002' }] },
    suggestion: { title: 'Recent deals' },
    query: { object: 'Opportunity' }
  };
  
  const orgInsights = { summary: { fieldsCount: 50 } };
  
  const interpretation = agent.interpretQueryResults(queryResult, orgInsights);
  
  runner.assert(interpretation.summary.includes('2'), 'Should count records');
  runner.assert(interpretation.pattern.includes('Recent deals'), 'Should mention pattern used');
  runner.assert(interpretation.orgContext.includes('50'), 'Should include org context with field count');
});

// Goal Update Detection Tests
runner.test('ChatAgent detects goal-relevant updates', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { goalManager: { autoPersist: false }, llmAdapter: new MockLlmAdapter() });
  
  // Create a pipeline-related goal
  agent.goalManager.createGoal('pipeline_health', 'user123', { objectName: 'Opportunity' });
  
  const functionResult = {
    queryType: 'smart_query',
    query: { object: 'opportunity' },
    recordCount: 5
  };
  
  const updates = agent.checkForGoalUpdates('user123', functionResult);
  
  runner.assertEqual(updates.length, 1, 'Should find 1 goal update');
  runner.assert(updates[0].goalName.includes('Pipeline'), 'Should identify correct goal');
  runner.assert(updates[0].relevantData.includes('5'), 'Should mention record count');
});

// Conversation Statistics Tests
runner.test('ChatAgent provides conversation statistics', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  // Create conversation with some history
  const conversation = agent.getConversation('user123');
  conversation.history.push(
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  );
  
  const stats = agent.getConversationStats('user123');
  
  runner.assertEqual(stats.messageCount, 2, 'Should count messages correctly');
  runner.assert(stats.startedAt instanceof Date, 'Should have start time');
  runner.assert(typeof stats.duration === 'number', 'Should calculate duration');
});

runner.test('ChatAgent can clear conversation history', () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  // Create conversation
  const conversation = agent.getConversation('user123');
  conversation.history.push({ role: 'user', content: 'Test' });
  
  // Clear conversation
  agent.clearConversation('user123');
  
  // Check it's gone
  const stats = agent.getConversationStats('user123');
  runner.assertEqual(stats, null, 'Should return null for cleared conversation');
});

// Error Handling Tests
runner.test('ChatAgent handles function call errors gracefully', async () => {
  const mockSFDC = new MockSFDCClient();
  // Override method to throw error
  mockSFDC.describeObject = async () => {
    throw new Error('Mock SFDC error');
  };

  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });

  const result = await agent.executeFunctionCall('user123', {
    name: 'query_salesforce',
    arguments: JSON.stringify({ objectName: 'Opportunity', intent: 'test' })
  });

  runner.assert(result.error, 'Should return error in result');
  runner.assert(typeof result.error === 'string', 'Error should be a string');
  runner.assert(result.error.includes('Mock SFDC error'), 'Should include original error message');
  runner.assertEqual(result.function, 'query_salesforce', 'Should identify failed function');
});

runner.test('ChatAgent handles unknown functions gracefully', async () => {
  const mockSFDC = new MockSFDCClient();
  const agent = new ChatAgent(mockSFDC, { llmAdapter: new MockLlmAdapter() });
  
  const result = await agent.executeFunctionCall('user123', {
    name: 'unknown_function',
    arguments: '{}'
  });
  
  runner.assert(result.error, 'Should return error for unknown function');
  runner.assert(result.error.includes('Unknown function'), 'Should identify unknown function error');
});

// Export for use in other test files
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runner, MockSFDCClient, MockLlmAdapter };
