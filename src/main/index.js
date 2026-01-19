const { app, ipcMain } = require('electron');
const windowManager = require('./window-manager');
const { selectAIService } = require('./ai-router');
const configManager = require('./config-manager');

let mainWindow;
let currentService = 'chatgpt';

app.on('ready', async () => {
  mainWindow = await windowManager.createWindow();

  // Handle AI routing request
  ipcMain.handle('route-message', async (event, message) => {
    try {
      const selectedService = await selectAIService(message);
      currentService = selectedService.service;
      
      // Switch to the selected service and wait for it to load
      console.log(`Switching to ${selectedService.service}...`);
      await windowManager.switchService(mainWindow, selectedService.service);
      console.log(`Switched to ${selectedService.service}, waiting for page initialization...`);
      
      // Wait for the page to be fully ready - check if webContents is still valid
      if (!mainWindow.chatView || !mainWindow.chatView.webContents) {
        throw new Error('ChatView not available after switch');
      }
      
      // Wait for the preload script to be ready and page to initialize
      // For SPAs like ChatGPT, we need to wait for the actual content to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Double-check webContents is still valid
      if (!mainWindow.chatView || !mainWindow.chatView.webContents) {
        throw new Error('ChatView became unavailable');
      }
      
      // Send the message text to the chat view
      console.log(`Sending text-update to ${selectedService.service}:`, message);
      try {
        mainWindow.chatView.webContents.send('text-update', message);
        console.log(`Successfully sent text-update`);
      } catch (error) {
        console.error('Error sending text-update:', error);
        throw error;
      }
      
      // Wait a bit for text to be injected, then submit
      setTimeout(() => {
        if (mainWindow.chatView && mainWindow.chatView.webContents) {
          console.log(`Sending submit-message to ${selectedService.service}`);
          try {
            mainWindow.chatView.webContents.send('submit-message');
            console.log(`Successfully sent submit-message`);
          } catch (error) {
            console.error('Error sending submit-message:', error);
          }
        } else {
          console.error('chatView or webContents not available for submit');
        }
      }, 1500);
      
      return {
        success: true,
        service: selectedService.service,
        reason: selectedService.reason
      };
    } catch (error) {
      console.error('Error routing message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle manual service change
  ipcMain.handle('change-service', async (event, service) => {
    currentService = service;
    await windowManager.switchService(mainWindow, service);
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
        // Show the chat view
        if (mainWindow.chatView) {
          mainWindow.addBrowserView(mainWindow.chatView);
          mainWindow.chatView.setBounds({
            x: 0,
            y: 90, // CONTROL_BAR_HEIGHT
            width: bounds.width,
            height: bounds.height - 90
          });
        }
      } else {
        // Hide the chat view by removing it from the window
        if (mainWindow.chatView) {
          mainWindow.removeBrowserView(mainWindow.chatView);
        }
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
