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
  setChatViewVisible: (visible) => ipcRenderer.invoke('set-chat-view-visible', visible),

  // API Key Management
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
  deleteApiKey: () => ipcRenderer.invoke('delete-api-key'),

  // Loading Page Management
  showLoadingPage: (routingReason) => ipcRenderer.invoke('show-loading-page', routingReason),
  hideLoadingPage: () => ipcRenderer.invoke('hide-loading-page'),
  updateLoadingReason: (reason) => ipcRenderer.invoke('update-loading-reason', reason),
  updateLoadingProgress: (message) => ipcRenderer.invoke('update-loading-progress', message),
  showAuthSuggestion: (visible) => ipcRenderer.invoke('show-auth-suggestion', visible),

  // Show landing page
  showLandingPage: () => ipcRenderer.invoke('show-landing-page'),

  // Loading Page Event Listeners
  onUpdateLoadingReason: (callback) => {
    ipcRenderer.on('update-loading-reason', (event, reason) => callback(reason));
  },
  onUpdateLoadingProgress: (callback) => {
    ipcRenderer.on('update-loading-progress', (event, message) => callback(message));
  },
  onShowAuthSuggestion: (callback) => {
    ipcRenderer.on('show-auth-suggestion', (event, visible) => callback(visible));
  },

  // Notify main process when input is ready
  notifyInputReady: () => ipcRenderer.send('input-ready')
});
