'use strict';

const GoalManager = require('./GoalManager');
const ContextBundleReader = require('./ContextBundleReader');
const { GoalTemplates } = require('./Goal');
const { BaseLlmAdapter, HttpLlmAdapter } = require('./LlmAdapter');

/**
 * ChatAgent - Goal-aware conversational AI for Salesforce
 * 
 * Combines conversational capabilities with goal tracking
 * and org-aware Salesforce intelligence to create a warm, helpful assistant.
 */
class ChatAgent {
  constructor(sfdcClient, options = {}) {
    this.sfdcClient = sfdcClient;
    this.goalManager = new GoalManager(options.goalManager || {});
    
    // Initialize context bundle reader for fast org-aware context
    this.contextReader = new ContextBundleReader(options.bundleDir);
    
    // Initialize LLM adapter (BYO-LLM). Prefer provided adapter, else optional HTTP adapter via env.
    this.llm = options.llmAdapter || (process.env.LLM_HTTP_URL ? new HttpLlmAdapter(process.env.LLM_HTTP_URL) : new BaseLlmAdapter());

    // Conversation memory - userId -> conversation history
    this.conversations = new Map();
    this.maxHistoryLength = options.maxHistoryLength || 20;

    // Agent personality and behavior settings
    this.agentName = options.agentName || 'Salesforce Assistant';
    this.temperature = options.temperature || 0.7;
    this.model = options.model || 'gpt-4.1';

    // Initialize function definitions for tools
    this.functions = this.initializeFunctions();
  }

