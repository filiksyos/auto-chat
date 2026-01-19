// Get DOM elements
const messageInput = document.getElementById('message-input');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySection = document.getElementById('api-key-section');
const loadingIndicator = document.getElementById('loading-indicator');

// Check if API key exists on page load
async function initializePage() {
    try {
        const result = await window.electronAPI.checkApiKey();

        if (result && result.exists) {
            // API key exists, hide the API key section
            apiKeySection.classList.add('hidden');
        } else {
            // No API key, show the section
            apiKeySection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        // On error, show API key section to be safe
        apiKeySection.classList.remove('hidden');
    }

    // Focus message input
    messageInput.focus();
}

// Handle message submission
async function handleMessageSubmit() {
    const message = messageInput.value.trim();

    // Return early if message is empty
    if (!message) {
        return;
    }

    // Disable input while processing
    messageInput.disabled = true;

    try {
        // Save API key if provided
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            const saveResult = await window.electronAPI.saveApiKey(apiKey);

            if (saveResult && saveResult.success) {
                // Hide API key section after successful save
                apiKeySection.classList.add('hidden');
                apiKeyInput.value = '';
            }
        }

        // Route the message (loading page is shown by main process)
        await window.electronAPI.routeMessage(message);

        // Clear message input after successful submission
        messageInput.value = '';

    } catch (error) {
        console.error('Error submitting message:', error);
        alert('Failed to process your message. Please try again.');
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        messageInput.focus();
    }
}

// Handle Enter key in message input (Ctrl+Enter for newline)
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault();
        handleMessageSubmit();
    }
});

// Initialize page on load
document.addEventListener('DOMContentLoaded', initializePage);
