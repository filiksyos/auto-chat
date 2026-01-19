const { app, ipcMain, safeStorage } = require('electron');
const windowManager = require('./window-manager');
const { selectAIService } = require('./ai-router');
const configManager = require('./config-manager');
const fs = require('fs');
const path = require('path');

let mainWindow;
let currentService = 'chatgpt';
let preferredService = null; // Manual service override
let cachedApiKey = null;

// Queue for loading page updates that arrive before the loading view is ready
let loadingUpdateQueue = {
  reason: null,
  progress: [],
  authSuggestion: null
};

app.on('ready', async () => {
  mainWindow = await windowManager.createWindow();

  // Helper function to update loading state
  const updateLoadingState = (type, data) => {
    try {
      if (type === 'progress') {
        loadingUpdateQueue.progress.push(data);
        if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
          mainWindow.loadingView.webContents.send('update-loading-progress', data);
        }
      } else if (type === 'reason') {
        loadingUpdateQueue.reason = data;
        if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
          mainWindow.loadingView.webContents.send('update-loading-reason', data);
        }
      } else if (type === 'auth') {
        loadingUpdateQueue.authSuggestion = data;
        if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
          mainWindow.loadingView.webContents.send('show-auth-suggestion', data);
        }
      }
    } catch (error) {
      console.error(`Error updating loading state (${type}):`, error);
    }
  };

  // Handle AI routing request
  ipcMain.handle('route-message', async (event, message) => {
    let inputReady = false;

    try {
      // 1. Show loading page immediately
      windowManager.showLoadingPage(mainWindow, 'Analyzing your request...', loadingUpdateQueue);
      updateLoadingState('progress', 'Analyzing your request...');
      updateLoadingState('auth', true);

      // 2. Get routing decision (honor manual override if set)
      let selectedService;
      if (preferredService) {
        selectedService = {
          service: preferredService,
          reason: `Using your preferred service: ${preferredService}`
        };
        preferredService = null; // Clear after use
      } else {
        selectedService = await selectAIService(message);
      }
      currentService = selectedService.service;
      updateLoadingState('reason', selectedService.reason);
      updateLoadingState('progress', `Loading ${selectedService.service}...`);

      // Emit service-changed so UI reflects the routing decision
      if (mainWindow.controlView && mainWindow.controlView.webContents) {
        mainWindow.controlView.webContents.send('service-changed', selectedService.service);
      }

      // 3. Set up input readiness promise
      const inputReadyPromise = new Promise(resolve => {
        mainWindow.inputReadyResolver = resolve;
      });

      // 4. Load service in background
      await windowManager.switchService(mainWindow, selectedService.service, true);
      updateLoadingState('progress', 'Page loaded, waiting for input...');

      // 5. Wait for input readiness (with 10 second timeout)
      const readyResult = await Promise.race([
        inputReadyPromise.then(() => 'ready'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 10000))
      ]);

      if (readyResult === 'ready') {
        inputReady = true;
        updateLoadingState('progress', 'Preparing message...');
      } else {
        // Timeout - input not ready, provide recovery UI
        console.error('[Routing] Input readiness timeout - input not ready after 10 seconds');
        mainWindow.inputReadyResolver = null;
        // Hide loading page and show landing page for recovery
        windowManager.hideLoadingPage(mainWindow);
        windowManager.showLandingPage(mainWindow);
        return {
          success: false,
          error: 'Input not ready within timeout period'
        };
      }

      // 6. Only proceed if input is ready
      if (!inputReady) {
        throw new Error('Input readiness check failed');
      }

      // 7. Inject message while hidden
      if (!mainWindow.chatView || !mainWindow.chatView.webContents) {
        throw new Error('ChatView not available');
      }
      mainWindow.chatView.webContents.send('text-update', message);
      await new Promise(resolve => setTimeout(resolve, 500));
      updateLoadingState('progress', 'Sending message...');

      // 8. Show service and submit
      windowManager.showBackgroundService(mainWindow);
      windowManager.hideLoadingPage(mainWindow);
      await new Promise(resolve => setTimeout(resolve, 200));
      mainWindow.chatView.webContents.send('submit-message');

      // 9. Stay on the service page (ChatGPT/Grok) after message submission
      // User can continue interacting with the AI service

      // Clean up
      mainWindow.inputReadyResolver = null;

      return {
        success: true,
        service: selectedService.service,
        reason: selectedService.reason
      };
    } catch (error) {
      console.error('Error routing message:', error);

      // Clean up on error
      mainWindow.inputReadyResolver = null;
      windowManager.hideLoadingPage(mainWindow);

      // Show service or landing page
      if (mainWindow.chatView) {
        windowManager.showBackgroundService(mainWindow);
      } else {
        windowManager.showLandingPage(mainWindow);
      }

      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle manual service change
  ipcMain.handle('change-service', async (event, service) => {
    currentService = service;
    preferredService = service; // Set manual override
    // Emit service-changed so UI reflects the user's choice
    if (mainWindow.controlView && mainWindow.controlView.webContents) {
      mainWindow.controlView.webContents.send('service-changed', service);
    }
    return { success: true, service };
  });

  // Handle text update
  ipcMain.handle('send-text-update', async (event, text) => {
    if (mainWindow.chatView && mainWindow.chatView.webContents) {
      mainWindow.chatView.webContents.send('text-update', text);
    }
  });

  // Handle submit message
  ipcMain.handle('submit-message', async (event) => {
    if (mainWindow.chatView && mainWindow.chatView.webContents) {
      mainWindow.chatView.webContents.send('submit-message');
    }
    return true;
  });

  // Handle new chat
  ipcMain.handle('new-chat', async (event) => {
    if (mainWindow.chatView && mainWindow.chatView.webContents) {
      mainWindow.chatView.webContents.send('new-chat');
    }
    // Return to landing page after new chat
    windowManager.showLandingPage(mainWindow);
    return true;
  });

  // Handle refresh
  ipcMain.handle('refresh-page', async (event) => {
    if (mainWindow.chatView && mainWindow.chatView.webContents) {
      mainWindow.chatView.webContents.reload();
    }
    return true;
  });

  // Handle selector errors from preload scripts
  ipcMain.handle('selector-error', (event, service, error) => {
    console.error(`[${service}] Selector error:`, error);
    return true;
  });

  // Handle get system prompt
  ipcMain.handle('get-system-prompt', async (event) => {
    try {
      const prompt = configManager.loadSystemPrompt();
      return {
        success: true,
        prompt: prompt
      };
    } catch (error) {
      console.error('Error getting system prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle save system prompt
  ipcMain.handle('save-system-prompt', async (event, prompt) => {
    try {
      await configManager.saveSystemPrompt(prompt);
      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving system prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle reset system prompt
  ipcMain.handle('reset-system-prompt', async (event) => {
    try {
      await configManager.resetSystemPrompt();
      return {
        success: true
      };
    } catch (error) {
      console.error('Error resetting system prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle show/hide chat view (for modal overlay)
  ipcMain.handle('set-chat-view-visible', async (event, visible) => {
    try {
      const bounds = mainWindow.getContentBounds();

      if (visible) {
        // Restore control bar to normal height
        if (mainWindow.controlView) {
          mainWindow.controlView.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: 90 // CONTROL_BAR_HEIGHT
          });
        }
        // Show the chat view if it exists, otherwise show landing page
        if (mainWindow.chatView) {
          mainWindow.addBrowserView(mainWindow.chatView);
          mainWindow.chatView.setBounds({
            x: 0,
            y: 90, // CONTROL_BAR_HEIGHT
            width: bounds.width,
            height: bounds.height - 90
          });
        } else {
          // Restore landing view if chatView is not present
          windowManager.showLandingPage(mainWindow);
        }
      } else {
        // Hide the chat view by removing it from the window
        if (mainWindow.chatView) {
          mainWindow.removeBrowserView(mainWindow.chatView);
        }
        // Hide the landing view as well
        windowManager.hideLandingPage(mainWindow);
        // Expand control bar to full window height for modal
        if (mainWindow.controlView) {
          mainWindow.controlView.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height
          });
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Error setting chat view visibility:', error);
      return { success: false, error: error.message };
    }
  });

  // API Key Management Handlers

  // Save API key
  ipcMain.handle('save-api-key', async (event, apiKey) => {
    try {
      // Validate API key
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return { success: false, error: 'Invalid API key' };
      }

      // Check if encryption is available
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption is not available on this system. Cannot securely store API key.' };
      }

      // Encrypt the API key
      const encryptedBuffer = safeStorage.encryptString(apiKey);
      const apiKeyPath = path.join(app.getPath('userData'), 'api-key.enc');
      fs.writeFileSync(apiKeyPath, encryptedBuffer);

      // Cache the API key
      cachedApiKey = apiKey;

      return { success: true };
    } catch (error) {
      console.error('Error saving API key:', error);
      return { success: false, error: error.message };
    }
  });

  // Get API key
  ipcMain.handle('get-api-key', async (event) => {
    try {
      // Return cached key if available
      if (cachedApiKey) {
        return { success: true, apiKey: cachedApiKey };
      }

      // Try to read encrypted file
      const encryptedPath = path.join(app.getPath('userData'), 'api-key.enc');

      if (fs.existsSync(encryptedPath)) {
        // Read and decrypt
        const encryptedBuffer = fs.readFileSync(encryptedPath);
        const decryptedKey = safeStorage.decryptString(encryptedBuffer);
        cachedApiKey = decryptedKey;
        return { success: true, apiKey: decryptedKey };
      }

      // Check environment variable as fallback
      if (process.env.OPENROUTER_API_KEY) {
        cachedApiKey = process.env.OPENROUTER_API_KEY;
        return { success: true, apiKey: process.env.OPENROUTER_API_KEY };
      }

      // No API key found
      return { success: false, error: 'No API key found' };
    } catch (error) {
      console.error('Error getting API key:', error);
      return { success: false, error: error.message };
    }
  });

  // Check if API key exists
  ipcMain.handle('check-api-key', async (event) => {
    try {
      // Check cache first
      if (cachedApiKey) {
        return { exists: true };
      }

      // Check encrypted file
      const encryptedPath = path.join(app.getPath('userData'), 'api-key.enc');

      if (fs.existsSync(encryptedPath)) {
        return { exists: true };
      }

      // Check environment variable
      if (process.env.OPENROUTER_API_KEY) {
        return { exists: true };
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking API key:', error);
      return { exists: false };
    }
  });

  // Delete API key
  ipcMain.handle('delete-api-key', async (event) => {
    try {
      const encryptedPath = path.join(app.getPath('userData'), 'api-key.enc');

      // Delete encrypted file if exists
      if (fs.existsSync(encryptedPath)) {
        fs.unlinkSync(encryptedPath);
      }

      // Clear cache
      cachedApiKey = null;

      return { success: true };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return { success: false, error: error.message };
    }
  });

  // Loading Page Handlers

  // Show loading page
  ipcMain.handle('show-loading-page', async (event, routingReason) => {
    try {
      windowManager.showLoadingPage(mainWindow, routingReason, loadingUpdateQueue);
      return { success: true };
    } catch (error) {
      console.error('Error showing loading page:', error);
      return { success: false, error: error.message };
    }
  });

  // Hide loading page
  ipcMain.handle('hide-loading-page', async (event) => {
    try {
      windowManager.hideLoadingPage(mainWindow);
      return { success: true };
    } catch (error) {
      console.error('Error hiding loading page:', error);
      return { success: false, error: error.message };
    }
  });

  // Update loading reason
  ipcMain.handle('update-loading-reason', async (event, reason) => {
    try {
      // Always track the latest reason
      loadingUpdateQueue.reason = reason;

      // Only send if loadingView exists and has finished loading
      if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
        mainWindow.loadingView.webContents.send('update-loading-reason', reason);
        return { success: true };
      } else {
        // Queue the update for later
        console.log('[Loading] Queued loading reason update:', reason);
        return { success: false, error: 'Loading view not ready, update queued' };
      }
    } catch (error) {
      console.error('Error updating loading reason:', error);
      return { success: false, error: error.message };
    }
  });

  // Update loading progress
  ipcMain.handle('update-loading-progress', async (event, message) => {
    try {
      // Track progress messages
      loadingUpdateQueue.progress.push(message);

      // Only send if loadingView exists and has finished loading
      if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
        mainWindow.loadingView.webContents.send('update-loading-progress', message);
        return { success: true };
      } else {
        // Queue the update for later
        console.log('[Loading] Queued loading progress update:', message);
        return { success: false, error: 'Loading view not ready, update queued' };
      }
    } catch (error) {
      console.error('Error updating loading progress:', error);
      return { success: false, error: error.message };
    }
  });

  // Show auth suggestion
  ipcMain.handle('show-auth-suggestion', async (event, visible) => {
    try {
      // Track the latest auth suggestion state
      loadingUpdateQueue.authSuggestion = visible;

      // Only send if loadingView exists and has finished loading
      if (mainWindow.loadingView && mainWindow.loadingView.webContents && !mainWindow.loadingView.webContents.isLoading()) {
        mainWindow.loadingView.webContents.send('show-auth-suggestion', visible);
        return { success: true };
      } else {
        // Queue the update for later
        console.log('[Loading] Queued auth suggestion update:', visible);
        return { success: false, error: 'Loading view not ready, update queued' };
      }
    } catch (error) {
      console.error('Error showing auth suggestion:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle input ready signal from preload scripts
  ipcMain.on('input-ready', (event) => {
    console.log('[Main] Input ready signal received');
    if (mainWindow.inputReadyResolver) {
      mainWindow.inputReadyResolver();
      mainWindow.inputReadyResolver = null;
    }
  });

  // Handle show landing page
  ipcMain.handle('show-landing-page', async (event) => {
    try {
      windowManager.showLandingPage(mainWindow);
      return { success: true };
    } catch (error) {
      console.error('Error showing landing page:', error);
      return { success: false, error: error.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    mainWindow = await windowManager.createWindow();
  }
});
