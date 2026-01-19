const { ipcRenderer } = require('electron');

const provider = 'lechat';
const inputSelectors = [
  'body > main > div > div.relative.flex.h-full.w-full.justify-start.overflow-hidden > div > main > div > div > div > div > div.relative.flex.h-full.w-full.flex-1.flex-col.items-center.justify-center > div.absolute.flex.w-full.max-w-\(--breakpoint-md\).flex-col.px-2 > div > form > div > div > div.relative.overflow-hidden.mb-5.min-h-10.w-full > div > div > div > div > div > p',
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
  console.log('[LeChat] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[LeChat] Input not found');
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
  console.log('[LeChat] submitMessage');
  // Le Chat uses Enter key to submit, no submit button
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
    console.log('[LeChat] Dispatched Enter key event');
  } else {
    console.error('[LeChat] Input element not found for Enter key');
  }
}

// Set up IPC listeners
console.log('[LeChat] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[LeChat] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[LeChat] Received submit-message');
  submitMessage();
});

ipcRenderer.on('new-chat', () => {
  console.log('[LeChat] Received new-chat');
  const newChatSelectors = [
    'body > main > div > div.relative.flex.h-full.w-full.justify-start.overflow-hidden > div > main > div > div > div > div > div.left-0.right-0.top-0.z-20.flex.w-full.flex-row.items-center.justify-between.transition-shadow.desktop-mac\:pt-8.desktop-mac\:drag > div.flex-row.p-3.flex.items-center.gap-4.ps-6.pt-3.desktop-mac\:no-drag > a',
    'a[href]',
    'a'
  ];
  const newChatButton = findElement(newChatSelectors);
  if (newChatButton) {
    newChatButton.click();
    console.log('[LeChat] Clicked new chat button');
  } else {
    console.warn('[LeChat] New chat button not found');
  }
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[LeChat] Found input element');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
