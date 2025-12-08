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
      
      // Switch to the selected service
      windowManager.switchService(mainWindow, selectedService.service);
      
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
    windowManager.switchService(mainWindow, service);
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
