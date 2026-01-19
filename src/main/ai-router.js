const axios = require('axios');
require('dotenv').config();
const configManager = require('./config-manager');
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Get API key from secure storage or environment variable
 * @returns {string|null} API key or null if not found
 */
function getApiKey() {
  try {
    // Try to read encrypted file from secure storage
    const encryptedPath = path.join(app.getPath('userData'), 'api-key.enc');

    if (fs.existsSync(encryptedPath)) {
      const encryptedBuffer = fs.readFileSync(encryptedPath);
      const decryptedKey = safeStorage.decryptString(encryptedBuffer);
      return decryptedKey;
    }
  } catch (error) {
    console.error('Error reading API key from secure storage:', error);
  }

  // Fallback to environment variable
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  return null;
}

/**
 * Select the best AI service for a given message
 * @param {string} message - User's message
 * @returns {Promise<{service: string, reason: string}>}
 */
async function selectAIService(message) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('API key not found in secure storage or environment variables, defaulting to ChatGPT');
    return {
      service: 'chatgpt',
      reason: 'Default service (API key not configured)'
    };
  }

  try {
    // Load system prompt from config (custom or default)
    const routingRules = configManager.loadSystemPrompt();
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: routingRules
          },
          {
            role: 'user',
            content: `Analyze this request and select the best service: "${message}"`
          }
        ],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/auto-chat',
          'X-Title': 'Auto Chat'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();
    
    // Parse JSON response
    let result;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid response format from AI router');
    }

    // Normalize service name (handle variations like "le chat" -> "lechat")
    const serviceNormalizations = {
      'le chat': 'lechat',
      'le-chat': 'lechat'
    };
    if (serviceNormalizations[result.service]) {
      result.service = serviceNormalizations[result.service];
    }
    
    // Validate service
    const validServices = ['chatgpt', 'claude', 'gemini', 'perplexity', 'grok', 'lechat', 'lumo'];
    if (!validServices.includes(result.service)) {
      console.error('Invalid service selected:', result.service);
      return {
        service: 'chatgpt',
        reason: 'Fallback to default service'
      };
    }

    console.log(`Routed to ${result.service}: ${result.reason}`);
    return result;

  } catch (error) {
    console.error('Error selecting AI service:', error.response?.data || error.message);
    
    // Fallback to ChatGPT
    return {
      service: 'chatgpt',
      reason: 'Fallback due to routing error'
    };
  }
}

module.exports = { selectAIService };