  /**
   * Initialize tool function definitions
   */
  initializeFunctions() {
    return [
      {
        name: 'query_salesforce',
        description: 'Query Salesforce data using org-aware patterns and smart suggestions',
        parameters: {
          type: 'object',
          properties: {
            objectName: {
              type: 'string',
              description: 'Salesforce object to query (e.g., Opportunity, Account, Case)'
            },
            intent: {
              type: 'string', 
              description: 'Natural language description of what the user wants to find'
            },
            options: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Maximum number of records to return' },
                fields: { type: 'array', items: { type: 'string' }, description: 'Specific fields to include' }
              }
            }
          },
          required: ['objectName', 'intent']
        }
      },
      {
        name: 'get_org_insights',
        description: 'Get contextual insights about the Salesforce org configuration and patterns',
        parameters: {
          type: 'object',
          properties: {
            objectName: {
              type: 'string',
              description: 'Salesforce object to analyze'
            }
          },
          required: ['objectName']
        }
      },
      {
        name: 'create_goal',
        description: 'Create a new goal to help the user accomplish something over multiple conversation turns',
        parameters: {
          type: 'object',
          properties: {
            goalType: {
              type: 'string',
              enum: ['pipeline_health', 'deal_rescue', 'forecast_accuracy', 'territory_analysis', 'customer_health', 'sales_process_optimization', 'custom'],
              description: 'Type of goal to create'
            },
            description: {
              type: 'string',
              description: 'Custom description for the goal'
            },
            customSteps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Custom steps for the goal (only for custom goal type)'
            },
            context: {
              type: 'object',
              description: 'Initial context or parameters for the goal'
            }
          },
          required: ['goalType']
        }
      },
      {
        name: 'update_goal_progress',
        description: 'Update progress on an active goal with new findings or completed steps',
        parameters: {
          type: 'object',
          properties: {
            goalId: {
              type: 'string',
              description: 'ID of the goal to update'
            },
            stepResult: {
              type: 'object',
              description: 'Results or findings from the completed step'
            },
            insights: {
              type: 'string',
              description: 'Key insights or observations from this step'
            }
          },
          required: ['goalId', 'stepResult']
        }
      },
      {
        name: 'get_active_goals',
        description: 'Get information about the user\'s currently active goals',
        parameters: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID to get goals for'
            }
          },
          required: ['userId']
        }
      },
      {
        name: 'lookup_user',
        description: 'Find salespeople/users by name, alias, or email for territory and owner filtering',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Name, alias, or partial name to search for'
            },
            field: {
              type: 'string',
              enum: ['Name', 'Alias', 'Email'],
              description: 'Field to search in (defaults to Name)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'query_territory_data',
        description: 'Query opportunities or other data filtered by salesperson/owner with territory analysis',
        parameters: {
          type: 'object',
          properties: {
            objectName: {
              type: 'string',
              description: 'Salesforce object to query (e.g., Opportunity, Account)'
            },
            intent: {
              type: 'string',
              description: 'Natural language description of what to analyze'
            },
            ownerName: {
              type: 'string',
              description: 'Salesperson name to filter by (optional)'
            },
            ownerId: {
              type: 'string',
              description: 'Salesperson ID to filter by (optional)'
            },
            options: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Maximum records to return' },
                includeTeamComparison: { type: 'boolean', description: 'Include team performance comparison' }
              }
            }
          },
          required: ['objectName', 'intent']
        }
      }
    ];
  }

  /**
   * Build system prompt with goal awareness and org context
   */
  buildSystemPrompt(userId, orgContext = {}) {
    const activeGoals = this.goalManager.getActiveGoals(userId);

    return `You are ${this.agentName}, a warm and knowledgeable Salesforce assistant with deep understanding of this specific org and its salespeople.

PERSONALITY:
- Conversational and friendly (like talking to a helpful sales colleague)
- Knowledgeable about this org's specific setup, patterns, and sales team
- Focused on being genuinely helpful with territory management and sales performance
- Proactive in offering insights and suggestions for sales success

ORG CONTEXT:
- Available objects: ${orgContext.objects?.join(', ') || 'Loading...'}
- Dynamic field discovery: ${orgContext.dynamicDiscovery ? 'Active - I automatically discover and use your custom fields' : 'Standard setup'}
- Your org has unique field configurations including custom fields (ending in __c)
- I understand your specific business processes, field usage patterns, and sales methodology

SALESPERSON INTELLIGENCE:
- I can look up users/salespeople by name, alias, or email using the lookup_user function
- I understand territory-based queries like "my deals", "Sarah's pipeline", "team performance"
- I can filter any query by owner/salesperson for territory analysis
- I recognize sales performance patterns: at-risk deals, proposal deadlines, win/loss analysis
- I provide territory-specific insights and comparative analysis

CONVERSATION APPROACH:
- Listen to what the user is trying to accomplish with their sales data
- Use your org's actual discovered fields (including custom fields like Likelihood__c, Primary_Service_Area__c)
- Always mention "your org" or "in your org" to emphasize org-specific context
- When users mention names, I can look them up and filter data accordingly
- Explain WHY findings are significant for THIS specific org's sales process
- Reference custom fields and business processes unique to this org's sales methodology
- Provide insights based on actual field usage patterns and territory performance
- Offer actionable next steps tailored to their org configuration and sales processes

TERRITORY & OWNER AWARENESS:
- When users say "my", "mine", "my deals", I understand they want owner-filtered results
- I can analyze performance by salesperson, territory, or service area
- I recognize sales-specific language: pipeline, at-risk, proposals, win rate, territory
- I can provide comparative analysis between salespeople or territories
- I understand the sales cycle and can identify bottlenecks or opportunities

BACKGROUND CONTEXT:${activeGoals.length > 0 ? `
- We have ${activeGoals.length} ongoing project${activeGoals.length > 1 ? 's' : ''} I'm helping with
- I'll mention relevant updates naturally when they relate to our conversation` : ''}

RESPONSE STYLE:
- Be conversational and natural (like a sales operations colleague)
- Focus on the user's actual needs and sales objectives
- Use org-specific insights to add value to their sales process
- Suggest helpful follow-ups for sales performance improvement
- Keep goal tracking subtle and contextual
- Always consider the sales/territory context in responses

Remember: I'm here to help you understand your Salesforce sales data, manage territories, analyze performance, and make better sales decisions. I understand both the data and the sales context behind it.`;
  }

  /**
   * Process a user message with full goal and context awareness
   */
  async processMessage(userId, message, options = {}) {
    try {
      // Get conversation history
      const conversation = this.getConversation(userId);
      
      // Get org context
      const orgContext = await this.getOrgContext();
      
      // Build goal-aware system prompt
      const systemPrompt = this.buildSystemPrompt(userId, orgContext);
      
      // Prepare messages for the LLM
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversation.history.slice(-this.maxHistoryLength),
        { role: 'user', content: message }
      ];

      // Call LLM with tool calling
      const response = await this.llm.createChatCompletion({
        model: this.model,
        messages,
        tools: this.functions,
        toolChoice: 'auto',
        temperature: this.temperature,
        maxTokens: options.maxTokens || 1000
      });

      const choice = response.choices[0];
      const responseMessage = choice.message;

      // Handle function calls
      if (responseMessage.function_call) {
        const functionResult = await this.executeFunctionCall(
          userId, 
          responseMessage.function_call
        );

        // Add function call and result to conversation
        conversation.history.push(
          { role: 'assistant', content: null, function_call: responseMessage.function_call },
          { role: 'function', name: responseMessage.function_call.name, content: JSON.stringify(functionResult) }
        );

        // Get follow-up response from LLM
        const followUpMessages = [
          { role: 'system', content: systemPrompt },
          ...conversation.history.slice(-this.maxHistoryLength)
        ];

        const followUpResponse = await this.llm.createChatCompletion({
          model: this.model,
          messages: followUpMessages,
          temperature: this.temperature,
          maxTokens: options.maxTokens || 1000
        });

        const finalMessage = followUpResponse.choices[0].message;
        
        // Add to conversation history
        conversation.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: finalMessage.content }
        );

        return {
          response: finalMessage.content,
          functionCalled: responseMessage.function_call.name,
          functionResult: functionResult,
          goalUpdates: this.checkForGoalUpdates(userId, functionResult)
        };
      } else {
        // Regular text response
        conversation.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: responseMessage.content }
        );

        return {
          response: responseMessage.content,
          goalUpdates: this.checkForGoalUpdates(userId, { query: message })
        };
      }

    } catch (error) {
      console.error('[ChatAgent] Error processing message:', error);
      
      return {
        response: "I apologize, but I encountered an error processing your request. Please try again or rephrase your question.",
        error: error.message
      };
    }
  }

  /**
   * Execute tool function calls
   */
  async executeFunctionCall(userId, functionCall) {
    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);

    try {
      switch (name) {
        case 'query_salesforce':
          return await this.querySalesforce(parsedArgs);

        case 'get_org_insights':
          return await this.getOrgInsights(parsedArgs);

        case 'create_goal':
          return await this.createGoal(userId, parsedArgs);

        case 'update_goal_progress':
          return await this.updateGoalProgress(parsedArgs);

        case 'get_active_goals':
          return await this.getActiveGoals(userId);

        case 'lookup_user':
          return await this.lookupUser(parsedArgs);

        case 'query_territory_data':
          return await this.queryTerritoryData(parsedArgs);

        default:
          throw new Error(`Unknown function: ${name}`);
      }
    } catch (error) {
      console.error(`[ChatAgent] Function ${name} failed:`, error);
      return {
        error: error.message,
        function: name,
        arguments: parsedArgs
      };
    }
  }

  /**
   * Query Salesforce with complete org-aware intelligence
   */
  async querySalesforce({ objectName, intent, options = {} }) {
    // Get complete org schema first for enhanced suggestions
    const describe = await this.sfdcClient.describeObject(objectName);
    const allFields = describe.fields.map(f => f.name);
    const customFields = allFields.filter(f => f.includes('__c'));

    // Try enhanced query suggestions (bundles + dynamic custom field queries)
    const suggestions = await this.contextReader.getEnhancedQuerySuggestions(
      objectName, intent, allFields, customFields
    );
    
    if (suggestions.length > 0) {
      // Use the best matching suggestion
      const bestSuggestion = suggestions[0];
      const suggestionType = bestSuggestion.isDynamic ? 'dynamic custom field' : 'context bundle';
      console.log(`[ChatAgent] Using ${suggestionType} suggestion: ${bestSuggestion.title}`);
      
      // Apply owner filtering if specified
      const queryPayload = { ...bestSuggestion.payload };
      this.applyOwnerFiltering(queryPayload, options);
      
      const result = await this.sfdcClient.safeQuery(objectName, {
        ...queryPayload,
        limit: options.limit || bestSuggestion.payload.limit || 10
      });

      return {
        intent,
        suggestion: bestSuggestion,
        query: queryPayload,
        results: result,
        recordCount: result.records?.length || 0,
        queryType: bestSuggestion.isDynamic ? 'dynamic_custom_field_query' : 'context_bundle_query',
        records: result.records || [],
        bundleUsed: !bestSuggestion.isDynamic,
        dynamicQuery: bestSuggestion.isDynamic || false,
        ownerFiltered: !!(options.ownerId || options.ownerName)
      };
    }

    // Fallback to intelligent field selection if no suggestions available
    console.log(`[ChatAgent] No context suggestions found, using intelligent field selection`);
    
    // We already have the field data from above
    const standardFields = allFields.filter(f => !f.includes('__c') && !f.includes('.'));

    // Intelligently select fields based on intent and object type
    const queryFields = options.fields || this.selectIntelligentFields(objectName, intent, allFields, customFields);
    
    // Create query payload with owner filtering
    const queryPayload = {
      fields: queryFields,
      limit: options.limit || 10,
      ...options
    };
    this.applyOwnerFiltering(queryPayload, options);
    
    // Use direct safeQuery instead of executeSmartQuery to avoid expensive insights
    const result = await this.sfdcClient.safeQuery(objectName, queryPayload);

    // Create a lightweight result structure similar to executeSmartQuery
    const queryResult = {
      intent,
      suggestion: null, // We're doing intelligent selection ourselves
      query: {
        object: objectName,
        fields: queryFields,
        limit: options.limit || 10
      },
      results: result
    };

    // Add rich contextual interpretation with org awareness (without expensive insights)
    const interpretation = this.interpretQueryResults(queryResult, null, allFields, customFields);
    
    return {
      ...queryResult,
      interpretation,
      recordCount: result.records?.length || 0,
      queryType: 'org_aware_query',
      records: result.records || [],
      orgContext: {
        totalFieldsInOrg: allFields.length,
        customFieldsInOrg: customFields.length,
        standardFieldsInOrg: standardFields.length,
        fieldsUsed: queryFields,
        customFieldsUsed: queryFields.filter(f => f.includes('__c')),
        intelligentSelection: true
      }
    };
  }

  /**
   * Get org insights for contextual understanding
   */
  async getOrgInsights({ objectName }) {
    const insights = await this.sfdcClient.getObjectInsights(objectName);
    const allowlist = await this.sfdcClient.getAllowlist();
    const objSpec = (allowlist.objects && allowlist.objects[objectName]) || allowlist[objectName] || {};
    
    return {
      objectName,
      insights: {
        summary: insights.summary,
        topFields: insights.topFields?.slice(0, 8),
        suggestions: insights.suggestions?.slice(0, 5),
        fieldCount: insights.summary?.fieldsCount,
        allowlisted: insights.summary?.allowlist?.allowlisted
      },
      orgContext: {
        availableFields: Array.isArray(objSpec.fields) ? objSpec.fields.length : 0,
        defaultFields: objSpec.defaultFields || []
      }
    };
  }

  /**
   * Create a new goal
   */
  async createGoal(userId, { goalType, description, customSteps, context = {} }) {
    const goal = this.goalManager.createGoal(goalType, userId, context, customSteps);
    
    return {
      goalId: goal.id,
      goalName: goal.template?.name || description || goalType,
      steps: goal.getSteps(),
      currentStep: goal.getCurrentStep(),
      progress: goal.getProgressSummary(),
      created: true
    };
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress({ goalId, stepResult, insights }) {
    const result = this.goalManager.updateGoalProgress(goalId, stepResult, insights);
    
    return {
      goalId,
      advanced: result.advanced,
      completed: result.completed,
      progress: result.goal.getProgressSummary(),
      nextStep: result.goal.getCurrentStep()
    };
  }

  /**
   * Get active goals for user
   */
  async getActiveGoals(userId) {
    const goals = this.goalManager.getActiveGoals(userId);
    
    return {
      activeGoals: goals.map(goal => ({
        id: goal.id,
        name: goal.template?.name || goal.type,
        progress: goal.getProgressSummary(),
        currentStep: goal.getCurrentStep(),
        context: goal.context
      })),
      count: goals.length
    };
  }

  /**
   * Get conversation history for a user
   */
  getConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        userId,
        startedAt: new Date(),
        history: []
      });
    }
    return this.conversations.get(userId);
  }

  /**
   * Get org context for system prompt
   */
  async getOrgContext() {
    try {
      const [allowlist, stats] = await Promise.all([
        this.sfdcClient.getAllowlist(),
        this.sfdcClient.getAllowlistStats()
      ]);

      const objectNames = allowlist.objects ? Object.keys(allowlist.objects) : Object.keys(allowlist);

      return {
        objects: objectNames,
        dynamicDiscovery: !!stats.dynamic,
        fieldPatterns: stats.dynamic ? 'org-specific' : 'standard'
      };
    } catch (error) {
      console.warn('[ChatAgent] Failed to get org context:', error.message);
      return {};
    }
  }

  /**
   * Intelligently select fields based on query intent and object type
   */
  selectIntelligentFields(objectName, intent, allFields, customFields) {
    const intentLower = intent.toLowerCase();
    let selectedFields = [];

    // Always include core fields
    const coreFields = ['Id', 'Name'];
    selectedFields.push(...coreFields.filter(f => allFields.includes(f)));

    // Object-specific intelligent field selection
    if (objectName === 'Opportunity') {
      const opportunityFields = ['StageName', 'Amount', 'CloseDate', 'IsClosed', 'IsWon'];
      selectedFields.push(...opportunityFields.filter(f => allFields.includes(f)));

      // Add probability/likelihood fields if they exist
      const probabilityFields = allFields.filter(f => 
        f.toLowerCase().includes('probability') || 
        f.toLowerCase().includes('likelihood') ||
        f.toLowerCase().includes('score')
      );
      selectedFields.push(...probabilityFields.slice(0, 2));

      // Intent-based field selection
      if (intentLower.includes('forecast') || intentLower.includes('predict')) {
        const forecastFields = allFields.filter(f => 
          f.toLowerCase().includes('forecast') || 
          f.toLowerCase().includes('expected') ||
          f.toLowerCase().includes('projected')
        );
        selectedFields.push(...forecastFields.slice(0, 2));
      }

      if (intentLower.includes('owner') || intentLower.includes('rep') || intentLower.includes('sales')) {
        if (allFields.includes('Owner.Name')) selectedFields.push('Owner.Name');
        if (allFields.includes('OwnerId')) selectedFields.push('OwnerId');
      }
    }

    if (objectName === 'Account') {
      const accountFields = ['Type', 'Industry', 'AnnualRevenue', 'NumberOfEmployees'];
      selectedFields.push(...accountFields.filter(f => allFields.includes(f)));
    }

    // Add relevant custom fields (limit to avoid query length issues)
    const relevantCustomFields = customFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return intentLower.split(' ').some(word => 
        fieldLower.includes(word) || word.includes(fieldLower.replace('__c', ''))
      );
    });
    selectedFields.push(...relevantCustomFields.slice(0, 3));

    // If we don't have many fields yet, add some high-value custom fields
    if (selectedFields.length < 8) {
      const additionalCustomFields = customFields
        .filter(f => !selectedFields.includes(f))
        .slice(0, 8 - selectedFields.length);
      selectedFields.push(...additionalCustomFields);
    }

    // Remove duplicates and limit total fields
    return [...new Set(selectedFields)].slice(0, 12);
  }

  /**
   * Interpret query results with comprehensive org context
   */
  interpretQueryResults(result, orgInsights, allFields = [], customFields = []) {
    const recordCount = result.results?.records?.length || 0;
    const suggestion = result.suggestion;
    const objectName = result.query?.object || 'records';
    const fieldsUsed = result.orgContext?.fieldsUsed || [];
    const customFieldsUsed = fieldsUsed.filter(f => f.includes('__c'));
    
    return {
      summary: `Found ${recordCount} ${objectName} records from your org`,
      pattern: suggestion ? `using your org's "${suggestion.title}" pattern` : 'using intelligent field selection',
      significance: recordCount > 0 ? 
        `These ${recordCount} records include data from ${allFields.length} total fields available in your org` : 
        'No matching records found in your org with the current criteria',
      orgContext: `Your org has ${allFields.length} total fields for ${objectName} (${customFields.length} custom fields, ${allFields.length - customFields.length} standard)`,
      fieldInsights: customFieldsUsed.length > 0 ? 
        `Query used ${customFieldsUsed.length} of your custom fields: ${customFieldsUsed.join(', ')}` : 
        `Query used ${fieldsUsed.length} fields - your org has ${customFields.length} additional custom fields available`,
      businessContext: customFields.length > 0 ? 
        `Your org's custom fields include: ${customFields.slice(0, 5).join(', ')}${customFields.length > 5 ? ` and ${customFields.length - 5} more` : ''}` :
        'Using standard Salesforce fields for this query'
    };
  }

  /**
   * Check if recent activity relates to active goals
   */
  checkForGoalUpdates(userId, functionResult) {
    const activeGoals = this.goalManager.getActiveGoals(userId);
    const updates = [];

    for (const goal of activeGoals) {
      // Simple pattern matching - could be enhanced
      const goalType = goal.type.toLowerCase();
      const currentStep = goal.getCurrentStep()?.toLowerCase() || '';
      
      // Check if function result relates to this goal
      if (functionResult.queryType === 'smart_query') {
        const objectName = functionResult.query?.object?.toLowerCase();
        const recordCount = functionResult.recordCount;
        
        if ((goalType.includes('pipeline') && objectName === 'opportunity') ||
            (goalType.includes('deal') && objectName === 'opportunity') ||
            (goalType.includes('customer') && objectName === 'account')) {
          
          updates.push({
            goalId: goal.id,
            goalName: goal.template?.name || goal.type,
            relevantData: `Found ${recordCount} ${objectName} records`,
            suggestion: recordCount > 0 ? 
              'This data could help with your goal analysis' : 
              'Consider adjusting search criteria for better results'
          });
        }
      }
    }

    return updates;
  }

  /**
   * Clear conversation history for a user
   */
  clearConversation(userId) {
    this.conversations.delete(userId);
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(userId) {
    const conversation = this.conversations.get(userId);
    if (!conversation) return null;

    return {
      messageCount: conversation.history.length,
      startedAt: conversation.startedAt,
      duration: Date.now() - conversation.startedAt.getTime()
    };
  }

  /**
   * Lookup users/salespeople by name, alias, or email
   */
  async lookupUser({ query, field = 'Name' }) {
    try {
      const result = await this.sfdcClient.safeQuery('User', {
        fields: ['Id', 'Name', 'Alias', 'Email', 'IsActive', 'UserRole.Name', 'Profile.Name', 'Title'],
        where: [
          { field, op: 'LIKE', value: `%${query}%` },
          { field: 'IsActive', op: '=', value: true }
        ],
        limit: 10
      });

      return {
        users: result.records || [],
        searchQuery: query,
        searchField: field,
        resultCount: result.records?.length || 0
      };
    } catch (error) {
      console.error('[ChatAgent] User lookup failed:', error);
      return {
        users: [],
        error: error.message,
        searchQuery: query
      };
    }
  }

  /**
   * Query territory data with salesperson filtering and analysis
   */
  async queryTerritoryData({ objectName, intent, ownerName, ownerId, options = {} }) {
    // Enhance options with owner filtering
    const enhancedOptions = { ...options };
    if (ownerId) enhancedOptions.ownerId = ownerId;
    if (ownerName) enhancedOptions.ownerName = ownerName;

    // Use the enhanced querySalesforce with owner filtering
    const result = await this.querySalesforce({ 
      objectName, 
      intent: `${intent} ${ownerName ? `for ${ownerName}` : ''}`.trim(), 
      options: enhancedOptions 
    });

    // Add territory-specific analysis
    const territoryAnalysis = await this.analyzeTerritoryPerformance(result, objectName, ownerName || ownerId);

    return {
      ...result,
      territoryAnalysis,
      salesperson: ownerName || ownerId,
      queryType: 'territory_analysis'
    };
  }

  /**
   * Apply owner filtering to query payload
   */
  applyOwnerFiltering(queryPayload, options) {
    if (!options.ownerId && !options.ownerName) return;

    queryPayload.where = queryPayload.where || [];

    if (options.ownerId) {
      queryPayload.where.push({ field: 'OwnerId', op: '=', value: options.ownerId });
    } else if (options.ownerName) {
      queryPayload.where.push({ field: 'Owner.Name', op: 'LIKE', value: `%${options.ownerName}%` });
    }

    // Ensure Owner.Name is included in fields for territory analysis
    if (queryPayload.fields && !queryPayload.fields.includes('Owner.Name')) {
      queryPayload.fields.push('Owner.Name');
    }
  }

  /**
   * Analyze territory performance based on query results
   */
  async analyzeTerritoryPerformance(queryResult, objectName, salesperson) {
    const records = queryResult.records || [];
    
    if (records.length === 0) {
      return {
        summary: `No ${objectName} records found for ${salesperson || 'this salesperson'}`,
        metrics: {},
        insights: ['Consider expanding search criteria or checking data availability']
      };
    }

    const analysis = {
      recordCount: records.length,
      salesperson: salesperson,
      objectType: objectName
    };

    // Opportunity-specific analysis
    if (objectName === 'Opportunity') {
      const amounts = records
        .map(r => parseFloat(r.Amount))
        .filter(a => !isNaN(a));
      
      const closedWon = records.filter(r => r.StageName === 'Closed Won' || r.IsWon === true);
      const closedLost = records.filter(r => r.StageName === 'Closed Lost' || (r.IsClosed === true && r.IsWon === false));
      const pipeline = records.filter(r => r.IsClosed === false);

      analysis.metrics = {
        totalValue: amounts.reduce((sum, amt) => sum + amt, 0),
        averageValue: amounts.length > 0 ? amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length : 0,
        pipelineCount: pipeline.length,
        closedWonCount: closedWon.length,
        closedLostCount: closedLost.length,
        winRate: (closedWon.length + closedLost.length) > 0 ? 
          (closedWon.length / (closedWon.length + closedLost.length) * 100).toFixed(1) : 'N/A'
      };

      analysis.insights = [];
      if (analysis.metrics.totalValue > 0) {
        analysis.insights.push(`Total pipeline value: $${analysis.metrics.totalValue.toLocaleString()}`);
      }
      if (analysis.metrics.winRate !== 'N/A') {
        analysis.insights.push(`Win rate: ${analysis.metrics.winRate}%`);
      }
      if (pipeline.length > 0) {
        analysis.insights.push(`${pipeline.length} active opportunities in pipeline`);
      }
    }

    return analysis;
  }
}

module.exports = ChatAgent;
