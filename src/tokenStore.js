'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const TOKENS_FILE_PATH = path.resolve(__dirname, '..', 'tokens.json');

async function readJsonFile(filePath) {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.name === 'SyntaxError')) {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, jsonObject) {
  const jsonText = JSON.stringify(jsonObject, null, 2);
  await fsp.writeFile(filePath, jsonText, 'utf8');
}

async function loadSavedToken() {
  const data = await readJsonFile(TOKENS_FILE_PATH);
  if (!data || typeof data !== 'object') return null;
  const instanceUrl = typeof data.instanceUrl === 'string' ? data.instanceUrl : undefined;
  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : undefined;
  if (!instanceUrl && !accessToken) return null;
  return { instanceUrl, accessToken, lastRefreshed: data.lastRefreshed };
}

async function saveToken(tokenInfo) {
  const nowIso = new Date().toISOString();
  const payload = {
    instanceUrl: tokenInfo.instanceUrl || null,
    accessToken: tokenInfo.accessToken || null,
    lastRefreshed: nowIso,
  };
  await writeJsonFile(TOKENS_FILE_PATH, payload);
}

module.exports = {
  loadSavedToken,
  saveToken,
  TOKENS_FILE_PATH,
};


