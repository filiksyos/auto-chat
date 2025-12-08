const { ipcRenderer } = require('electron');

const provider = 'chatgpt';
const inputSelectors = [
  '#prompt-textarea',
  'textarea[placeholder*="Message"]',
  'textarea[data-testid="chat-input-textarea"]',
  'div[contenteditable="true"]'
];
const submitSelectors = [
  'button[data-testid="send-button"]',
  'button[aria-label*="Send"]',
  'button[type="submit"]'
];

let inputElement = null;
let lastText = '';

function findElement(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) return element;
    } catch (e) {}
  }
  return null;
}

function injectText(text) {
  console.log('[ChatGPT] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[ChatGPT] Input not found');
    return;
  }
  
  lastText = text;
  
  if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputElement.contentEditable === 'true') {
    inputElement.textContent = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function submitMessage() {
  console.log('[ChatGPT] submitMessage');
  const submitBtn = findElement(submitSelectors);
  if (submitBtn) {
    submitBtn.click();
  } else if (inputElement) {
    inputElement.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true
    }));
  }
}

// Set up IPC listeners
console.log('[ChatGPT] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[ChatGPT] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[ChatGPT] Received submit-message');
  submitMessage();
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[ChatGPT] Found input element');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
