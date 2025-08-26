# 🚀 SFDC Helper

**The Org-Aware Salesforce API Layer for Modern Applications**

An intelligent, self-learning Salesforce API layer that automatically adapts to each org's unique configuration. Perfect for chatbots, admin tools, and any application that needs to work seamlessly across different Salesforce orgs without manual configuration.

## ✨ What Makes This Special

🧠 **Self-Learning**: Automatically discovers and learns from your org's actual field usage, list views, and data patterns  
🛡️ **Safe by Design**: Read-only with built-in allowlists and query validation  
🎯 **Org-Aware**: Adapts to custom fields, record types, and business processes automatically  
🤖 **Chatbot Ready**: Natural language intent → smart SOQL queries  
📊 **Rich Context**: Generates comprehensive org documentation and insights  
🔧 **Developer Friendly**: Full TypeScript support with excellent IntelliSense

## 🎯 Perfect For

- **Chatbots & AI Assistants** that need to understand each org's unique setup
- **Admin Tools** that work across different Salesforce configurations  
- **Data Analysis** applications that adapt to custom fields and processes
- **Integration Platforms** that need org-aware Salesforce connectivity

## 🚀 Quick Start

### Installation

```bash
npm install sfdc-helper
# or
yarn add sfdc-helper
```

### Basic Usage (Client SDK)

```javascript
const { SFDCHelperClient } = require('sfdc-helper');

// Initialize client
const client = new SFDCHelperClient('http://localhost:3000');

// The client automatically discovers what fields are available in YOUR org
const opportunities = await client.safeQuery('Opportunity', {
  where: [{ field: 'StageName', op: 'IN', value: ['Proposal', 'Negotiation'] }],
  limit: 10,
  flatten: true  // Flattens relationships like Owner.Name -> owner_name
});

console.log(`Found ${opportunities.records.length} opportunities`);
```

### Smart Queries (Natural Language → SOQL)

```javascript
// The system learns from your org's usage patterns
const result = await client.executeSmartQuery(
  'Opportunity', 
  'show me recent deals that are likely to close'
);

console.log(`Intent: "${result.intent}"`);
console.log(`Used pattern: "${result.suggestion?.title}"`);
console.log(`Records: ${result.results.records.length}`);
```

### TypeScript Support

```typescript
import { SFDCHelperClient, WhereCondition } from 'sfdc-helper';

const client = new SFDCHelperClient();

// Full type safety and IntelliSense
const conditions: WhereCondition[] = [
  { field: 'CreatedDate', op: '=', value: 'LAST_N_DAYS:30' }
];

const result = await client.safeQuery('Opportunity', {
  where: conditions,
  limit: 5
});
```

## 🧠 Org-Aware Intelligence

Unlike static Salesforce tools, SFDC Helper **learns from your org**:

### Dynamic Field Discovery
```javascript
// Automatically discovers ALL fields used in your org
const fields = await client.getAvailableFields('Opportunity');
console.log(`Your org uses ${fields.length} Opportunity fields`);

// Includes custom fields, relationships, and formula fields
// No manual configuration required!
```

### Context Generation
```javascript
// Generates comprehensive org documentation
await client.generateContextBundle('Opportunity', {
  persist: true,      // Save to disk
  runQueries: true,   // Include sample data
  sample: 50         // Analyze 50 records
});

// Creates detailed markdown files with:
// - Field usage patterns
// - Validation rules  
// - List views and their queries
// - Picklist values
// - Automation analysis
// - And much more!
```

### Smart Suggestions
The system analyzes your org's list views, validation rules, and usage patterns to suggest intelligent queries:

```javascript
const insights = await client.getObjectInsights('Opportunity');

// Get suggestions based on actual org usage
insights.suggestions.forEach(suggestion => {
  console.log(`${suggestion.title}: ${suggestion.description}`);
});
```

## 🖥️ Server Setup

SFDC Helper runs as a lightweight server that your applications connect to:

### 1. Environment Configuration
```bash
# Create .env file with your Salesforce credentials
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret  
SF_REDIRECT_URI=http://localhost:3978/oauth/callback
SF_REFRESH_TOKEN=your_oauth_refresh_token
SF_INSTANCE_URL=https://yourinstance.my.salesforce.com
```

### 2. Start the Server
```bash
npm start
# or after installing globally
npx sfdc-helper
```

### 3. Verify It's Working
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

The server automatically:
- 🔄 **Analyzes your org** on startup (discovers custom fields, usage patterns)
- 🧠 **Builds dynamic allowlists** from your actual data
- 📊 **Generates insights** about field usage and patterns
- 🎯 **Creates smart query suggestions** based on your list views

