let routingReasonElement;
let progressMessageElement;
let authSuggestionElement;

function initialize() {
  routingReasonElement = document.getElementById('routing-reason');
  progressMessageElement = document.getElementById('progress-message');
  authSuggestionElement = document.getElementById('auth-suggestion');

  window.electronAPI.onUpdateLoadingReason((reason) => {
    if (routingReasonElement) {
      routingReasonElement.style.opacity = '0';
      setTimeout(() => {
        routingReasonElement.textContent = reason;
        routingReasonElement.style.opacity = '1';
      }, 150);
    }
  });

  window.electronAPI.onUpdateLoadingProgress((message) => {
    if (progressMessageElement) {
      progressMessageElement.style.opacity = '0';
      setTimeout(() => {
        progressMessageElement.textContent = message;
        progressMessageElement.style.opacity = '1';
      }, 150);
    }
  });

  window.electronAPI.onShowAuthSuggestion((visible) => {
    if (authSuggestionElement) {
      if (visible) {
        authSuggestionElement.classList.remove('hidden');
        authSuggestionElement.style.opacity = '0';
        setTimeout(() => {
          authSuggestionElement.style.opacity = '1';
        }, 50);
      } else {
        authSuggestionElement.style.opacity = '0';
        setTimeout(() => {
          authSuggestionElement.classList.add('hidden');
        }, 300);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initialize);
