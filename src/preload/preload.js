const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Send message and get AI routing decision
  routeMessage: (message) => ipcRenderer.invoke('route-message', message),
  
  // Manually change service
  changeService: (service) => ipcRenderer.invoke('change-service', service),
  
  // Send text update to chat view
  sendTextUpdate: (text) => ipcRenderer.invoke('send-text-update', text),
  
  // Submit message
  submitMessage: () => ipcRenderer.invoke('submit-message'),
  
  // New chat
  newChat: () => ipcRenderer.invoke('new-chat'),
  
  // Refresh page
  refreshPage: () => ipcRenderer.invoke('refresh-page'),
  
  // Listen for service changes
  onServiceChanged: (callback) => {
    ipcRenderer.on('service-changed', (event, service) => callback(service));
  },
  
  // Listen for text updates
  onTextUpdate: (callback) => {
    ipcRenderer.on('text-update', (event, text) => callback(text));
  },
  
  // Listen for submit message
  onSubmitMessage: (callback) => {
    ipcRenderer.on('submit-message', () => callback());
  },
  
  // Listen for new chat
  onNewChat: (callback) => {
    ipcRenderer.on('new-chat', () => callback());
  },
  
  // Get system prompt
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),
  
  // Save system prompt
  saveSystemPrompt: (prompt) => ipcRenderer.invoke('save-system-prompt', prompt),
  
  // Reset system prompt to default
  resetSystemPrompt: () => ipcRenderer.invoke('reset-system-prompt'),
  
  // Show/hide chat view (for modal overlay)
  setChatViewVisible: (visible) => ipcRenderer.invoke('set-chat-view-visible', visible)
});
