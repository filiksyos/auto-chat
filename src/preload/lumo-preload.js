const { ipcRenderer } = require('electron');

const provider = 'lumo';
const inputSelectors = [
  'body > div.app-root > div.relative.reset4print.flex.flex-row.h-full.w-full.overflow-hidden > div > div > div > main > div > div > div.composer-container.md\\:px-4.w-full > div > section > div > div.lumo-input.flex-grow.w-full.z-30.flex.flex-row.flex-nowrap.items-center.gap-3.p-2.pl-3.min-h-custom.my-auto.border.border-weak.bg-norm.relative > div > div > p',
  '.lumo-input p[contenteditable="true"]',
  '.lumo-input p',
  'p[contenteditable="true"]',
  'div[contenteditable="true"]',
  '[contenteditable="true"]'
];
const submitSelectors = [
  '.composer-submit-button button',
  'body > div.app-root > div.relative.reset4print.flex.flex-row.h-full.w-full.overflow-hidden > div > div > div > main > div > div > div.composer-container.md\\:px-4.w-full > div > section > div > div.lumo-input.flex-grow.w-full.z-30.flex.flex-row.flex-nowrap.items-center.gap-3.p-2.pl-3.min-h-custom.my-auto.border.border-weak.bg-norm.relative > div.flex.flex-row.self-end.items-end.gap-1.h-full.shrink-0.composer-submit-button > button',
  'button[type="submit"]',
  'button img[alt*="send"]'
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
  console.log('[Lumo] injectText:', text);
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[Lumo] Input not found');
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
          console.log('[Lumo] Text injected via execCommand');
          inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          return;
        }
      } catch (e) {
        console.log('[Lumo] execCommand failed, trying direct method');
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
      
      console.log('[Lumo] Text injected via direct method');
    } else if (inputElement.tagName === 'TEXTAREA') {
      inputElement.value = text;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 50);
}

function submitMessage() {
  console.log('[Lumo] submitMessage');
  const submitBtn = findElement(submitSelectors);
  if (submitBtn) {
    // If we found the img, click the parent button
    const button = submitBtn.closest('button') || submitBtn;
    button.click();
    console.log('[Lumo] Clicked submit button');
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
    console.log('[Lumo] Dispatched Enter key event');
  }
}

// Set up IPC listeners
console.log('[Lumo] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Lumo] Received text-update:', text);
  injectText(text);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Lumo] Received submit-message');
  submitMessage();
});

ipcRenderer.on('new-chat', () => {
  console.log('[Lumo] Received new-chat');
  const newChatSelectors = [
    'body > div.app-root > div.relative.reset4print.flex.flex-row.h-full.w-full.overflow-hidden > div > div > div > div > div > div:nth-child(2) > button > div',
    'button[aria-label*="New"]',
    'button[title*="New chat"]',
    'div[role="button"]'
  ];
  const newChatButton = findElement(newChatSelectors);
  if (newChatButton) {
    const button = newChatButton.closest('button') || newChatButton;
    button.click();
    console.log('[Lumo] Clicked new chat button');
  } else {
    console.warn('[Lumo] New chat button not found');
  }
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[Lumo] Found input element');
      ipcRenderer.send('input-ready');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
