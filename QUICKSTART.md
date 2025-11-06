# 🚀 SFDC Helper - Quickstart Guide

Get up and running with SFDC Helper in under 5 minutes!

## Step 1: Setup

Run the interactive setup wizard:

```bash
npm run setup
```

The wizard will:
- ✅ Guide you through authentication setup
- ✅ Test your Salesforce connection
- ✅ Generate your first context bundle (optional)
- ✅ Show you what to do next

## Step 2: Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` and display:
- Your API key (save this!)
- Available endpoints
- Security status

## Step 3: Open the Admin Dashboard

Open your browser to:

```
http://localhost:3000/
```

You'll see a beautiful admin dashboard where you can:
- Test API endpoints
- Run queries visually
- Check server health
- View org information
- Manage API keys

## Step 4: Make Your First API Call

### Using the Admin Dashboard

1. Enter your API key in the "API Key" section
2. Go to "Query Playground"
3. Select an object (e.g., Opportunity)
4. Click "Run Query"

### Using curl

```bash
# Get health status
curl http://localhost:3000/health

# Query Salesforce (with authentication)
curl -X POST http://localhost:3000/safe-query \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "Opportunity",
    "fields": ["Id", "Name", "StageName", "Amount"],
    "limit": 10
  }'
```

### Using the JavaScript SDK

```javascript
const SFDCHelperClient = require('sfdc-helper');

const client = new SFDCHelperClient('http://localhost:3000');

// Query opportunities
const result = await client.safeQuery('Opportunity', {
  fields: ['Id', 'Name', 'StageName', 'Amount'],
  where: [
    { field: 'IsClosed', op: '=', value: false }
  ],
  limit: 10
});

console.log(result);
```

## Step 5: Explore Advanced Features

### Context Bundles

Generate org-aware documentation:

```bash
npm run selftest
```

### Chat Agent

Test the conversational AI:

```bash
npm run chat:interactive
```

### Custom Queries

```javascript
// Smart query with natural language intent
const result = await client.executeSmartQuery(
  'Opportunity',
  'show me deals closing this month'
);

// Get org insights
const insights = await client.getObjectInsights('Opportunity');

// Search across objects
const searchResults = await client.search(
  "FIND {Acme} IN ALL FIELDS RETURNING Account(Name), Contact(Name)"
);
```

## Security Notes

### Production Deployment

Before deploying to production:

1. **Enable authentication** (it's on by default)
2. **Set a strong API key**:
   ```bash
   echo "API_KEYS=sk_your_secure_random_key_here" >> .env
   ```
3. **Use HTTPS** (put behind reverse proxy)
4. **Enable rate limiting** (already configured)
5. **Review logs regularly**

### Disable Auth (Development Only)

To disable authentication for local development:

```bash
echo "DISABLE_AUTH=true" >> .env
```

⚠️ **Never use `DISABLE_AUTH=true` in production!**

## Common Tasks

### View API Documentation

```bash
# Open API specification
open http://localhost:3000/openapi.json

# Tool schemas for LLM integration
open http://localhost:3000/tools.json
```

### Check Logs

Logs are automatically created in `logs/`:
- `combined.log` - All logs
- `error.log` - Errors only

### Generate Context Bundle

```javascript
const result = await client.generateContextBundle('Opportunity', {
  persist: true,
  runQueries: true,
  sample: 50
});
```

## Examples

Check out the `examples/` directory for:
- `client-usage.js` - Basic SDK usage
- `simple-chatbot.js` - Simple chatbot
- `chat-agent-demo.js` - Full chat agent
- And 15+ more examples!

## Troubleshooting

### "Authentication required" error

Make sure you've saved your API key:
1. Copy the API key from server startup logs
2. Add it to requests via `X-API-Key` header
3. Or save it in the admin dashboard

### "Connection failed" error

1. Check your `.env` file has valid credentials
2. Run the setup wizard again: `npm run setup`
3. Verify your Salesforce credentials are correct

### "Rate limit exceeded" error

You've hit the rate limit (100 requests/minute by default). Wait a minute or adjust the limit in `src/middleware/rateLimiter.js`.

## Next Steps

- 📚 Read the [full documentation](README.md)
- 🤖 Explore the [chat agent guide](CHAT_AGENT.md)
- 🔧 Check out [integration examples](CHAT_INTEGRATION_GUIDE.md)
- 💬 Join the community (coming soon!)

## Need Help?

- 📖 Documentation: [README.md](README.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/anthropics/sfdc-helper/issues)
- 💡 Feature requests: [GitHub Discussions](https://github.com/anthropics/sfdc-helper/discussions)

---

**Happy building!** 🎉
