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
  },
  lumo: {
    url: 'https://lumo.proton.me',
    preload: 'lumo-preload.js'
  }
};

const CONTROL_BAR_HEIGHT = 90;
const LANDING_PAGE_HEIGHT = CONTROL_BAR_HEIGHT;

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

  // Create landing page view instead of chat view on startup
  const landingView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.addBrowserView(landingView);
  landingView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  landingView.setAutoResize({ width: true, height: true });
  landingView.webContents.loadFile(path.join(__dirname, '../renderer/landing.html'));

  mainWindow.landingView = landingView;
  mainWindow.controlView = controlView;
  mainWindow.chatView = null;
  mainWindow.loadingView = null;

  // Handle window resize
  mainWindow.on('resize', () => {
    const newBounds = mainWindow.getContentBounds();
    controlView.setBounds({
      x: 0,
      y: 0,
      width: newBounds.width,
      height: CONTROL_BAR_HEIGHT
    });

    // Resize landing view if it exists
    if (mainWindow.landingView) {
      mainWindow.landingView.setBounds({
        x: 0,
        y: CONTROL_BAR_HEIGHT,
        width: newBounds.width,
        height: newBounds.height - CONTROL_BAR_HEIGHT
      });
    }

    // Resize chat view if it exists
    if (mainWindow.chatView) {
      mainWindow.chatView.setBounds({
        x: 0,
        y: CONTROL_BAR_HEIGHT,
        width: newBounds.width,
        height: newBounds.height - CONTROL_BAR_HEIGHT
      });
    }

    // Resize loading view if it exists
    if (mainWindow.loadingView) {
      mainWindow.loadingView.setBounds({
        x: 0,
        y: CONTROL_BAR_HEIGHT,
        width: newBounds.width,
        height: newBounds.height - CONTROL_BAR_HEIGHT
      });
    }
  });

  return mainWindow;
}

