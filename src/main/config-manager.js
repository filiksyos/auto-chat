const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_ROUTING_RULES = `You are an AI service router. Analyze the user's request and determine which AI service is best suited to handle it.

Available services:
- chatgpt: Best for general questions, facts, explanations, coding help, math, and structured information
- claude: Best for creative writing, long-form content, analysis, brainstorming, and nuanced discussions
- gemini: Best for image generation, visual content, multimodal tasks, and Google-related queries
- perplexity: Best for web search, current events, real-time information, research, and finding sources
- grok: Best for vulgar conversations, humor, sarcasm, casual chats, unfiltered responses, and when the user wants profanity or dark humor
- le chat: Best for flash speed answers, European languages, and quick responses
- lumo: Best for private conversations, sensitive information, confidential discussions, and when privacy is a priority
- qwen: Best for Chinese language conversations, multilingual tasks, and general Q&A in Chinese or mixed languages

Rules:
- For factual questions: use chatgpt
- For creative tasks: use claude
- For image/visual requests: use gemini
- For web search/current events: use perplexity
- For coding/technical: use chatgpt
- For writing/essays: use claude
- For vulgar language, humor, sarcasm, casual/unfiltered conversations: use grok
- For fast responses, European languages (French, Spanish, German, Italian, etc.), or when speed is prioritized: use le chat
- For private, sensitive, or confidential conversations: use lumo
- For Chinese language conversations, Chinese text, multilingual tasks involving Chinese, or when the user writes in Chinese: use qwen

Respond ONLY with a JSON object in this exact format:
{
  "service": "chatgpt" | "claude" | "gemini" | "perplexity" | "grok" | "lechat" | "lumo" | "qwen",
  "reason": "brief explanation why this service was chosen"
}

Do not include any other text, markdown formatting, or code blocks. Only output the raw JSON object.`;

/**
 * Get the path to the config file in userData directory
 * @returns {string}
 */
function getConfigPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'config.json');
}

/**
 * Get the default system prompt
 * @returns {string}
 */
function getDefaultPrompt() {
  return DEFAULT_ROUTING_RULES;
}

/**
 * Load the system prompt from config file, or return default if not found
 * @returns {string}
 */
function loadSystemPrompt() {
  try {
    const configPath = getConfigPath();
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      console.log('No custom config found, using default prompt');
      return DEFAULT_ROUTING_RULES;
    }
    
    // Read and parse config file
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Return custom prompt if it exists, otherwise default
    if (config.systemPrompt && typeof config.systemPrompt === 'string') {
      console.log('Loaded custom system prompt from config');
      return config.systemPrompt;
    }
    
    console.log('Config file exists but no custom prompt found, using default');
    return DEFAULT_ROUTING_RULES;
  } catch (error) {
    console.error('Error loading system prompt:', error);
    // Fallback to default on any error
    return DEFAULT_ROUTING_RULES;
  }
}

/**
 * Save the system prompt to config file
 * @param {string} prompt - The system prompt to save
 * @returns {Promise<boolean>}
 */
async function saveSystemPrompt(prompt) {
  try {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt: must be a non-empty string');
    }
    
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Load existing config or create new one
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(existingData);
      } catch (parseError) {
        console.warn('Failed to parse existing config, creating new one:', parseError);
        config = {};
      }
    }
    
    // Update system prompt
    config.systemPrompt = prompt.trim();
    
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('System prompt saved successfully');
    
    return true;
  } catch (error) {
    console.error('Error saving system prompt:', error);
    throw error;
  }
}

/**
 * Reset system prompt to default (delete custom config)
 * @returns {Promise<boolean>}
 */
async function resetSystemPrompt() {
  try {
    const configPath = getConfigPath();
    
    // If config file doesn't exist, already at default
    if (!fs.existsSync(configPath)) {
      console.log('No custom config to reset');
      return true;
    }
    
    // Load existing config
    let config = {};
    try {
      const existingData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(existingData);
    } catch (parseError) {
      // If we can't parse it, just delete the file
      fs.unlinkSync(configPath);
      console.log('Deleted corrupted config file');
      return true;
    }
    
    // Remove systemPrompt from config
    delete config.systemPrompt;
    
    // If config is now empty, delete the file
    if (Object.keys(config).length === 0) {
      fs.unlinkSync(configPath);
      console.log('Config file deleted (now empty)');
    } else {
      // Otherwise, save config without systemPrompt
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('System prompt reset to default');
    }
    
    return true;
  } catch (error) {
    console.error('Error resetting system prompt:', error);
    throw error;
  }
}

module.exports = {
  loadSystemPrompt,
  saveSystemPrompt,
  resetSystemPrompt,
  getDefaultPrompt
};