## 🤖 Chatbot Integration Examples

### Simple Chatbot Class
```javascript
const { SFDCHelperClient } = require('sfdc-helper');

class SalesforceBot {
  constructor() {
    this.client = new SFDCHelperClient('http://localhost:3000');
  }

  async handleQuery(userInput) {
    // Simple intent detection
    if (userInput.includes('opportunities') || userInput.includes('deals')) {
      return this.handleOpportunities(userInput);
    }
    
    if (userInput.includes('accounts') || userInput.includes('customers')) {
      return this.handleAccounts(userInput);
    }
    
    return { message: "I can help with opportunities, accounts, cases, and leads!" };
  }

  async handleOpportunities(query) {
    // Use smart query to understand intent
    const result = await this.client.executeSmartQuery('Opportunity', query, {
      limit: 5
    });
    
    return {
      message: `Found ${result.results.records.length} opportunities`,
      data: result.results.records,
      suggestion: result.suggestion?.title
    };
  }
}

// Usage
const bot = new SalesforceBot();
const response = await bot.handleQuery("show me recent opportunities");
```

### Framework Integration Examples

#### Express.js API
```javascript
const express = require('express');
const { SFDCHelperClient } = require('sfdc-helper');

const app = express();
const sfdc = new SFDCHelperClient();

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  try {
    // Smart query based on user intent
    const result = await sfdc.executeSmartQuery('Opportunity', message);
    
    res.json({
      response: `Found ${result.results.records.length} opportunities`,
      data: result.results.records.slice(0, 3), // Limit for chat
      context: result.suggestion?.title
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Discord Bot
```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { SFDCHelperClient } = require('sfdc-helper');

const discord = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const sfdc = new SFDCHelperClient();

discord.on('messageCreate', async (message) => {
  if (message.content.startsWith('!sf ')) {
    const query = message.content.substring(4);
    
    try {
      const result = await sfdc.executeSmartQuery('Opportunity', query, { limit: 3 });
      
      const embed = {
        title: `Salesforce Query Results`,
        description: `Found ${result.results.records.length} opportunities`,
        fields: result.results.records.map(record => ({
          name: record.Name || record.Id,
          value: `Stage: ${record.StageName || 'N/A'}\\nAmount: ${record.Amount || 'N/A'}`,
          inline: true
        }))
      };
      
      message.reply({ embeds: [embed] });
    } catch (error) {
      message.reply(`Error: ${error.message}`);
    }
  }
});
```

## 📚 API Reference

### Client SDK Methods

#### Core Data Access
- `client.safeQuery(objectName, options)` - Safe, allowlisted queries
- `client.query(soql, options)` - Raw SOQL (use with caution)
- `client.search(sosl)` - Cross-object SOSL search
- `client.getRecentRecords(objectName, limit)` - Recent records
- `client.getChanges(objectName, since, limit)` - Changes since timestamp

#### Org Discovery
- `client.getAvailableFields(objectName)` - Fields available in this org
- `client.getDefaultFields(objectName)` - Recommended default fields
- `client.describeObject(objectName)` - Full object metadata
- `client.getPicklists(objectName)` - Picklist values
- `client.getAllowlistStats()` - Dynamic discovery statistics

#### Smart Features
- `client.buildSmartQuery(objectName, intent)` - Intent → query structure
- `client.executeSmartQuery(objectName, intent)` - Intent → results
- `client.getObjectInsights(objectName)` - Comprehensive analysis
- `client.generateContextBundle(objectName, options)` - Generate org docs

### REST API Endpoints
- Auth/org
  - `GET /health` – health check
  - `GET /me` – identity (user/org)
  - `GET /limits` – org limits

- Schema
  - `GET /allowlist` – allowlisted objects/fields + defaults
  - `GET /describe` – global describe
  - `GET /sobjects/:name/describe` – object describe
  - `GET /sobjects/:name/picklists` – flattened picklists

- Data (read-only)
  - `GET /query?soql=...&limit=...&next=...` – raw SOQL with pagination
  - `POST /query` – raw SOQL via body
  - `POST /safe-query` – allowlisted builder with operator validation and optional flattening
  - `POST /search` – SOSL
  - `GET /sobjects/:name/recent-records?limit=...` – user-centric recent items
  - `GET /changes/:name?since=ISO&limit=...` – changes via `SystemModstamp` or `LastModifiedDate`

- Analytics
  - `GET /analytics/top-fields?object=...&top=...`
  - `GET /analytics/queries/recent?limit=...`

- LLM discovery
  - `GET /manifest` – high-level manifest
  - `GET /openapi.json` – OpenAPI 3.0 (summary)
  - `GET /tools.json` – machine-readable tool schemas for agent wiring

### Examples
Safe query (allowlisted, with flattening):
```bash
curl -sS -X POST 'http://localhost:3000/safe-query' \
  -H 'Content-Type: application/json' \
  --data '{
    "object":"Account",
    "fields":["Id","Name","Owner.Name","CreatedDate"],
    "where":[{"field":"Name","op":"LIKE","value":"%acme%"}],
    "orderBy":{"field":"CreatedDate","direction":"DESC"},
    "limit":5,
    "flatten":true
  }'
