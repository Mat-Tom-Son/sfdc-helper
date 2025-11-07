# SFDC Helper

**Production-ready, org-aware Salesforce API layer with built-in intelligence, security, and zero-config setup.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

SFDC Helper is a secure, read-only Salesforce API layer that combines safe SOQL/SOSL with org-aware intelligence. Get started in 5 minutes with the interactive setup wizard, then use the visual admin dashboard or programmatic SDK to query your Salesforce org with confidence.

## ✨ What's New

**🚀 Complete Usability & Security Overhaul**
- **Interactive Setup Wizard** - Zero-config onboarding in under 5 minutes
- **Visual Admin Dashboard** - Test queries, manage API keys, monitor health
- **Production-Ready Security** - API key auth, rate limiting, request validation, structured logging
- **Memory Optimizations** - Automatic cleanup, TTL management
- **All Tests Passing** - 42/42 tests (100% success rate)

## 🎯 Key Features

### 🛡️ Security First
- **API Key Authentication** - X-API-Key header or Bearer token
- **Rate Limiting** - 100 req/min general, 10 req/min for expensive ops
- **Request Validation** - Schema validation on all endpoints
- **Helmet.js Security Headers** - XSS, CSRF, clickjacking protection
- **Structured Logging** - Winston-based logging with rotation
- **Read-Only by Design** - No write operations possible

### 🧠 Org-Aware Intelligence
- **Dynamic Field Discovery** - Automatically detects custom fields
- **Context Bundles** - Pre-generated org schemas for instant queries
- **Smart Validation Rules** - Fetches active validation rules
- **List View Awareness** - Discovers and uses pre-configured views
- **Allowlist Management** - Automatic security boundaries

### 💬 Built-in Chat Agent
- **BYO-LLM Pattern** - Use any LLM via HTTP adapter
- **Multi-turn Conversations** - Stateful dialog with memory
- **Function Calling** - Executes Salesforce queries from natural language
- **Goal Decomposition** - Breaks complex queries into steps
- **Org-Aware Responses** - Uses context bundles for accurate answers

### 🚀 Developer Experience
- **5-Minute Setup** - Interactive CLI wizard
- **Visual Dashboard** - No command line needed
- **TypeScript Support** - Full type definitions included
- **Standalone Client** - Use as SDK without running server
- **REST API** - HTTP endpoints for any language
- **Zero Config** - Works out of the box

---

## 🏁 Quick Start

### 1. Install

```bash
npm install sfdc-helper
```

### 2. Run Setup Wizard

```bash
npm run setup
```

The interactive wizard will:
- ✅ Configure Salesforce credentials (OAuth or username/password)
- ✅ Test your connection
- ✅ Generate your first context bundle
- ✅ Show you what to do next

### 3. Start the Server

```bash
npm start
```

Server runs at `http://localhost:3000`

### 4. Open Admin Dashboard

Navigate to `http://localhost:3000/admin/admin.html` in your browser.

The dashboard lets you:
- 🔍 Test SOQL queries instantly
- 🔑 Manage API keys
- 📊 Monitor server health
- 📖 Browse API documentation

**That's it!** You're ready to query Salesforce.

---

## 📚 Usage Examples

### Option 1: Visual Dashboard (Easiest)

1. Open `http://localhost:3000/admin/admin.html`
2. Enter your API key (generated during setup)
3. Run queries in the playground
4. View results instantly

### Option 2: JavaScript SDK

```javascript
const SFDCHelperClient = require('sfdc-helper/client');

const client = new SFDCHelperClient('http://localhost:3000', {
  apiKey: 'sk_your_api_key_here'
});

// Query with dynamic field discovery
const result = await client.safeQuery('Account', {
  fields: ['Id', 'Name', 'Custom_Field__c'], // Automatically validates custom fields
  conditions: 'Type = \'Customer\'',
  limit: 10
});

console.log(result.records);
```

### Option 3: REST API

```bash
curl -X POST http://localhost:3000/api/safe-query \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "Opportunity",
    "fields": ["Id", "Name", "StageName", "Amount"],
    "conditions": "StageName = '\''Closed Won'\''",
    "limit": 50
  }'
```

### Option 4: TypeScript

