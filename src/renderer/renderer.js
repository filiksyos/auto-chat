const textInput = document.getElementById('textInput');
const routingStatus = document.getElementById('routingStatus');
const newChatBtn = document.getElementById('newChatBtn');
const refreshBtn = document.getElementById('refreshBtn');
const serviceBtns = document.querySelectorAll('.service-btn');

let currentService = 'chatgpt';
let isRouting = false;

// Update active service button
function updateActiveService(service) {
  currentService = service;
  serviceBtns.forEach(btn => {
    if (btn.dataset.service === service) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Handle service button clicks (manual override)
serviceBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const service = btn.dataset.service;
    if (service !== currentService) {
      routingStatus.textContent = `🔄 Switching to ${service}...`;
      routingStatus.className = 'routing-status routing';
      
      const result = await window.electronAPI.changeService(service);
      if (result.success) {
        updateActiveService(service);
        routingStatus.textContent = `✓ Manually switched to ${service}`;
        routingStatus.className = 'routing-status routed';
        
        setTimeout(() => {
          routingStatus.textContent = '🤖 Auto-routing enabled';
          routingStatus.className = 'routing-status';
        }, 2000);
      }
    }
  });
});

// Handle text input
textInput.addEventListener('input', () => {
  const text = textInput.value;
  window.electronAPI.sendTextUpdate(text);
});

// Handle Enter key for submission
textInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    
    const message = textInput.value.trim();
    if (message && !isRouting) {
      isRouting = true;
      
      // Show routing status
      routingStatus.textContent = '🤖 Analyzing request...';
      routingStatus.className = 'routing-status routing';
      
      // Route message to appropriate service
      const result = await window.electronAPI.routeMessage(message);
      
      if (result.success) {
        updateActiveService(result.service);
        routingStatus.textContent = `✓ Routed to ${result.service}: ${result.reason}`;
        routingStatus.className = 'routing-status routed';
        
        // Wait a bit for service to load, then submit
        setTimeout(async () => {
          await window.electronAPI.submitMessage();
          textInput.value = '';
          
          // Reset status after a delay
          setTimeout(() => {
            routingStatus.textContent = '🤖 Auto-routing enabled';
            routingStatus.className = 'routing-status';
          }, 2000);
        }, 1000);
      } else {
        routingStatus.textContent = `❌ Error: ${result.error}`;
        routingStatus.className = 'routing-status';
      }
      
      isRouting = false;
    }
  }
});

// New chat button
newChatBtn.addEventListener('click', async () => {
  await window.electronAPI.newChat();
});

// Refresh button
refreshBtn.addEventListener('click', async () => {
  await window.electronAPI.refreshPage();
});

// Listen for service changes from main process
window.electronAPI.onServiceChanged((service) => {
  updateActiveService(service);
});

// Focus text input on load
textInput.focus();
