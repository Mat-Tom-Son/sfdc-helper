'use strict';

/**
 * SFDC Helper Chat Agent - Easy Integration Package
 * 
 * Drop-in conversational AI for Salesforce with org-aware intelligence
 */

const ChatAgent = require('./ChatAgent');
const ContextBundleReader = require('./ContextBundleReader');
const GoalManager = require('./GoalManager');

/**
 * Simple factory function for easy setup
 */
function createChatAgent(sfdcClient, options = {}) {
  return new ChatAgent(sfdcClient, {
    agentName: options.agentName || 'Salesforce Assistant',
    model: options.model || 'gpt-4.1',
    temperature: options.temperature || 0.7,
    bundleDir: options.bundleDir || 'context_bundles',
    maxHistoryLength: options.maxHistoryLength || 20,
    ...options
  });
}

/**
 * Quick setup for common use cases
 */
const QuickSetup = {
  /**
   * Customer service agent - helpful and informative
   */
  customerService: (sfdcClient, options = {}) => createChatAgent(sfdcClient, {
    agentName: 'Customer Service Assistant',
    temperature: 0.6,
    model: 'gpt-4.1',
    ...options
  }),

  /**
   * Sales agent - proactive and goal-oriented
   */
  sales: (sfdcClient, options = {}) => createChatAgent(sfdcClient, {
    agentName: 'Sales Assistant',
    temperature: 0.7,
    model: 'gpt-4.1',
    ...options
  }),

  /**
   * Analytics agent - data-focused and precise
   */
  analytics: (sfdcClient, options = {}) => createChatAgent(sfdcClient, {
    agentName: 'Analytics Assistant',
    temperature: 0.3,
    model: 'gpt-4.1',
    ...options
  }),

  /**
   * Executive agent - high-level insights and summaries
   */
  executive: (sfdcClient, options = {}) => createChatAgent(sfdcClient, {
    agentName: 'Executive Assistant',
    temperature: 0.4,
    model: 'gpt-4.1',
    ...options
  })
};

/**
 * Utility functions for integration
 */
const Utils = {
  /**
   * Generate context bundles for an object
   */
  async generateContextBundle(sfdcClient, objectName, options = {}) {
    return await sfdcClient.generateContextBundle(objectName, {
      persist: true,
      runQueries: true,
      sample: 50,
      verbose: false,
      ...options
    });
  },

  /**
   * Setup context bundles for common objects
   */
  async setupCommonBundles(sfdcClient) {
    const objects = ['Opportunity', 'Account', 'Contact', 'Lead', 'Case'];
    const results = [];
    
    for (const objectName of objects) {
      try {
        console.log(`Setting up context bundle for ${objectName}...`);
        const result = await this.generateContextBundle(sfdcClient, objectName);
        results.push({ objectName, success: true, result });
      } catch (error) {
        console.warn(`Failed to setup ${objectName} bundle:`, error.message);
        results.push({ objectName, success: false, error: error.message });
      }
    }
    
    return results;
  },

  /**
   * Test chat agent with sample queries
   */
  async testChatAgent(chatAgent, userId = 'test_user') {
    const testQueries = [
      'Show me recent opportunities',
      'What deals are in our pipeline?',
      'Find opportunities with high likelihood',
      'Show me closed won deals'
    ];

    const results = [];
    
    for (const query of testQueries) {
      try {
        console.log(`Testing: "${query}"`);
        const startTime = Date.now();
        const response = await chatAgent.processMessage(userId, query);
        const duration = Date.now() - startTime;
        
        results.push({
          query,
          success: true,
          duration,
          recordCount: response.functionResult?.recordCount || 0,
          responsePreview: response.response?.substring(0, 100) + '...'
        });
      } catch (error) {
        results.push({
          query,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
};

module.exports = {
  ChatAgent,
  ContextBundleReader,
  GoalManager,
  createChatAgent,
  QuickSetup,
  Utils
};