```

Paginated SOQL:
```bash
curl 'http://localhost:3000/query?soql=SELECT+Id,Name+FROM+Account+ORDER+BY+CreatedDate+DESC&limit=200'
# then follow `next` with
curl 'http://localhost:3000/query?next=/services/data/vXX.X/query/01g...-2000'
```

SOSL search:
```bash
curl -sS -X POST 'http://localhost:3000/search' \
  -H 'Content-Type: application/json' \
  --data '{"sosl":"FIND {Acme*} IN ALL FIELDS RETURNING Account(Id,Name)"}'
```

Recent records:
```bash
curl 'http://localhost:3000/sobjects/Account/recent-records?limit=5'
```

Changes since timestamp (ISO 8601, unquoted):
```bash
since=$(date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ")
curl "http://localhost:3000/changes/Account?since=${since}&limit=5"
```

Picklists:
```bash
curl 'http://localhost:3000/sobjects/Account/picklists' | jq
```

### Safe Query builder (payload)
`POST /safe-query`
```json
{
  "object": "Account",
  "fields": ["Id", "Name", "Owner.Name", "CreatedDate"],
  "where": [
    { "field": "Name", "op": "LIKE", "value": "%acme%" },
    { "field": "Owner.Id", "op": "IN", "value": ["005..."] }
  ],
  "orderBy": { "field": "CreatedDate", "direction": "DESC" },
  "limit": 200,
  "flatten": true
}
```
- Fields are filtered by allowlist; unsupported operators are ignored.
- If `fields` omitted, the object’s `defaultFields` are used.
- Flattening maps relationships like `Owner.Name` → `owner_name` in the record.

### Allowlist and operators
Configured in `src/allowlist.js`:
- Per-object `fields`, `defaultFields`, and per-field allowed `operators` (e.g., `LIKE`, `IN`, range ops).
- Update this to tailor which fields and conditions your bot can use.

### Self-test harness
Run end-to-end checks quickly:
```bash
npm run selftest
sed -n '1,200p' selftest-report.json | cat
```
The harness starts a temp server on port 3100, probes endpoints, and records results.

### Token persistence
On first OAuth refresh or auto-refresh, a new access token is saved to `tokens.json` and reused if env vars are absent.
- Location: repo root (`tokens.json`), git-ignored by default.
- Consider swapping to a secure keychain (e.g., `keytar`) for production.

### Security and scope
- Entire layer is READ-ONLY; no create/update/delete endpoints.
- Prefer `/safe-query` for chatbot calls; reserve `/query` for controlled usage.
- Use `/allowlist` and `/picklists` to keep prompts/tooling schema-light and org-aware.

### CLI (after publish)
```bash
npx sfdc-helper
```

### NPM publishing (placeholder)
```bash
npm login
npm publish --access public
```

## 🚀 Examples & Development

### Run Examples
```bash
# JavaScript examples
npm run example

# TypeScript examples (requires ts-node)
npm run example:ts

# Simple chatbot demo
node examples/simple-chatbot.js
```

### Self-Test
```bash
npm run selftest
# Generates comprehensive test report
```

### Development
```bash
# Start development server
npm start

# Check dynamic discovery stats
curl http://localhost:3000/allowlist/stats

# Refresh dynamic allowlist
curl -X POST http://localhost:3000/allowlist/refresh
```

## 🛡️ Security & Best Practices

- **Read-Only by Design**: No create/update/delete operations possible
- **Allowlisted Fields**: Only pre-approved fields can be queried
- **Safe Query Builder**: Validates operators and prevents injection
- **Rate Limiting**: Built-in protection against abuse
- **Token Management**: Secure OAuth refresh token handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [jsforce](https://jsforce.github.io/) - excellent Salesforce JavaScript toolkit
- Inspired by the need for org-aware Salesforce integrations
- Designed for the modern chatbot and AI assistant ecosystem

---

**Made with ❤️ for the Salesforce developer community**
