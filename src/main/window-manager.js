const { BrowserWindow, BrowserView } = require('electron');
const path = require('path');

const SERVICES = {
  chatgpt: {
    url: 'https://chat.openai.com',
    preload: 'chatgpt-preload.js'
  },
  claude: {
    url: 'https://claude.ai',
    preload: 'claude-preload.js'
  },
  gemini: {
    url: 'https://gemini.google.com',
    preload: 'gemini-preload.js'
  },
  perplexity: {
    url: 'https://www.perplexity.ai',
    preload: 'perplexity-preload.js'
  },
  grok: {
    url: 'https://grok.com',
    preload: 'grok-preload.js'
  },
  lechat: {
    url: 'https://chat.mistral.ai/chat',
    preload: 'lechat-preload.js'
  }
};

const CONTROL_BAR_HEIGHT = 90;

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    title: 'Auto Chat'
  });

  // Create control bar view
  const controlView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setBrowserView(controlView);
  const bounds = mainWindow.getContentBounds();
  controlView.setBounds({
    x: 0,
    y: 0,
    width: bounds.width,
    height: CONTROL_BAR_HEIGHT
  });
  controlView.setAutoResize({ width: true });
  controlView.webContents.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Create chat view (starts with ChatGPT)
  const chatView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/', SERVICES.chatgpt.preload),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:chatgpt'
    }
  });

  // Forward console messages from BrowserView to main process
  chatView.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CHATGPT] ${message}`);
  });

  mainWindow.addBrowserView(chatView);
  chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  chatView.setAutoResize({ width: true, height: true });
  chatView.webContents.loadURL(SERVICES.chatgpt.url);

  mainWindow.chatView = chatView;
  mainWindow.controlView = controlView;

  // Handle window resize
  mainWindow.on('resize', () => {
    const newBounds = mainWindow.getContentBounds();
    controlView.setBounds({
      x: 0,
      y: 0,
      width: newBounds.width,
      height: CONTROL_BAR_HEIGHT
    });
    chatView.setBounds({
      x: 0,
      y: CONTROL_BAR_HEIGHT,
      width: newBounds.width,
      height: newBounds.height - CONTROL_BAR_HEIGHT
    });
  });

  return mainWindow;
}

function switchService(mainWindow, service) {
  if (!SERVICES[service]) {
    console.error('Unknown service:', service);
    return Promise.reject(new Error(`Unknown service: ${service}`));
  }

  const bounds = mainWindow.getContentBounds();
  
  // Remove old chat view
  if (mainWindow.chatView) {
    mainWindow.removeBrowserView(mainWindow.chatView);
    mainWindow.chatView.webContents.destroy();
  }

  // Create new chat view with appropriate partition and preload script
  const chatView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/', SERVICES[service].preload),
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:${service}`
    }
  });

  // Forward console messages from BrowserView to main process
  chatView.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${service.toUpperCase()}] ${message}`);
  });

  mainWindow.addBrowserView(chatView);
  chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  chatView.setAutoResize({ width: true, height: true });
  
  // Return a promise that resolves when the page finishes loading
  return new Promise((resolve) => {
    console.log(`[WindowManager] Loading ${service} at ${SERVICES[service].url}`);
    
    // Set up the chatView reference immediately so IPC can work
    mainWindow.chatView = chatView;
    
    // Listen for when the page finishes loading
    const onDidFinishLoad = () => {
      console.log(`[WindowManager] ${service} page finished loading`);
      // Wait for React/SPA to initialize
      setTimeout(() => {
        // Notify control view of service change
        if (mainWindow.controlView && mainWindow.controlView.webContents) {
          mainWindow.controlView.webContents.send('service-changed', service);
        }
        resolve();
      }, 1000);
    };
    
    chatView.webContents.once('did-finish-load', onDidFinishLoad);
    
    // Also listen for DOM ready in case did-finish-load fires too early
    chatView.webContents.once('dom-ready', () => {
      console.log(`[WindowManager] ${service} DOM ready`);
    });
    
    chatView.webContents.loadURL(SERVICES[service].url);
  });
}

module.exports = {
  createWindow,
  switchService,
  SERVICES
};
