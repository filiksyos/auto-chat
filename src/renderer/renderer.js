const settingsBtn = document.getElementById('settingsBtn');
const serviceBtns = document.querySelectorAll('.service-btn[data-service]');
const textInput = document.getElementById('textInput');
const routingStatus = document.getElementById('routingStatus');

// Modal elements
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const savePromptBtn = document.getElementById('savePromptBtn');
const resetPromptBtn = document.getElementById('resetPromptBtn');
const promptTextarea = document.getElementById('promptTextarea');
const charCount = document.getElementById('charCount');
const modalMessage = document.getElementById('modalMessage');

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
  // Don't mark settings button as active
  if (settingsBtn) {
    settingsBtn.classList.remove('active');
  }
}

// Handle service button clicks (manual override)
serviceBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const service = btn.dataset.service;
    if (service && service !== currentService) {
      const result = await window.electronAPI.changeService(service);
      if (result.success) {
        updateActiveService(service);
      }
    }
  });
});

// Listen for service changes from main process
window.electronAPI.onServiceChanged((service) => {
  updateActiveService(service);
});

// Handle text input - route on Enter
textInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isRouting) {
    e.preventDefault();
    const message = textInput.value.trim();
    if (message) {
      isRouting = true;
      routingStatus.textContent = '🔄 Routing...';
      
      try {
        const result = await window.electronAPI.routeMessage(message);
        if (result.success) {
          routingStatus.textContent = `✓ ${result.service}`;
          textInput.value = '';
          setTimeout(() => {
            routingStatus.textContent = '🤖 Ready';
          }, 2000);
        } else {
          routingStatus.textContent = '❌ Error';
          setTimeout(() => {
            routingStatus.textContent = '🤖 Ready';
          }, 2000);
        }
      } catch (error) {
        routingStatus.textContent = '❌ Error';
        setTimeout(() => {
          routingStatus.textContent = '🤖 Ready';
        }, 2000);
      }
      
      isRouting = false;
    }
  }
});

// Focus text input on load
textInput.focus();

// Settings Modal Logic
let originalPrompt = '';

// Show modal message
function showModalMessage(text, type = 'success') {
  modalMessage.textContent = text;
  modalMessage.className = `modal-message ${type} show`;
  setTimeout(() => {
    modalMessage.classList.remove('show');
  }, 3000);
}

// Update character count
function updateCharCount() {
  const count = promptTextarea.value.length;
  charCount.textContent = `${count.toLocaleString()} characters`;
}

// Load current prompt into modal
async function loadPromptIntoModal() {
  try {
    const result = await window.electronAPI.getSystemPrompt();
    if (result.success) {
      originalPrompt = result.prompt;
      promptTextarea.value = result.prompt;
      updateCharCount();
    } else {
      showModalMessage(`Error loading prompt: ${result.error}`, 'error');
    }
  } catch (error) {
    showModalMessage(`Error loading prompt: ${error.message}`, 'error');
  }
}

// Open settings modal
async function openSettingsModal() {
  // Hide the chat view so modal is visible
  await window.electronAPI.setChatViewVisible(false);
  settingsModal.classList.add('show');
  await loadPromptIntoModal();
  promptTextarea.focus();
}

// Close settings modal
async function closeSettingsModal() {
  settingsModal.classList.remove('show');
  promptTextarea.value = '';
  modalMessage.classList.remove('show');
  originalPrompt = '';
  // Show the chat view again
  await window.electronAPI.setChatViewVisible(true);
}

// Save prompt
async function savePrompt() {
  const prompt = promptTextarea.value.trim();
  
  if (prompt.length === 0) {
    showModalMessage('Prompt cannot be empty', 'error');
    return;
  }
  
  try {
    const result = await window.electronAPI.saveSystemPrompt(prompt);
    if (result.success) {
      originalPrompt = prompt;
      showModalMessage('System prompt saved successfully!', 'success');
      setTimeout(() => {
        closeSettingsModal();
      }, 1500);
    } else {
      showModalMessage(`Error saving prompt: ${result.error}`, 'error');
    }
  } catch (error) {
    showModalMessage(`Error saving prompt: ${error.message}`, 'error');
  }
}

// Reset prompt to default
async function resetPrompt() {
  if (!confirm('Are you sure you want to reset to the default system prompt? This will discard any customizations.')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.resetSystemPrompt();
    if (result.success) {
      await loadPromptIntoModal();
      showModalMessage('System prompt reset to default', 'success');
    } else {
      showModalMessage(`Error resetting prompt: ${result.error}`, 'error');
    }
  } catch (error) {
    showModalMessage(`Error resetting prompt: ${error.message}`, 'error');
  }
}

// Settings button click - prevent it from being treated as a service button
if (settingsBtn) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettingsModal();
  });
}

// Close modal buttons
closeModalBtn.addEventListener('click', () => {
  closeSettingsModal();
});

cancelModalBtn.addEventListener('click', () => {
  closeSettingsModal();
});

// Close modal on overlay click
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    closeSettingsModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
    closeSettingsModal();
  }
});

// Save button
savePromptBtn.addEventListener('click', () => {
  savePrompt();
});

// Reset button
resetPromptBtn.addEventListener('click', () => {
  resetPrompt();
});

// Update character count on input
promptTextarea.addEventListener('input', () => {
  updateCharCount();
});