```typescript
import { SFDCHelperClient } from 'sfdc-helper/client';

const client = new SFDCHelperClient('http://localhost:3000', {
  apiKey: process.env.SFDC_API_KEY
});

interface Opportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number;
}

const result = await client.safeQuery<Opportunity>('Opportunity', {
  fields: ['Id', 'Name', 'StageName', 'Amount'],
  conditions: 'Amount > 100000',
  limit: 10
});

result.records.forEach(opp => {
  console.log(`${opp.Name}: $${opp.Amount}`);
});
```

---

## 🔒 Security & Authentication

### API Key Authentication

SFDC Helper requires API key authentication for all endpoints (except health checks).

#### Get Your API Key

During setup, an API key is automatically generated and displayed:

```
API_KEY: sk_abc123...
```

Add it to your `.env` file:

```bash
API_KEYS=sk_abc123...
```

#### Use Your API Key

**Option 1: X-API-Key Header (Recommended)**
```bash
curl -H "X-API-Key: sk_your_key" http://localhost:3000/api/health
```

**Option 2: Authorization Bearer**
```bash
curl -H "Authorization: Bearer sk_your_key" http://localhost:3000/api/health
```

**Option 3: Query Parameter (Not recommended for production)**
```bash
curl "http://localhost:3000/api/health?api_key=sk_your_key"
```

#### Disable Authentication (Development Only)

```bash
# .env
DISABLE_AUTH=true
```

⚠️ **WARNING**: Never disable authentication in production!

### Rate Limiting

SFDC Helper includes built-in rate limiting:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 1 minute |
| Expensive Operations (context bundles) | 10 requests | 1 minute |
| Failed Auth Attempts | 5 attempts | 1 minute |

Rate limit headers are included in responses:
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1640000000
```

### Security Headers

Helmet.js provides:
- XSS Protection
- Content Security Policy
- HSTS
- Frame Options (clickjacking prevention)
- MIME type sniffing prevention

### Request Validation

All endpoints validate input:
- Object names match Salesforce patterns
- Field names are valid
- Limits are within bounds (1-200)
- Required fields are present

Invalid requests return `400 Bad Request` with details.

---

## 🧠 Org-Aware Intelligence

### What is "Org-Aware"?

SFDC Helper learns your org's specific configuration and uses it to enhance queries.

#### Context Bundles

Generate a snapshot of your org's schema:

```bash
npm run selftest
```

Or via API:

```javascript
const bundle = await client.generateContextBundle('Opportunity', {
  persist: true,      // Save to disk
  runQueries: true,   // Test sample queries
  sample: 50          // Sample size for queries
});
```

Context bundles include:
- All fields (standard + custom)
- Field types and metadata
- Validation rules (active only)
- List views
- Sample data queries
- Field usage statistics

#### Dynamic Allowlist

Custom fields are automatically validated:

```javascript
// This works even if Custom_Revenue__c was added yesterday
await client.safeQuery('Opportunity', {
  fields: ['Id', 'Name', 'Custom_Revenue__c']
});
```

The allowlist auto-refreshes every 60 seconds.

#### Validation Rules

Fetch active validation rules:

```javascript
const rules = await client.getValidationRules('Account');

rules.forEach(rule => {
  console.log(`${rule.fullName}: ${rule.errorConditionFormula}`);
});
```

#### List Views

Discover pre-configured views:

```javascript
const views = await client.getListViews('Lead');

views.forEach(view => {
  console.log(`${view.label}: ${view.soqlQuery}`);
});
```

---

## 💬 Chat Agent (BYO-LLM)

SFDC Helper includes a powerful chat agent that uses **your own LLM** via HTTP adapter.

### How It Works

1. User asks a question in natural language
2. Chat agent determines if it needs Salesforce data
3. If yes, calls `query_salesforce` function
4. Results are interpreted and returned to LLM
5. LLM generates natural language response

### Setup

#### 1. Configure LLM HTTP Adapter

Add to `.env`:

```bash
LLM_HTTP_URL=https://your-app.example.com/api/llm-chat
```

Your endpoint should accept:

```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "Show me recent opportunities"}
  ],
  "functions": [...],
  "temperature": 0.3
}
```

And return:

```json
{
  "message": {
    "role": "assistant",
    "content": "Here are your opportunities...",
    "function_call": {
      "name": "query_salesforce",
      "arguments": "{\"prompt\":\"Show me opportunities\"}"
    }
  }
}
```

#### 2. Use the Chat Agent

**Programmatically:**

```javascript
const ChatAgent = require('sfdc-helper/src/chat/ChatAgent');

