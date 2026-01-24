const { ipcRenderer } = require('electron');

const provider = 'qwen';
const inputSelectors = [
  '#chat-input',
  'div[contenteditable="true"]',
  '[contenteditable="true"]',
  'textarea'
];
const submitSelectors = [
  '#chat-message-input > div.chat-message-input-container-inner > div > div > div.prompt-input-container > div.prompt-input-action-bar > div.chat-prompt-send-button > button',
  'div.chat-prompt-send-button > button',
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
  console.log('[Qwen] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[Qwen] Input not found');
    return;
  }
  
  lastText = text;
  
  // Click and focus the element first to ensure it's active
  if (inputElement.click) {
    inputElement.click();
  }
  if (inputElement.focus) {
    inputElement.focus();
  }
  
  // Small delay to ensure the element is ready
  setTimeout(() => {
    if (inputElement.contentEditable === 'true' || inputElement.isContentEditable) {
      // Try execCommand first (deprecated but often works)
      try {
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
        const success = document.execCommand('insertText', false, text);
        if (success) {
          console.log('[Qwen] Text injected via execCommand');
          inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          return;
        }
      } catch (e) {
        console.log('[Qwen] execCommand failed, trying direct method');
      }
      
      // Fallback: direct text injection
      // Clear existing content
      inputElement.textContent = '';
      inputElement.innerText = '';
      
      // Set the text
      inputElement.textContent = text;
      inputElement.innerText = text;
      
      // Trigger multiple events to ensure the UI updates
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));
      
      // Trigger composition events for better compatibility (if available)
      try {
        if (typeof CompositionEvent !== 'undefined') {
          inputElement.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          inputElement.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: text }));
          inputElement.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
        }
      } catch (e) {
        // CompositionEvent not available, skip
      }
      
      console.log('[Qwen] Text injected via direct method');
    } else if (inputElement.tagName === 'TEXTAREA') {
      inputElement.value = text;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 50);
}

function submitMessage() {
  console.log('[Qwen] submitMessage');
  const submitBtn = findElement(submitSelectors);
  if (submitBtn) {
    submitBtn.click();
    console.log('[Qwen] Clicked submit button');
  } else if (inputElement) {
    // Fallback to Enter key
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputElement.dispatchEvent(enterEvent);
    console.log('[Qwen] Dispatched Enter key event');
  }
}

// Set up IPC listeners
console.log('[Qwen] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Qwen] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Qwen] Received submit-message');
  submitMessage();
});

ipcRenderer.on('new-chat', () => {
  console.log('[Qwen] Received new-chat');
  const newChatSelectors = [
    '#sidebar > div > div.sidebar-entry-list > div.sidebar-entry-list-content',
    'button[aria-label*="New"]',
    'button[title*="New chat"]',
    'div[role="button"]'
  ];
  const newChatButton = findElement(newChatSelectors);
  if (newChatButton) {
    // If it's a container, try to find a clickable element within it
    const clickable = newChatButton.querySelector('button, a, [role="button"]') || newChatButton;
    if (clickable.click) {
      clickable.click();
      console.log('[Qwen] Clicked new chat button');
    } else {
      // Try dispatching a click event
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      clickable.dispatchEvent(clickEvent);
      console.log('[Qwen] Dispatched click event on new chat');
    }
  } else {
    console.warn('[Qwen] New chat button not found');
  }
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[Qwen] Found input element');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
