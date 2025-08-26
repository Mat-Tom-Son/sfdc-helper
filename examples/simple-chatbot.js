#!/usr/bin/env node
'use strict';

/**
 * Simple Chatbot Example using SFDC Helper Client SDK
 * 
 * This demonstrates how easy it is to build an org-aware Salesforce chatbot
 * that automatically adapts to each org's custom fields and usage patterns.
 */

const SFDCHelperClient = require('../src/client');

class SimpleSalesforceBot {
  constructor(sfdcBaseUrl = 'http://localhost:3000') {
    this.client = new SFDCHelperClient(sfdcBaseUrl);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Health check
      await this.client.health();
      
      // Get org info for context
      this.orgInfo = await this.client.getOrgInfo();
      
      // Check dynamic discovery capabilities
      this.stats = await this.client.getAllowlistStats();
      
      this.initialized = true;
      console.log(`🤖 Bot initialized for org: ${this.orgInfo.identity.organization_id}`);
      
      if (this.stats.dynamic) {
        console.log('🧠 Dynamic field discovery is active - bot will adapt to your org!');
      }
      
    } catch (error) {
      throw new Error(`Failed to initialize bot: ${error.message}`);
    }
  }

  async processQuery(userInput) {
    await this.initialize();
    
    const query = userInput.toLowerCase().trim();
    
    try {
      // Simple intent detection
      if (query.includes('opportunity') || query.includes('deal') || query.includes('opp')) {
        return await this.handleOpportunityQuery(query, userInput);
      }
      
      if (query.includes('account') || query.includes('customer') || query.includes('company')) {
        return await this.handleAccountQuery(query, userInput);
      }
      
      if (query.includes('case') || query.includes('support') || query.includes('ticket')) {
        return await this.handleCaseQuery(query, userInput);
      }
      
      if (query.includes('lead') || query.includes('prospect')) {
        return await this.handleLeadQuery(query, userInput);
      }
      
      if (query.includes('help') || query.includes('what can you do')) {
        return await this.showCapabilities();
      }
      
      return {
        response: "I can help you with Opportunities, Accounts, Cases, and Leads. Try asking something like 'show me recent opportunities' or 'find open cases'.",
        data: null
      };
      
    } catch (error) {
      return {
        response: `Sorry, I encountered an error: ${error.message}`,
        data: null,
        error: true
      };
    }
  }

  async handleOpportunityQuery(query, originalInput) {
    // Use smart query to understand intent and get org-appropriate results
    const result = await this.client.executeSmartQuery('Opportunity', originalInput, {
      limit: 5
    });
    
    const count = result.results.records?.length || 0;
    let response = `Found ${count} opportunities`;
    
    if (result.suggestion) {
      response += ` using "${result.suggestion.title}" pattern`;
    }
    
    if (count > 0) {
      const sample = result.results.records[0];
      const fields = Object.keys(sample).filter(k => k !== 'attributes');
      response += `\\nShowing fields: ${fields.slice(0, 6).join(', ')}${fields.length > 6 ? '...' : ''}`;
    }
    
    return {
      response,
      data: result.results.records,
      query: result.query,
      suggestion: result.suggestion
    };
  }

  async handleAccountQuery(query, originalInput) {
    // Get available fields for this org
    const availableFields = await this.client.getAvailableFields('Account');
    
    // Build query based on intent
    let whereClause = [];
    if (query.includes('recent')) {
      whereClause.push({ field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:30' });
    }
    
    const results = await this.client.safeQuery('Account', {
      fields: availableFields.slice(0, 8), // Use first 8 available fields
      where: whereClause,
      limit: 5
    });
    
    return {
      response: `Found ${results.records?.length || 0} accounts with ${availableFields.length} available fields in your org`,
      data: results.records,
      availableFields: availableFields.length
    };
  }

  async handleCaseQuery(query, originalInput) {
    const result = await this.client.executeSmartQuery('Case', originalInput, {
      limit: 5
    });
    
    return {
      response: `Found ${result.results.records?.length || 0} cases`,
      data: result.results.records
    };
  }

  async handleLeadQuery(query, originalInput) {
    const result = await this.client.executeSmartQuery('Lead', originalInput, {
      limit: 5
    });
    
    return {
      response: `Found ${result.results.records?.length || 0} leads`,
      data: result.results.records
    };
  }

  async showCapabilities() {
    const capabilities = [];
    
    // Check what objects are available in this org
    if (this.stats.dynamic) {
      Object.keys(this.stats.stats).forEach(objectName => {
        const stats = this.stats.stats[objectName];
        capabilities.push(`${objectName}: ${stats.totalFields} fields available`);
      });
    }
    
    return {
      response: `I'm an org-aware Salesforce assistant! Here's what I can access in your org:\\n\\n${capabilities.join('\\n')}\\n\\nTry asking me about opportunities, accounts, cases, or leads!`,
      data: this.stats
    };
  }
}

// Demo conversation
async function demo() {
  console.log('🚀 Simple Salesforce Chatbot Demo\\n');
  
  const bot = new SimpleSalesforceBot();
  
  // Sample queries to demonstrate org-awareness
  const queries = [
    'What can you do?',
    'Show me recent opportunities',
    'Find open cases',
    'Get account information',
    'Show me leads from this week'
  ];
  
  for (const query of queries) {
    console.log(`👤 User: ${query}`);
    
    try {
      const result = await bot.processQuery(query);
      console.log(`🤖 Bot: ${result.response}`);
      
      if (result.data && result.data.length > 0) {
        console.log(`📊 Data: ${result.data.length} records returned`);
        if (result.data[0]) {
          const fieldCount = Object.keys(result.data[0]).filter(k => k !== 'attributes').length;
          console.log(`📋 Fields: ${fieldCount} fields per record`);
        }
      }
      
      if (result.suggestion) {
        console.log(`💡 Used pattern: "${result.suggestion.title}"`);
      }
      
    } catch (error) {
      console.log(`🤖 Bot: Sorry, I had trouble with that: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('✅ Demo completed!');
}

if (require.main === module) {
  demo().catch(console.error);
}

module.exports = SimpleSalesforceBot;