const agent = new ChatAgent(sfdcClient, {
  llmHttpUrl: process.env.LLM_HTTP_URL
});

const response = await agent.chat('user123', 'Show me the top 5 opportunities by amount');
console.log(response);
```

**Via REST API:**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "X-API-Key: sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "message": "What are my biggest deals?",
    "conversationId": "conv_456"
  }'
```

**Interactive CLI:**

```bash
npm run chat:interactive
```

### Features

- **Multi-turn Conversations** - Maintains context across messages
- **Goal Decomposition** - Breaks complex queries into steps
- **Function Calling** - Executes Salesforce queries automatically
- **Org Context** - Uses context bundles for accurate responses
- **Error Handling** - Gracefully handles SFDC errors
- **Memory Management** - Auto-cleanup after 24 hours

### Examples

**Example 1: Simple Query**
```
User: Show me accounts created this month
Agent: [Executes SOQL query]
      Found 23 accounts created in the last 30 days...
```

**Example 2: Complex Analysis**
```
User: Which opportunities are likely to close this quarter?
Agent: [Queries opportunities with stage + close date]
      [Applies business logic]
      Based on your pipeline, here are 12 opportunities...
```

**Example 3: Custom Fields**
```
User: What's the average Custom_Renewal_Score__c for accounts?
Agent: [Discovers custom field]
      [Runs aggregate query]
      The average renewal score is 7.8 out of 10...
```

---

## 📖 Full API Reference

### Health Checks

