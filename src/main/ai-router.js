const axios = require('axios');
require('dotenv').config();
const configManager = require('./config-manager');

/**
 * Select the best AI service for a given message
 * @param {string} message - User's message
 * @returns {Promise<{service: string, reason: string}>}
 */
async function selectAIService(message) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not found, defaulting to ChatGPT');
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

    // Validate service
    const validServices = ['chatgpt', 'claude', 'gemini', 'perplexity', 'grok', 'lechat'];
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
