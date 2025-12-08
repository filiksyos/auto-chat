# Auto Chat 🤖

Intelligent AI router that automatically selects the best chatbot (ChatGPT, Claude, Gemini, Perplexity) based on your request. Say goodbye to visual fatigue from multiple chat windows!

## ✨ Features

- **🧠 Intelligent AI Router**: Uses OpenRouter + GPT-4o mini to analyze your request and automatically select the best AI service
- **🎯 Single Chat Display**: Clean, minimalist interface showing only one AI at a time
- **🔧 Manual Override**: Easily switch between services with one click if auto-routing picks the wrong one
- **🔐 Privacy First**: Your login credentials stay between you and your AI provider
- **💾 Session Persistence**: Stay logged in across app restarts

## 🚀 How It Works

1. Type your message in the input field
2. Press Enter - Auto Chat analyzes your request
3. The app intelligently routes to the best service:
   - **ChatGPT** 💬 - General questions, facts, coding help
   - **Claude** 🎭 - Creative writing, analysis, brainstorming
   - **Gemini** ✨ - Image generation, visual content
   - **Perplexity** 🔍 - Web search, current events, research
4. Your message is automatically sent to the selected service!

## 📦 Installation

### Prerequisites

1. **Node.js** (v18 or higher)
2. **OpenRouter API Key** - Get one free at [openrouter.ai/keys](https://openrouter.ai/keys)

### Setup

```bash
# Clone the repository
git clone https://github.com/filiksyos/auto-chat.git
cd auto-chat

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env and add your OpenRouter API key
# OPENROUTER_API_KEY=your_api_key_here
```

### Run the App

```bash
# Development mode
npm start

# Or with dev flag
npm run dev
```

### Build for Distribution

```bash
# Build for your platform
npm run build

# Built apps will be in the dist/ folder
```

## 🎮 Usage

### Auto-Routing Examples

- **"What's the history of the universe?"** → Routes to **ChatGPT** (factual question)
- **"Write a creative short story about time travel"** → Routes to **Claude** (creative writing)
- **"Generate an image of a sunset over mountains"** → Routes to **Gemini** (image generation)
- **"What are the latest news about AI?"** → Routes to **Perplexity** (web search)

### Manual Override

Click any of the service buttons at the top to manually switch:
- 💬 ChatGPT
- 🎭 Claude
- ✨ Gemini
- 🔍 Perplexity

### Keyboard Shortcuts

- **Enter** - Submit message (with auto-routing)
- **Shift + Enter** - New line in message

## ⚙️ Configuration

The AI routing logic is configured in `src/main/ai-router.js`. You can customize the routing rules by modifying the `ROUTING_RULES` prompt to suit your preferences.

### Example Customization

```javascript
const ROUTING_RULES = `
- For math problems: use chatgpt
- For philosophy discussions: use claude
- For coding help: use chatgpt
- ...
`;
```

## 🏗️ Architecture

- **Electron** - Desktop application framework
- **OpenRouter** - AI model routing and API access
- **GPT-4o mini** - Fast, cost-effective request analysis
- **BrowserViews** - Embedded web interfaces for AI services

## 📝 Technical Details

### Project Structure

```
auto-chat/
├── src/
│   ├── main/
│   │   ├── index.js          # Main Electron process
│   │   ├── window-manager.js # Window & view management
│   │   └── ai-router.js      # AI service selection logic
│   ├── preload/
│   │   └── preload.js        # IPC bridge
│   └── renderer/
│       ├── index.html        # Control bar UI
│       ├── styles.css        # Styling
│       └── renderer.js       # UI logic
├── package.json
└── .env                      # API keys (not in repo)
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Add new AI services
- Improve routing logic
- Enhance the UI/UX
- Fix bugs

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Credits

Inspired by [PolyGPT](https://github.com/ncvgl/polygpt) by Nathan Cavaglione.

## ⚠️ Notes

- You'll need to log in to each AI service the first time you use it
- Sessions are persisted, so you won't need to log in again
- The app uses the official web interfaces of each AI service
- No data is collected or stored by Auto Chat

---

Made with ❤️ for a better AI chat experience
