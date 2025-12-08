const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../../config/selectors.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load selectors config:', error);
    return {};
  }
}

function findElement(selectors) {
  if (!Array.isArray(selectors)) {
    selectors = [selectors];
  }

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function createSubmitHandler(provider, config, getInputElement) {
  return function submitMessage() {
    console.log(`[${provider}] submitMessage called`);
    const submitElement = findElement(config[provider]?.submit);

    if (submitElement) {
      console.log(`[${provider}] Found submit button, clicking`);
      submitElement.click();
    } else {
      console.log(`[${provider}] Submit button not found, trying Enter key`);
      const inputElement = getInputElement();
      if (inputElement) {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true,
        });
        inputElement.dispatchEvent(enterEvent);
        console.log(`[${provider}] Dispatched Enter key event`);
      } else {
        console.error(`[${provider}] No input element found for Enter key`);
      }
    }
  };
}

function setupIPCListeners(provider, config, injectTextFn, submitFn, lastText) {
  console.log(`[${provider}] Setting up IPC listeners`);
  
  // Remove any existing listeners first to avoid duplicates
  ipcRenderer.removeAllListeners('text-update');
  ipcRenderer.removeAllListeners('submit-message');
  ipcRenderer.removeAllListeners('new-chat');
  
  ipcRenderer.on('text-update', (event, text) => {
    console.log(`[${provider}] Received text-update:`, text);
    if (text !== lastText.value) {
      // Retry injection if element not found
      const retryInjection = (attempt = 0) => {
        if (attempt < 5) {
          try {
            const result = injectTextFn(text);
            // Small delay to let injection complete
            setTimeout(() => {
              if (lastText.value === text) {
                console.log(`[${provider}] Text injection successful`);
              } else if (attempt < 4) {
                console.log(`[${provider}] Retrying text injection, attempt ${attempt + 1}`);
                setTimeout(() => retryInjection(attempt + 1), 500);
              } else {
                console.error(`[${provider}] Failed to inject text after ${attempt + 1} attempts`);
              }
            }, 200);
          } catch (error) {
            console.error(`[${provider}] Error injecting text:`, error);
            if (attempt < 4) {
              setTimeout(() => retryInjection(attempt + 1), 500);
            }
          }
        }
      };
      retryInjection();
    }
  });

  ipcRenderer.on('submit-message', () => {
    console.log(`[${provider}] Received submit-message`);
    // Retry submit if button not found
    const retrySubmit = (attempt = 0) => {
      if (attempt < 3) {
        try {
          submitFn();
          console.log(`[${provider}] Submit attempted`);
        } catch (error) {
          console.error(`[${provider}] Error submitting:`, error);
          setTimeout(() => retrySubmit(attempt + 1), 500);
        }
      }
    };
    retrySubmit();
  });

  ipcRenderer.on('new-chat', () => {
    console.log(`[${provider}] Received new-chat`);
    const newChatButton = findElement(config[provider]?.newChat);
    if (newChatButton) {
      newChatButton.click();
    } else {
      console.warn(`[${provider.charAt(0).toUpperCase() + provider.slice(1)}] New chat button not found`);
    }
  });
  
  console.log(`[${provider}] IPC listeners set up successfully`);
}

function setupInputScanner(provider, config, getInputElement, setInputElement) {
  let scanAttempts = 0;
  const scanInterval = setInterval(() => {
    if (!getInputElement() && scanAttempts < 10) {
      const element = findElement(config[provider]?.input);
      setInputElement(element);
      scanAttempts++;
    } else {
      clearInterval(scanInterval);
    }
  }, 500);
}

function waitForDOM(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

module.exports = {
  loadConfig,
  findElement,
  createSubmitHandler,
  setupIPCListeners,
  setupInputScanner,
  waitForDOM,
};