#### `GET /health`
Basic health check (no auth required)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /health/live`
Liveness probe - server is running

#### `GET /health/ready`
Readiness probe - server can handle requests

**Response:**
```json
{
  "status": "ready",
  "salesforce": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Safe Query

#### `POST /api/safe-query`
Execute a validated SOQL query with automatic allowlist checking.

**Request:**
```json
{
  "object": "Account",
  "fields": ["Id", "Name", "Industry"],
  "conditions": "Industry = 'Technology'",
  "orderBy": "Name ASC",
  "limit": 50
}
```

**Response:**
```json
{
  "records": [...],
  "totalSize": 50,
  "done": true,
  "queryLocator": null
}
```

**Validation:**
- Object name must match Salesforce pattern
- Fields auto-validated against allowlist
- Limit: 1-200 (default: 100)
- Injection protection included

---

### Text Search (SOSL)

#### `POST /api/search`
Execute a SOSL text search across multiple objects.

**Request:**
```json
{
  "searchText": "Acme",
  "objects": [
    {
      "name": "Account",
      "fields": ["Id", "Name", "Phone"]
    },
    {
      "name": "Contact",
      "fields": ["Id", "Name", "Email"]
    }
  ],
  "limit": 50
}
```

**Response:**
```json
{
  "searchRecords": [
    {
      "attributes": { "type": "Account" },
      "Id": "001...",
      "Name": "Acme Corp",
      "Phone": "555-1234"
    }
  ]
}
```

---

### Schema & Metadata

#### `GET /api/objects`
List all queryable Salesforce objects.

**Response:**
```json
{
  "objects": [
    {
      "name": "Account",
      "label": "Account",
      "queryable": true,
      "custom": false
    }
  ]
}
```

#### `GET /api/objects/:objectName`
Describe a specific object (fields, relationships, etc.).

**Response:**
```json
{
  "name": "Account",
  "label": "Account",
  "fields": [
    {
      "name": "Id",
      "label": "Account ID",
      "type": "id",
      "length": 18,
      "required": false,
      "unique": true
    }
  ],
  "recordTypeInfos": [...],
  "childRelationships": [...]
}
```

#### `GET /api/objects/:objectName/fields`
List all fields for an object.

**Response:**
```json
{
  "fields": [
    {
      "name": "Name",
      "label": "Account Name",
      "type": "string",
      "length": 255
    }
  ]
}
```

#### `GET /api/objects/:objectName/validation-rules`
Get active validation rules.

**Response:**
```json
{
  "rules": [
    {
      "fullName": "Prevent_Negative_Revenue",
      "active": true,
      "errorConditionFormula": "Annual_Revenue__c < 0",
      "errorMessage": "Revenue cannot be negative"
    }
  ]
}
```

#### `GET /api/objects/:objectName/list-views`
Get list views for an object.

**Response:**
```json
{
  "listViews": [
    {
      "id": "00B...",
      "label": "My Accounts",
      "soqlQuery": "SELECT Id, Name FROM Account WHERE OwnerId = '005...'",
      "columns": [...]
    }
  ]
}
```

---

### Context Bundles

#### `POST /api/objects/:objectName/context/bundle`
Generate a comprehensive context bundle for an object.

**Request:**
```json
{
  "persist": true,
  "runQueries": true,
  "sample": 50,
  "verbose": false
}
```

**Response:**
```json
{
  "objectName": "Opportunity",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "fields": [...],
  "validationRules": [...],
  "listViews": [...],
  "sampleQueries": [...],
  "dir": "context-bundles/Opportunity"
}
```

**Rate Limited:** 10 requests/minute (expensive operation)

---

### Chat Agent

#### `POST /api/chat`
Send a message to the chat agent.

**Request:**
```json
{
  "userId": "user123",
  "message": "Show me opportunities closing this quarter",
  "conversationId": "conv_456"
}
```

**Response:**
```json
{
  "response": "Found 15 opportunities closing this quarter...",
  "conversationId": "conv_456",
  "metadata": {
    "queriesExecuted": 1,
    "recordsReturned": 15
  }
}
```

---

### Analytics (Roadmap)

Analytics endpoints are planned but not yet implemented:

- `/api/reports/:reportId` - Run a report
- `/api/dashboards/:dashboardId` - Get dashboard data

---

## 🛠️ Advanced Configuration

### Environment Variables

```bash
# Salesforce Connection (choose one method)

## Method 1: Username + Password
SF_USERNAME=your-username@example.com
SF_PASSWORD=your-password
SF_SECURITY_TOKEN=your-security-token
SF_LOGIN_URL=https://login.salesforce.com  # or https://test.salesforce.com for sandbox

## Method 2: OAuth (Recommended)
SF_CLIENT_ID=your-client-id
SF_CLIENT_SECRET=your-client-secret
SF_REFRESH_TOKEN=your-refresh-token
SF_INSTANCE_URL=https://yourorg.my.salesforce.com
SF_LOGIN_URL=https://login.salesforce.com

# Server Configuration
PORT=3000
NODE_ENV=production  # or development

# Security
API_KEYS=sk_key1,sk_key2,sk_key3  # Comma-separated
DISABLE_AUTH=false  # NEVER set to true in production!

# Logging
LOG_LEVEL=info  # debug, info, warn, error

# LLM Configuration (Optional)
LLM_HTTP_URL=https://your-app.example.com/api/llm-chat
```

### Custom Allowlist

Edit `src/security/allowlist.js` to customize allowed objects and fields:

```javascript
const BASE_ALLOWLIST = {
  Account: ['Id', 'Name', 'Industry', 'AnnualRevenue'],
  Contact: ['Id', 'Name', 'Email', 'Phone'],
  CustomObject__c: ['Id', 'Name', 'Custom_Field__c']
};
```

### Logging Configuration

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

Configure log rotation in `src/middleware/logger.js`:

```javascript
const fileTransports = [
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  })
];
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

**Current Status:** ✅ 42/42 tests passing (100% success rate)

### Test Suites

```bash
npm run test:chat      # Chat agent tests
npm run test:goal      # Goal decomposition tests
npm run test:manager   # Goal manager tests
npm run test:agent     # Full agent integration tests
```

### Integration Tests

```bash
npm run test:runtime      # Runtime integration test
npm run test:enhanced     # Enhanced chat test
npm run demo:integration  # Quick integration demo
```

### Self-Test (Context Bundle)

```bash
npm run selftest
```

Generates context bundle for Opportunity and runs validation queries.

---

## 📦 Using as a Package

### Install in Your Project

```bash
npm install sfdc-helper
```

### Standalone Client (No Server)

```javascript
const { SFDCHelperClient } = require('sfdc-helper/client');

// Connect directly to Salesforce (no server needed)
const client = new SFDCHelperClient(null, {
  username: process.env.SF_USERNAME,
  password: process.env.SF_PASSWORD,
  securityToken: process.env.SF_SECURITY_TOKEN,
  loginUrl: process.env.SF_LOGIN_URL
});

const accounts = await client.safeQuery('Account', {
  fields: ['Id', 'Name'],
  limit: 10
});
```

### Client + Server

```javascript
const { SFDCHelperClient } = require('sfdc-helper/client');

const client = new SFDCHelperClient('http://localhost:3000', {
  apiKey: 'sk_your_key'
});

const opportunities = await client.safeQuery('Opportunity', {
  fields: ['Id', 'Name', 'StageName', 'Amount'],
  conditions: 'StageName = \'Closed Won\'',
  limit: 50
});
```

### TypeScript

```typescript
import { SFDCHelperClient, SafeQueryOptions } from 'sfdc-helper/client';

const client = new SFDCHelperClient('http://localhost:3000', {
  apiKey: process.env.SFDC_API_KEY
});

const options: SafeQueryOptions = {
  fields: ['Id', 'Name', 'Email'],
  conditions: 'Email != null',
  limit: 100
};

const contacts = await client.safeQuery('Contact', options);
```

---

## 📚 Additional Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Detailed 5-minute setup guide
- **[CHAT_AGENT.md](CHAT_AGENT.md)** - Complete chat agent documentation
- **[examples/](examples/)** - Working code examples
  - `client-usage.js` - SDK usage examples
  - `typescript-example.ts` - TypeScript examples
  - `chat-agent-demo.js` - Chat agent demo
  - `runtime-integration-test.js` - Integration testing
- **[COOKBOOK.md](COOKBOOK.md)** - Common recipes and patterns

---

## 🔧 Troubleshooting

### "Authentication required" error

**Solution:** Add your API key to the request.

```bash
curl -H "X-API-Key: sk_your_key" http://localhost:3000/api/health
```

Or disable auth for development:

```bash
DISABLE_AUTH=true npm start
```

### "Invalid API key" error

**Solution:** Generate a new key or check your .env file.

```bash
# Check logs for the auto-generated key
npm start

# Or add a key manually to .env
API_KEYS=sk_abc123...
```

### "Too many requests" error

**Solution:** You've hit the rate limit (100 req/min). Wait 60 seconds or increase the limit in `src/middleware/rateLimiter.js`.

### Connection to Salesforce fails

**Solution:** Check your credentials in `.env`:

```bash
# Re-run setup wizard
npm run setup

# Or manually test connection
node src/selftest.js
```

### Custom fields not found

**Solution:** Allowlist may need to refresh.

```bash
# Wait 60 seconds (auto-refresh)
# Or restart the server
npm start
```

### Chat agent not responding

**Solution:** Check LLM HTTP adapter configuration.

```bash
# Verify LLM_HTTP_URL is set
echo $LLM_HTTP_URL

# Test the endpoint manually
curl -X POST $LLM_HTTP_URL \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}'
```

---

## 🗺️ Roadmap

### v0.2.0 (Q2 2024)
- [ ] Analytics API (reports & dashboards)
- [ ] Bulk query support (> 10,000 records)
- [ ] Webhook support for notifications
- [ ] Multi-tenant support

### v0.3.0 (Q3 2024)
- [ ] GraphQL API layer
- [ ] Real-time event streaming
- [ ] Advanced caching (Redis)
- [ ] Horizontal scaling support

### v1.0.0 (Q4 2024)
- [ ] Full production hardening
- [ ] Official Docker image
- [ ] Kubernetes deployment templates
- [ ] Commercial support options

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Write tests** for your changes
4. **Run the test suite** (`npm test`)
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/sfdc-helper.git
cd sfdc-helper

# Install dependencies
npm install

# Copy .env.example to .env and configure
cp .env.example .env

# Run tests
npm test

# Start in development mode
npm start
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **jsforce** - Excellent Salesforce API client
- **Express.js** - Web framework
- **Winston** - Logging
- **Helmet.js** - Security middleware

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/sfdc-helper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/sfdc-helper/discussions)
- **Email**: support@example.com

---

## ⚡ Quick Links

- [Quick Start](#-quick-start)
- [Security & Authentication](#-security--authentication)
- [Chat Agent](#-chat-agent-byo-llm)
- [API Reference](#-full-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Admin Dashboard](http://localhost:3000/admin/admin.html)

---

**Built with ❤️ for the Salesforce community**
