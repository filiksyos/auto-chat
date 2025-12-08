const axios = require('axios');
require('dotenv').config();

const ROUTING_RULES = `You are an AI service router. Analyze the user's request and determine which AI service is best suited to handle it.

Available services:
- chatgpt: Best for general questions, facts, explanations, coding help, math, and structured information
- claude: Best for creative writing, long-form content, analysis, brainstorming, and nuanced discussions
- gemini: Best for image generation, visual content, multimodal tasks, and Google-related queries
- perplexity: Best for web search, current events, real-time information, research, and finding sources

Rules:
- For factual questions: use chatgpt
- For creative tasks: use claude
- For image/visual requests: use gemini
- For web search/current events: use perplexity
- For coding/technical: use chatgpt
- For writing/essays: use claude

Respond ONLY with a JSON object in this exact format:
{
  "service": "chatgpt" | "claude" | "gemini" | "perplexity",
  "reason": "brief explanation why this service was chosen"
}

Do not include any other text, markdown formatting, or code blocks. Only output the raw JSON object.`;

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
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: ROUTING_RULES
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
    const validServices = ['chatgpt', 'claude', 'gemini', 'perplexity'];
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
