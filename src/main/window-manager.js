const { BrowserWindow, BrowserView } = require('electron');
const path = require('path');

const SERVICES = {
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  gemini: 'https://gemini.google.com',
  perplexity: 'https://www.perplexity.ai'
};

const CONTROL_BAR_HEIGHT = 120;

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
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:chatgpt'
    }
  });

  mainWindow.addBrowserView(chatView);
  chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  chatView.setAutoResize({ width: true, height: true });
  chatView.webContents.loadURL(SERVICES.chatgpt);

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
    return;
  }

  const bounds = mainWindow.getContentBounds();
  
  // Remove old chat view
  if (mainWindow.chatView) {
    mainWindow.removeBrowserView(mainWindow.chatView);
    mainWindow.chatView.webContents.destroy();
  }

  // Create new chat view with appropriate partition
  const chatView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:${service}`
    }
  });

  mainWindow.addBrowserView(chatView);
  chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  chatView.setAutoResize({ width: true, height: true });
  chatView.webContents.loadURL(SERVICES[service]);

  mainWindow.chatView = chatView;

  // Notify control view of service change
  if (mainWindow.controlView && mainWindow.controlView.webContents) {
    mainWindow.controlView.webContents.send('service-changed', service);
  }
}

module.exports = {
  createWindow,
  switchService,
  SERVICES
};
