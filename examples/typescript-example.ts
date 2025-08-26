#!/usr/bin/env ts-node
/**
 * TypeScript Example for SFDC Helper Client SDK
 * 
 * This demonstrates the excellent TypeScript support with full IntelliSense,
 * type safety, and org-aware features.
 * 
 * Run with: npx ts-node examples/typescript-example.ts
 */

import { SFDCHelperClient, WhereCondition, SafeQueryOptions, SmartQueryResult } from '../types';

// Or using the default export:
// import SFDCHelper from '../types';
// const client = new SFDCHelper.SFDCHelperClient();

class TypeSafeSalesforceBot {
  private client: SFDCHelperClient;
  private initialized = false;

  constructor(baseUrl = 'http://localhost:3000') {
    this.client = new SFDCHelperClient(baseUrl, {
      timeout: 15000,
      retries: 3,
      retryDelay: 1000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Type-safe health check
      const health = await this.client.health();
      console.log(`🟢 Health: ${health.status}`);

      // Get org info with full type safety
      const orgInfo = await this.client.getOrgInfo();
      console.log(`🏢 Org: ${orgInfo.identity.organization_id}`);
      console.log(`👤 User: ${orgInfo.identity.display_name}`);
      console.log(`📊 API Limits: ${Object.keys(orgInfo.limits).length} tracked`);

      // Check dynamic discovery capabilities
      const stats = await this.client.getAllowlistStats();
      if (stats.dynamic && stats.stats) {
        console.log('🧠 Dynamic discovery active:');
        Object.entries(stats.stats).forEach(([obj, objStats]) => {
          console.log(`  ${obj}: ${objStats.totalFields} fields`);
        });
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Initialization failed: ${error}`);
    }
  }

  async findRecentOpportunities(days = 30): Promise<SmartQueryResult> {
    await this.initialize();

    // Type-safe where conditions
    const whereConditions: WhereCondition[] = [
      {
        field: 'CreatedDate',
        op: '=',
        value: `LAST_N_DAYS:${days}`
      }
    ];

    // Type-safe query options
    const queryOptions: SafeQueryOptions = {
      where: whereConditions,
      limit: 10,
      flatten: true,
      orderBy: {
        field: 'CreatedDate',
        direction: 'DESC'
      }
    };

    // Execute smart query with full type safety
    return this.client.executeSmartQuery(
      'Opportunity',
      `show me opportunities from last ${days} days`,
      queryOptions
    );
  }

  async analyzeObjectUsage(objectName: string): Promise<void> {
    await this.initialize();

    // Get comprehensive insights with type safety
    const insights = await this.client.getObjectInsights(objectName, { verbose: true });
    
    console.log(`\n📋 ${insights.summary.label} Analysis:`);
    console.log(`  Fields: ${insights.summary.fieldCount}`);
    console.log(`  Record Types: ${insights.recordTypes.length}`);
    console.log(`  Suggestions: ${insights.suggestions.length}`);

    // Type-safe access to top fields
    if (insights.topFields.length > 0) {
      console.log(`  Top Fields:`);
      insights.topFields.slice(0, 5).forEach(field => {
        console.log(`    ${field.field}: ${field.percentage}% usage`);
      });
    }

    // Type-safe picklist analysis
    if (insights.picklists.length > 0) {
      console.log(`  Picklists: ${insights.picklists.length} fields`);
      insights.picklists.slice(0, 3).forEach(picklist => {
        console.log(`    ${picklist.field}: ${picklist.values.length} values`);
      });
    }
  }

  async demonstrateTypeSafety(): Promise<void> {
    await this.initialize();

    // TypeScript will catch errors at compile time
    try {
      // ✅ This is type-safe
      const validQuery = await this.client.safeQuery('Opportunity', {
        fields: ['Id', 'Name', 'StageName'],
        where: [
          { field: 'StageName', op: 'IN', value: ['Prospecting', 'Qualification'] }
        ],
        limit: 5
      });
      console.log(`✅ Valid query returned ${validQuery.records.length} records`);

      // 🔍 IntelliSense will suggest available properties
      if (validQuery.records[0]) {
        const record = validQuery.records[0];
        console.log(`📝 Record ID: ${record.Id}`);
        // TypeScript knows record.attributes exists and has type/url properties
        console.log(`🏷️  Record Type: ${record.attributes.type}`);
      }

      // ❌ These would cause TypeScript compile errors:
      // const invalidOp = await this.client.safeQuery('Opportunity', {
      //   where: [{ field: 'Name', op: 'INVALID_OP', value: 'test' }] // TS Error: invalid operator
      // });

      // const invalidFormat = await this.client.safeQuery('Opportunity', {
      //   format: 'xml' // TS Error: 'xml' not in 'json' | 'ndjson' | 'csv'
      // });

    } catch (error) {
      console.error('Query error:', error);
    }
  }

  async generateOrgAwareContext(objectName: string): Promise<void> {
    await this.initialize();

    console.log(`\n🔄 Generating context bundle for ${objectName}...`);
    
    const result = await this.client.generateContextBundle(objectName, {
      persist: true,
      runQueries: true,
      sample: 25,
      verbose: false
    });

    if (result.ok && result.files) {
      console.log(`✅ Generated ${result.files.length} context files:`);
      result.files.forEach(file => console.log(`  📄 ${file}`));
      
      // Auto-refresh allowlist to learn from new context
      const refreshResult = await this.client.refreshAllowlist();
      console.log(`🧠 ${refreshResult.message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('🚀 TypeScript SFDC Helper Example\n');

  const bot = new TypeSafeSalesforceBot();

  try {
    // Demonstrate type-safe operations
    await bot.demonstrateTypeSafety();

    // Find recent opportunities with full type safety
    const recentOpps = await bot.findRecentOpportunities(30);
    console.log(`\n🎯 Smart Query Result:`);
    console.log(`  Intent: "${recentOpps.intent}"`);
    console.log(`  Suggestion: ${recentOpps.suggestion?.title || 'None'}`);
    console.log(`  Records: ${recentOpps.results.records.length}`);

    // Analyze object usage patterns
    await bot.analyzeObjectUsage('Opportunity');

    // Generate org-aware context (makes the system smarter)
    await bot.generateOrgAwareContext('Opportunity');

    console.log('\n✅ TypeScript example completed successfully!');
    console.log('🎉 Notice how TypeScript caught potential errors at compile time!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Export for testing
export { TypeSafeSalesforceBot };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
