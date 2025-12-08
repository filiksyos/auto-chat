const { app, ipcMain } = require('electron');
const windowManager = require('./window-manager');
const { selectAIService } = require('./ai-router');

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