function switchService(mainWindow, service, backgroundMode = false) {
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

  // Store reference immediately
  mainWindow.chatView = chatView;
  mainWindow.currentService = service;

  // Set bounds but don't add to window yet if in background mode
  chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });
  chatView.setAutoResize({ width: true, height: true });

  // Only add to window if not in background mode
  if (!backgroundMode) {
    // Remove landing view if it exists
    if (mainWindow.landingView) {
      mainWindow.removeBrowserView(mainWindow.landingView);
    }
    mainWindow.addBrowserView(chatView);
  }

  // Return a promise that resolves when the page finishes loading
  return new Promise((resolve) => {
    console.log(`[WindowManager] Loading ${service} at ${SERVICES[service].url} (background: ${backgroundMode})`);

    // Listen for when the page finishes loading
    const onDidFinishLoad = () => {
      console.log(`[WindowManager] ${service} page finished loading`);
      // Wait for React/SPA to initialize
      setTimeout(() => {
        // Notify control view of service change only if not in background mode
        if (!backgroundMode && mainWindow.controlView && mainWindow.controlView.webContents) {
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

function showBackgroundService(mainWindow) {
  if (!mainWindow.chatView) {
    console.error('[WindowManager] No chatView to show');
    return;
  }

  const bounds = mainWindow.getContentBounds();

  // Hide loading page if visible
  if (mainWindow.loadingView) {
    mainWindow.removeBrowserView(mainWindow.loadingView);
  }

  // Hide landing page if visible
  if (mainWindow.landingView) {
    mainWindow.removeBrowserView(mainWindow.landingView);
  }

  // Add chat view to window
  mainWindow.addBrowserView(mainWindow.chatView);

  // Set bounds
  mainWindow.chatView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width: bounds.width,
    height: bounds.height - CONTROL_BAR_HEIGHT
  });

  // Notify control view of service change
  if (mainWindow.controlView && mainWindow.controlView.webContents && mainWindow.currentService) {
    mainWindow.controlView.webContents.send('service-changed', mainWindow.currentService);
  }
}

function showLandingPage(mainWindow) {
  const bounds = mainWindow.getContentBounds();

  // Hide chat view if exists (don't destroy - preserve conversation)
  if (mainWindow.chatView) {
    mainWindow.removeBrowserView(mainWindow.chatView);
  }

  // Create or show landing view
  if (!mainWindow.landingView) {
    const landingView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    landingView.setBounds({
      x: 0,
      y: CONTROL_BAR_HEIGHT,
      width: bounds.width,
      height: bounds.height - CONTROL_BAR_HEIGHT
    });
    landingView.setAutoResize({ width: true, height: true });
    landingView.webContents.loadFile(path.join(__dirname, '../renderer/landing.html'));

    mainWindow.landingView = landingView;
  }

  // Add landing view to window
  mainWindow.addBrowserView(mainWindow.landingView);
}

function hideLandingPage(mainWindow) {
  // Remove landing view from window but keep reference
  if (mainWindow.landingView) {
    mainWindow.removeBrowserView(mainWindow.landingView);
  }
}

function showLoadingPage(mainWindow, routingReason, loadingUpdateQueue = null) {
  const bounds = mainWindow.getContentBounds();

  // Create loading view if it doesn't exist
  if (!mainWindow.loadingView) {
    const loadingView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    loadingView.setBounds({
      x: 0,
      y: CONTROL_BAR_HEIGHT,
      width: bounds.width,
      height: bounds.height - CONTROL_BAR_HEIGHT
    });
    loadingView.setAutoResize({ width: true, height: true });
    loadingView.webContents.loadFile(path.join(__dirname, '../renderer/loading.html'));

    mainWindow.loadingView = loadingView;

    // Wait for loading page to be ready before sending queued data
    loadingView.webContents.once('did-finish-load', () => {
      console.log('[Loading] Loading view finished loading, flushing queued updates');

      // Flush queued updates if provided
      if (loadingUpdateQueue) {
        // Send the latest reason
        if (loadingUpdateQueue.reason !== null) {
          loadingView.webContents.send('update-loading-reason', loadingUpdateQueue.reason);
        }

        // Send all queued progress messages
        for (const message of loadingUpdateQueue.progress) {
          loadingView.webContents.send('update-loading-progress', message);
        }

        // Send the latest auth suggestion
        if (loadingUpdateQueue.authSuggestion !== null) {
          loadingView.webContents.send('show-auth-suggestion', loadingUpdateQueue.authSuggestion);
        }

        // Clear the queue
        loadingUpdateQueue.reason = null;
        loadingUpdateQueue.progress = [];
        loadingUpdateQueue.authSuggestion = null;
      } else if (routingReason) {
        // Fallback to old behavior if no queue provided
        loadingView.webContents.send('update-loading-reason', routingReason);
      }
    });
  }

  // Hide chat view if it exists
  if (mainWindow.chatView) {
    mainWindow.removeBrowserView(mainWindow.chatView);
  }

  // Hide landing view if it exists
  if (mainWindow.landingView) {
    mainWindow.removeBrowserView(mainWindow.landingView);
  }

  // Add loading view to window
  mainWindow.addBrowserView(mainWindow.loadingView);

  // Send queued updates if loading view is already loaded
  if (mainWindow.loadingView.webContents.isLoading() === false) {
    if (loadingUpdateQueue) {
      console.log('[Loading] Loading view already ready, flushing queued updates immediately');

      // Send the latest reason
      if (loadingUpdateQueue.reason !== null) {
        mainWindow.loadingView.webContents.send('update-loading-reason', loadingUpdateQueue.reason);
      }

      // Send all queued progress messages
      for (const message of loadingUpdateQueue.progress) {
        mainWindow.loadingView.webContents.send('update-loading-progress', message);
      }

      // Send the latest auth suggestion
      if (loadingUpdateQueue.authSuggestion !== null) {
        mainWindow.loadingView.webContents.send('show-auth-suggestion', loadingUpdateQueue.authSuggestion);
      }

      // Clear the queue
      loadingUpdateQueue.reason = null;
      loadingUpdateQueue.progress = [];
      loadingUpdateQueue.authSuggestion = null;
    } else if (routingReason) {
      // Fallback to old behavior if no queue provided
      mainWindow.loadingView.webContents.send('update-loading-reason', routingReason);
    }
  }
}

function hideLoadingPage(mainWindow) {
  // Remove loading view from window but keep reference for reuse
  if (mainWindow.loadingView) {
    mainWindow.removeBrowserView(mainWindow.loadingView);
  }
}

module.exports = {
  createWindow,
  switchService,
  showBackgroundService,
  showLandingPage,
  hideLandingPage,
  showLoadingPage,
  hideLoadingPage,
  SERVICES
};
