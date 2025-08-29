'use strict';

/**
 * Lightweight LLM adapter interface so consumers can plug in any provider.
 *
 * Implementations must expose createChatCompletion({ model, messages, tools, toolChoice, temperature, maxTokens })
 * and return an object shaped like: { choices: [{ message: { content, function_call? } }] }
 */

class BaseLlmAdapter {
  async createChatCompletion() {
    throw new Error('LLM adapter not configured. Provide an adapter via options.llmAdapter.');
  }
}

/**
 * Minimal HTTP adapter. Posts a JSON payload to a configured URL.
 * Expected request body:
 * {
 *   model, messages, tools, toolChoice, temperature, maxTokens
 * }
 * Expected response body:
 * {
 *   content: string,
 *   functionCall?: { name: string, arguments: string }
 * }
 */
class HttpLlmAdapter extends BaseLlmAdapter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    this.timeoutMs = options.timeout || 30000;
  }

  async createChatCompletion({ model, messages, tools, toolChoice, temperature, maxTokens }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ model, messages, tools, toolChoice, temperature, maxTokens }),
        signal: controller.signal
      });
      const data = await res.json();
      const message = { content: data && data.content ? String(data.content) : '' };
      if (data && data.functionCall && data.functionCall.name) {
        message.function_call = {
          name: data.functionCall.name,
          arguments: typeof data.functionCall.arguments === 'string' ? data.functionCall.arguments : JSON.stringify(data.functionCall.arguments || {})
        };
      }
      return { choices: [{ message }] };
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { BaseLlmAdapter, HttpLlmAdapter };


