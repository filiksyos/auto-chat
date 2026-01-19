const { ipcRenderer } = require('electron');

const provider = 'grok';
const inputSelectors = [
  'p[contenteditable="true"]',
  'div[contenteditable="true"]',
  '[contenteditable="true"]',
  'form p[contenteditable]'
];
const submitSelectors = []; // No submit button - uses Enter key

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
  console.log('[Grok] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[Grok] Input not found');
    return;
  }
  
  lastText = text;
  
  if (inputElement.contentEditable === 'true') {
    inputElement.textContent = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function submitMessage() {
  console.log('[Grok] submitMessage');
  // Grok uses Enter key to submit, no submit button
  if (inputElement) {
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputElement.dispatchEvent(enterEvent);
    console.log('[Grok] Dispatched Enter key event');
  } else {
    console.error('[Grok] Input element not found for Enter key');
  }
}

// Set up IPC listeners
console.log('[Grok] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Grok] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Grok] Received submit-message');
  submitMessage();
});

ipcRenderer.on('new-chat', () => {
  console.log('[Grok] Received new-chat');
  // Try to find new chat button (parent of SVG icon)
  const newChatSelectors = ['span > a', 'a[href]', 'a'];
  const newChatButton = findElement(newChatSelectors);
  if (newChatButton) {
    newChatButton.click();
    console.log('[Grok] Clicked new chat button');
  } else {
    console.warn('[Grok] New chat button not found');
  }
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[Grok] Found input element');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
