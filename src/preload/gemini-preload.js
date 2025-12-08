const { ipcRenderer } = require('electron');

const provider = 'gemini';
const inputSelectors = [
  'rich-textarea',
  'div[role="textbox"]',
  '[contenteditable="true"]',
  'textarea'
];
const submitSelectors = [
  'button[aria-label*="Send"]',
  'button[data-testid="send-button"]',
  'div[class*="send-button"] button'
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

function findGeminiInput(element) {
  if (!element) return null;

  if (element.tagName === 'RICH-TEXTAREA') {
    const contenteditable = element.querySelector('[contenteditable="true"]');
    if (contenteditable) return contenteditable;
  }

  if (element.contentEditable === 'true') {
    const paragraph = element.querySelector('p');
    if (paragraph) return paragraph;
    return element;
  }

  return element;
}

function injectText(text) {
  console.log('[Gemini] injectText:', text);
  const rawElement = findElement(inputSelectors);
  inputElement = findGeminiInput(rawElement);
  
  if (!inputElement) {
    console.error('[Gemini] Input not found');
    return;
  }
  
  lastText = text;
  inputElement.focus();
  
  if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.selectionStart = text.length;
    inputElement.selectionEnd = text.length;
  } else if (inputElement.contentEditable === 'true' || inputElement.tagName === 'P') {
    // Clear existing content
    while (inputElement.firstChild) {
      inputElement.removeChild(inputElement.firstChild);
    }

    // Insert text with line breaks
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      inputElement.appendChild(document.createTextNode(line));
      if (index < lines.length - 1) {
        inputElement.appendChild(document.createElement('br'));
      }
    });
  } else if (inputElement.tagName === 'INPUT') {
    inputElement.value = text;
  } else {
    inputElement.textContent = text;
  }

  const events = [
    new Event('input', { bubbles: true }),
    new Event('change', { bubbles: true }),
    new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'a',
    }),
  ];

  events.forEach((event) => inputElement.dispatchEvent(event));
  
  console.log('[Gemini] Text injected, current value:', inputElement.textContent || inputElement.innerText || inputElement.value);
}

function submitMessage() {
  console.log('[Gemini] submitMessage');
  const submitBtn = findElement(submitSelectors);
  console.log('[Gemini] Submit button found:', !!submitBtn);
  
  if (submitBtn) {
    console.log('[Gemini] Clicking submit button');
    submitBtn.focus();
    submitBtn.click();
    // Also try dispatching mouse events
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  } else if (inputElement) {
    console.log('[Gemini] No submit button, trying Enter key');
    inputElement.focus();
    inputElement.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    inputElement.dispatchEvent(new KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    inputElement.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
  } else {
    console.error('[Gemini] No input element or submit button found');
  }
}

// Set up IPC listeners
console.log('[Gemini] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Gemini] Received text-update:', text);
  // Wait a bit for page to be ready, then inject
  setTimeout(() => {
    injectText(text);
  }, 300);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Gemini] Received submit-message');
  submitMessage();
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    const rawElement = findElement(inputSelectors);
    inputElement = findGeminiInput(rawElement);
    if (inputElement) {
      console.log('[Gemini] Found input element');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
