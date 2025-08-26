'use strict';

require('dotenv').config();

const jsforce = require('jsforce');
const tokenStore = require('./tokenStore');
const { getConnection } = require('./sfConnection');

function getEnv(name, defaultValue) {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : defaultValue;
}

function createOAuth2FromEnv() {
  const clientId = getEnv('SF_CLIENT_ID');
  const clientSecret = getEnv('SF_CLIENT_SECRET');
  const redirectUri = getEnv('SF_REDIRECT_URI');
  const loginUrl = getEnv('SF_LOGIN_URL', 'https://login.salesforce.com');

  if (!clientId || !clientSecret) return null;

  const options = { clientId, clientSecret, loginUrl };
  if (redirectUri) options.redirectUri = redirectUri;
  return new jsforce.OAuth2(options);
}

function refreshAccessToken(connection, refreshToken) {
  return new Promise((resolve, reject) => {
    connection.oauth2.refreshToken(refreshToken, (err, res) => {
      if (err) return reject(err);
      if (res && res.instance_url) connection.instanceUrl = res.instance_url;
      if (res && res.access_token) connection.accessToken = res.access_token;
      resolve(res);
    });
  });
}

function printStartupHelpAndExit() {
  const help = [
    'Missing required environment variables.',
    '',
    'Provide either:',
    '1) Username-Password authentication:',
    '   SF_LOGIN_URL=https://login.salesforce.com (or https://test.salesforce.com for Sandbox)',
    '   SF_USERNAME=your.user@example.com',
    '   SF_PASSWORD=yourPassword',
    '   SF_SECURITY_TOKEN=optionalTokenIfRequired',
    '',
    '   - If your org enforces MFA or blocks the Username-Password flow, use a Connected App and another flow (JWT or OAuth).',
    '',
    'OR',
    '2) Access Token authentication (already have token):',
    '   SF_INSTANCE_URL=https://yourInstance.my.salesforce.com',
    '   SF_ACCESS_TOKEN=00D....!AQE....',
    '',
    'OR',
    '3) OAuth with Refresh Token (recommended for long-lived apps):',
    '   SF_LOGIN_URL=https://login.salesforce.com',
    '   SF_CLIENT_ID=yourConnectedAppClientId',
    '   SF_CLIENT_SECRET=yourConnectedAppClientSecret',
    '   SF_REDIRECT_URI=http://localhost:3978/oauth/callback (optional for refresh)',
    '   SF_INSTANCE_URL=https://yourInstance.my.salesforce.com (optional; will be set after first refresh if omitted)',
    '   SF_REFRESH_TOKEN=yourRefreshToken',
    '   SF_ACCESS_TOKEN=optionalExistingAccessToken',
    '',
    'You can also set SF_SOQL to override the default query.',
  ].join('\n');
  console.error(help);
  process.exit(1);
}

async function buildConnectionFromEnv() {
  // 1) OAuth + Refresh Token
  const oauth2 = createOAuth2FromEnv();
  const refreshToken = getEnv('SF_REFRESH_TOKEN');
  let instanceUrl = getEnv('SF_INSTANCE_URL');
  let accessToken = getEnv('SF_ACCESS_TOKEN');

  // Try to load saved token if env does not provide access token/instance URL
  if (!accessToken || !instanceUrl) {
    try {
      const saved = await tokenStore.loadSavedToken();
      if (saved) {
        if (!instanceUrl && saved.instanceUrl) instanceUrl = saved.instanceUrl;
        if (!accessToken && saved.accessToken) accessToken = saved.accessToken;
      }
    } catch (e) {
      // Non-fatal: continue without saved tokens
    }
  }

  if (oauth2 && refreshToken) {
    const connection = new jsforce.Connection({
      oauth2,
      instanceUrl,
      accessToken,
      refreshToken,
    });

    connection.on('refresh', async (newAccessToken, res) => {
      try {
        const resolvedInstanceUrl = (res && res.instance_url) || connection.instanceUrl || instanceUrl || null;
        await tokenStore.saveToken({ instanceUrl: resolvedInstanceUrl, accessToken: newAccessToken });
        console.log('[jsforce] Access token auto-refreshed and persisted to tokens.json.');
      } catch (persistErr) {
        console.warn('[jsforce] Token refreshed but failed to persist:', persistErr && persistErr.message ? persistErr.message : persistErr);
      }
    });

    // If we do not have an access token yet, proactively refresh to start clean
    if (!accessToken) {
      const res = await refreshAccessToken(connection, refreshToken);
      try {
        const resolvedInstanceUrl = (res && res.instance_url) || connection.instanceUrl || instanceUrl || null;
        await tokenStore.saveToken({ instanceUrl: resolvedInstanceUrl, accessToken: connection.accessToken });
        console.log('[jsforce] Access token obtained via refresh and persisted to tokens.json.');
      } catch (persistErr) {
        console.warn('[jsforce] Token obtained but failed to persist:', persistErr && persistErr.message ? persistErr.message : persistErr);
      }
    }

    return { connection, method: 'oauth_refresh_token' };
  }

  // 2) Access Token only
  if (instanceUrl && accessToken) {
    const connection = new jsforce.Connection({ instanceUrl, accessToken });
    return { connection, method: 'access_token' };
  }

  const loginUrl = getEnv('SF_LOGIN_URL', 'https://login.salesforce.com');
  const username = getEnv('SF_USERNAME');
  const password = getEnv('SF_PASSWORD');
  const securityToken = getEnv('SF_SECURITY_TOKEN', '');

  if (!username || !password) {
    printStartupHelpAndExit();
  }

  const connection = new jsforce.Connection({ loginUrl });
  const passwordWithToken = `${password}${securityToken || ''}`;
  await connection.login(username, passwordWithToken);
  return { connection, method: 'username_password' };
}

async function runQuery(connection, soql) {
  const result = await connection.query(soql);
  return result;
}

async function main() {
  try {
    // Prefer shared connection module for parity with the server
    const connection = await getConnection();
    const method = 'shared_connection';
    const soql = getEnv('SF_SOQL', 'SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 5');

    console.log(`[jsforce] Authenticated using method: ${method}`);
    console.log(`[jsforce] Instance: ${connection.instanceUrl}`);
    console.log(`[jsforce] Running SOQL: ${soql}`);

    const result = await runQuery(connection, soql);

    console.log(`[jsforce] Total size: ${result.totalSize}`);
    console.log(`[jsforce] Records returned: ${result.records.length}`);
    if (result.records.length > 0) {
      console.log('[jsforce] Sample record(s):');
      for (const r of result.records) {
        console.log({ Id: r.Id, Name: r.Name });
      }
    }

    if (!result.done) {
      console.log('[jsforce] Note: More records are available. Implement tooling for pagination if needed.');
    }

    process.exit(0);
  } catch (error) {
    console.error('[jsforce] Error:', error && error.message ? error.message : error);
    console.error('If you are using Sandbox, set SF_LOGIN_URL=https://test.salesforce.com.');
    console.error('If MFA is enforced or Username-Password is blocked, use a Connected App with OAuth/JWT.');
    process.exit(1);
  }
}

main();


