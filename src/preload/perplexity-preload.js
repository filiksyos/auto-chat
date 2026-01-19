const { ipcRenderer } = require('electron');

const provider = 'perplexity';
const inputSelectors = [
  '#ask-input',
  'div[data-lexical-editor="true"]',
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"]'
];
const submitSelectors = [
  'button[data-testid="submit-button"]',
  'button[aria-label="Submit"]',
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
  console.log('[Perplexity] injectText:', text);
  // Always rescan input element in case user switched chats
  inputElement = findElement(inputSelectors);
  
  if (!inputElement) {
    console.error('[Perplexity] Input element not found. Tried selectors:', inputSelectors);
    return;
  }
  
  console.log('[Perplexity] Found input element:', inputElement.tagName, inputElement.id, inputElement.className);
  
  // Focus the element first
  inputElement.focus();
  
  if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.selectionStart = text.length;
    inputElement.selectionEnd = text.length;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (inputElement.contentEditable === 'true') {
    const currentContent = inputElement.textContent || '';
    
    if (text === lastText && text === currentContent) {
      return;
    } else if (text.length === 0) {
      if (currentContent.length > 0) {
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(inputElement);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete');
          console.log('[Perplexity] Cleared all text');
        } catch (err) {
          console.error('[Perplexity] clear failed:', err);
        }
      }
    } else if (text.startsWith(lastText)) {
      // User is typing forward - insert only the new characters
      const newChars = text.slice(lastText.length);
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputElement);
        range.collapse(false); // Collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('insertText', false, newChars);
        console.log('[Perplexity] Inserted:', newChars);
      } catch (err) {
        console.error('[Perplexity] insert failed:', err);
      }
    } else if (lastText.startsWith(text)) {
      // User is deleting - remove characters from the end
      const charsToDelete = lastText.length - text.length;
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputElement);
        range.collapse(false); // Collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
        for (let i = 0; i < charsToDelete; i++) {
          document.execCommand('delete', false, null);
        }
        console.log('[Perplexity] Deleted', charsToDelete, 'chars');
      } catch (err) {
        console.error('[Perplexity] delete failed:', err);
      }
    } else {
      // Text changed completely (paste, select middle+delete, etc.) - replace all
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputElement);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete');
        if (text.length > 0) {
          document.execCommand('insertText', false, text);
        }
        console.log('[Perplexity] Replaced all with:', text);
      } catch (err) {
        console.error('[Perplexity] replace failed:', err);
      }
    }
  } else if (inputElement.tagName === 'INPUT') {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  lastText = text;
  console.log('[Perplexity] Text injection complete');
}

function submitMessage() {
  console.log('[Perplexity] submitMessage');
  const submitBtn = findElement(submitSelectors);
  console.log('[Perplexity] Submit button found:', !!submitBtn);
  
  if (submitBtn) {
    console.log('[Perplexity] Clicking submit button');
    submitBtn.focus();
    submitBtn.click();
    // Also try dispatching mouse events
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  } else if (inputElement) {
    console.log('[Perplexity] No submit button, trying Enter key');
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
    console.error('[Perplexity] No input element or submit button found');
  }
}

// Set up IPC listeners
console.log('[Perplexity] Preload loaded');
ipcRenderer.on('text-update', (event, text) => {
  console.log('[Perplexity] Received text-update:', text);
  // Wait a bit for page to be ready, then inject
  setTimeout(() => {
    injectText(text);
  }, 300);
});

ipcRenderer.on('submit-message', () => {
  console.log('[Perplexity] Received submit-message');
  submitMessage();
});

// Scan for input element
const scanInterval = setInterval(() => {
  if (!inputElement) {
    inputElement = findElement(inputSelectors);
    if (inputElement) {
      console.log('[Perplexity] Found input element');
      ipcRenderer.send('input-ready');
      clearInterval(scanInterval);
    }
  }
}, 500);

setTimeout(() => clearInterval(scanInterval), 10000);
