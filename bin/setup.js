#!/usr/bin/env node
'use strict';

/**
 * SFDC Helper - Interactive Setup Wizard
 *
 * Guides users through initial setup with zero prior knowledge required.
 * Creates .env file, tests connection, and generates first context bundle.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI colors for better UX
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(text) {
  console.log('\n' + colors.bright + colors.blue + '═'.repeat(60) + colors.reset);
  console.log(colors.bright + colors.blue + '  ' + text + colors.reset);
  console.log(colors.bright + colors.blue + '═'.repeat(60) + colors.reset + '\n');
}

function success(text) {
  log(`✅ ${text}`, colors.green);
}

function error(text) {
  log(`❌ ${text}`, colors.red);
}

function info(text) {
  log(`ℹ️  ${text}`, colors.cyan);
}

function warn(text) {
  log(`⚠️  ${text}`, colors.yellow);
}

async function showWelcome() {
  console.clear();
  log('\n🚀 SFDC Helper - Interactive Setup Wizard\n', colors.bright + colors.blue);
  log('This wizard will help you get started in just a few minutes!\n');
  log('What we\'ll do:', colors.bright);
  log('  1. Configure your Salesforce connection');
  log('  2. Test the connection');
  log('  3. Generate your first context bundle');
  log('  4. Show you what to do next\n');

  const ready = await ask('Ready to begin? (yes/no): ');
  return ready.toLowerCase().startsWith('y');
}

async function checkExistingEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(envPath)) {
    warn('\nFound existing .env file!');
    const overwrite = await ask('Do you want to reconfigure? (yes/no): ');

    if (!overwrite.toLowerCase().startsWith('y')) {
      info('Using existing configuration. Run "npm start" to launch the server.');
      return true;
    }

    // Backup existing .env
    const backupPath = `${envPath}.backup.${Date.now()}`;
    fs.copyFileSync(envPath, backupPath);
    success(`Backed up existing .env to ${path.basename(backupPath)}`);
  }

  return false;
}

async function chooseAuthMethod() {
  header('Step 1: Choose Authentication Method');

  log('How do you want to connect to Salesforce?\n');
  log('1. OAuth (Recommended) - Most secure, requires Connected App');
  log('2. Username + Password - Simple, good for testing');
  log('3. I have credentials already - Skip to testing\n');

  const choice = await ask('Enter your choice (1-3): ');

  switch (choice) {
    case '1':
      return 'oauth';
    case '2':
      return 'password';
    case '3':
      return 'existing';
    default:
      warn('Invalid choice, defaulting to Username + Password');
      return 'password';
  }
}

async function collectPasswordCredentials() {
  header('Step 2: Enter Salesforce Credentials');

  info('You\'ll need your Salesforce username, password, and security token.');
  info('Security token: Setup → My Personal Information → Reset Security Token\n');

  const username = await ask('Salesforce Username: ');
  const password = await ask('Salesforce Password: ');
  const securityToken = await ask('Security Token (press Enter if none): ');
  const isSandbox = await ask('Is this a Sandbox? (yes/no): ');

  const loginUrl = isSandbox.toLowerCase().startsWith('y')
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com';

  return {
    SF_USERNAME: username,
    SF_PASSWORD: password,
    SF_SECURITY_TOKEN: securityToken,
    SF_LOGIN_URL: loginUrl
  };
}

async function collectOAuthCredentials() {
  header('Step 2: Enter OAuth Credentials');

  info('You\'ll need to create a Connected App first:');
  log('  1. Setup → App Manager → New Connected App');
  log('  2. Enable OAuth Settings');
  log('  3. Add "Refresh Token" and "Full Access" scopes');
  log('  4. Set callback URL to: http://localhost:3978/oauth/callback\n');

  const clientId = await ask('Client ID (Consumer Key): ');
  const clientSecret = await ask('Client Secret (Consumer Secret): ');
  const refreshToken = await ask('Refresh Token: ');
  const instanceUrl = await ask('Instance URL (e.g., https://yourorg.my.salesforce.com): ');

  return {
    SF_CLIENT_ID: clientId,
    SF_CLIENT_SECRET: clientSecret,
    SF_REFRESH_TOKEN: refreshToken,
    SF_INSTANCE_URL: instanceUrl,
    SF_REDIRECT_URI: 'http://localhost:3978/oauth/callback',
    SF_LOGIN_URL: 'https://login.salesforce.com'
  };
}

function createEnvFile(credentials) {
  const envPath = path.join(process.cwd(), '.env');

  let envContent = '# SFDC Helper Configuration\n';
  envContent += '# Generated by setup wizard on ' + new Date().toISOString() + '\n\n';

  for (const [key, value] of Object.entries(credentials)) {
    if (value) {
      envContent += `${key}=${value}\n`;
    }
  }

  // Add default port
  envContent += '\n# Server Configuration\n';
  envContent += 'PORT=3000\n';

  // Add LLM configuration placeholder
  envContent += '\n# Optional: LLM HTTP Adapter for ChatAgent\n';
  envContent += '# LLM_HTTP_URL=https://your-app.example.com/api/llm-chat\n';

  fs.writeFileSync(envPath, envContent, 'utf8');
  success('Created .env file');
}

async function testConnection() {
  header('Step 3: Testing Connection');

  info('Starting test connection to Salesforce...\n');

  require('dotenv').config();

  try {
    const { getConnection } = require('../src/sfConnection');
    const conn = await getConnection();

    // Test query
    const result = await conn.query('SELECT Id, Name FROM User WHERE Id = \'' + conn.userInfo.user_id + '\' LIMIT 1');

    success('Connection successful!');
    log(`\nConnected as: ${colors.bright}${result.records[0].Name}${colors.reset}`);
    log(`Organization: ${colors.bright}${conn.userInfo.organization_id}${colors.reset}`);
    log(`Instance: ${colors.bright}${conn.instanceUrl}${colors.reset}\n`);

    return true;
  } catch (err) {
    error('Connection failed!');
    error(`Error: ${err.message}\n`);

    const retry = await ask('Would you like to try again? (yes/no): ');
    return retry.toLowerCase().startsWith('y');
  }
}

async function generateContextBundle() {
  header('Step 4: Generate Context Bundle (Optional)');

  info('Context bundles help the chatbot understand your org\'s specific setup.');
  info('This analyzes fields, validation rules, list views, etc.\n');

  const generate = await ask('Generate context bundle for Opportunity? (yes/no): ');

  if (!generate.toLowerCase().startsWith('y')) {
    info('Skipped. You can generate later with: npm run selftest');
    return;
  }

  info('\nGenerating context bundle for Opportunity...');
  info('This may take 30-60 seconds...\n');

  try {
    const SFDCHelperClient = require('../src/client');
    const client = new SFDCHelperClient('http://localhost:3000');

    // Start server in background
    const serverProcess = require('child_process').fork(path.join(__dirname, 'sfdc-helper'), [], {
      silent: true,
      detached: true
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const result = await client.generateContextBundle('Opportunity', {
        persist: true,
        runQueries: true,
        sample: 50,
        verbose: false
      });

      success('Context bundle generated!');
      log(`Saved to: ${colors.bright}${result.dir}${colors.reset}\n`);
    } finally {
      // Kill server
      serverProcess.kill();
    }
  } catch (err) {
    warn('Context bundle generation failed (you can try later)');
    log(`Error: ${err.message}\n`);
  }
}

async function showNextSteps() {
  header('🎉 Setup Complete!');

  success('SFDC Helper is ready to use!\n');

  log(colors.bright + 'Next Steps:\n' + colors.reset);

  log('1️⃣  Start the server:');
  log(`   ${colors.cyan}npm start${colors.reset}\n`);

  log('2️⃣  Test the API:');
  log(`   ${colors.cyan}curl http://localhost:3000/health${colors.reset}\n`);

  log('3️⃣  Try a query:');
  log(`   ${colors.cyan}node examples/client-usage.js${colors.reset}\n`);

  log('4️⃣  Test the chatbot:');
  log(`   ${colors.cyan}npm run chat:interactive${colors.reset}\n`);

  log('📚 Documentation:');
  log(`   ${colors.cyan}README.md${colors.reset} - Full API reference`);
  log(`   ${colors.cyan}CHAT_AGENT.md${colors.reset} - Chatbot guide`);
  log(`   ${colors.cyan}examples/${colors.reset} - Working examples\n`);

  log('🔒 Security Note:');
  warn('   Before production, add API authentication!');
  warn('   See README for security hardening steps.\n');
}

async function main() {
  try {
    const ready = await showWelcome();
    if (!ready) {
      info('Setup cancelled. Run "npm run setup" when ready!');
      rl.close();
      return;
    }

    const existing = await checkExistingEnv();
    if (existing) {
      rl.close();
      return;
    }

    const authMethod = await chooseAuthMethod();

    if (authMethod === 'existing') {
      info('Using existing credentials. Testing connection...');
      const success = await testConnection();
      if (!success) {
        error('Please check your .env file and try again.');
        rl.close();
        return;
      }
    } else {
      let credentials;

      if (authMethod === 'oauth') {
        credentials = await collectOAuthCredentials();
      } else {
        credentials = await collectPasswordCredentials();
      }

      createEnvFile(credentials);

      const success = await testConnection();
      if (!success) {
        const tryAgain = await ask('\nStart over? (yes/no): ');
        if (tryAgain.toLowerCase().startsWith('y')) {
          rl.close();
          // Restart
          require('child_process').execSync('node bin/setup.js', { stdio: 'inherit' });
          return;
        }
        rl.close();
        return;
      }
    }

    await generateContextBundle();
    await showNextSteps();

    rl.close();

  } catch (err) {
    error('\nSetup failed with error:');
    console.error(err);
    rl.close();
    process.exit(1);
  }
}

// Run wizard
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main };
