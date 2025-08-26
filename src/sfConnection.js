'use strict';

require('dotenv').config();

const jsforce = require('jsforce');
const tokenStore = require('./tokenStore');

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

let sharedConnectionPromise = null;

async function getConnection() {
  if (sharedConnectionPromise) return sharedConnectionPromise;

  sharedConnectionPromise = (async () => {
    const oauth2 = createOAuth2FromEnv();
    const refreshToken = getEnv('SF_REFRESH_TOKEN');
    let instanceUrl = getEnv('SF_INSTANCE_URL');
    let accessToken = getEnv('SF_ACCESS_TOKEN');

    if (oauth2 && refreshToken) {
      if (!accessToken || !instanceUrl) {
        try {
          const saved = await tokenStore.loadSavedToken();
          if (saved) {
            if (!instanceUrl && saved.instanceUrl) instanceUrl = saved.instanceUrl;
            if (!accessToken && saved.accessToken) accessToken = saved.accessToken;
          }
        } catch (_) {}
      }

      const connection = new jsforce.Connection({ oauth2, instanceUrl, accessToken, refreshToken });
      connection.on('refresh', async (newAccessToken, res) => {
        try {
          const resolvedInstanceUrl = (res && res.instance_url) || connection.instanceUrl || instanceUrl || null;
          await tokenStore.saveToken({ instanceUrl: resolvedInstanceUrl, accessToken: newAccessToken });
          console.log('[jsforce] Access token auto-refreshed and persisted to tokens.json.');
        } catch (err) {
          console.warn('[jsforce] Token refreshed but failed to persist:', err && err.message ? err.message : err);
        }
      });

      if (!accessToken) {
        const res = await refreshAccessToken(connection, refreshToken);
        try {
          const resolvedInstanceUrl = (res && res.instance_url) || connection.instanceUrl || instanceUrl || null;
          await tokenStore.saveToken({ instanceUrl: resolvedInstanceUrl, accessToken: connection.accessToken });
          console.log('[jsforce] Access token obtained via refresh and persisted to tokens.json.');
        } catch (err) {
          console.warn('[jsforce] Token obtained but failed to persist:', err && err.message ? err.message : err);
        }
      }

      return connection;
    }

    // Fallbacks
    if (instanceUrl && accessToken) {
      return new jsforce.Connection({ instanceUrl, accessToken });
    }

    const loginUrl = getEnv('SF_LOGIN_URL', 'https://login.salesforce.com');
    const username = getEnv('SF_USERNAME');
    const password = getEnv('SF_PASSWORD');
    const securityToken = getEnv('SF_SECURITY_TOKEN', '');
    if (!username || !password) {
      throw new Error('Missing Salesforce credentials. Provide OAuth refresh token, access token, or username+password.');
    }
    const connection = new jsforce.Connection({ loginUrl });
    await connection.login(username, `${password}${securityToken || ''}`);
    return connection;
  })();

  return sharedConnectionPromise;
}

module.exports = {
  getConnection,
};


