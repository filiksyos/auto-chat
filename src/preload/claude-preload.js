const { ipcRenderer } = require('electron');

const provider = 'claude';
const inputSelectors = [
  'div[data-testid="chat-input"]',
  'div[contenteditable="true"][role="textbox"]',
  'div.ProseMirror',
  '[role="textbox"]'
];
const submitSelectors = [
  'button[aria-label="Send message"]',
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
  console.log('[Claude] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[Claude] Input not found');
    return;
  }
  
  lastText = text;
  
  if (inputElement.contentEditable === 'true') {
    inputElement.textContent = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function submitMessage() {
  console.log('[Claude] submitMessage');
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
console.log('[Claude] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Claude] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Claude] Received submit-message');
  submitMessage();
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[Claude] Found input element');
      ipcRenderer.send('input-ready');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
