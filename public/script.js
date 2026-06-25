/**
 * MediGuide Pakistan - Client-Side (Frontend) JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // === DOM ELEMENTS ===
  const welcomeScreen = document.getElementById('welcome-screen');
  const chatMessages = document.getElementById('chat-messages');
  const typingIndicator = document.getElementById('typing-indicator');
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const welcomeChips = document.getElementById('welcome-chips');
  const miniChipsContainer = document.getElementById('mini-chips-container');
  const miniChips = document.getElementById('mini-chips');
  const chatWorkspace = document.querySelector('.chat-workspace');

  // === APPLICATION STATE ===
  let history = [];
  let isGenerating = false;
  const STORAGE_KEY = 'mediguide_chat_history';

  // === SUGGESTION CHIPS ===
  const suggestions = [
    { label: 'Panadol Dosage', query: 'Panadol aur Calpol ka dosage guidelines kya hain?' },
    { label: 'Flagyl Uses', query: 'Flagyl kis bimari ke liye aur kis tarah istemal hoti hai?' },
    { label: 'Brufen & Aspirin', query: 'Can I take Brufen and Aspirin together? Kya inka koi interaction hai?' },
    { label: 'Risek Timing', query: 'Risek capsule kab aur kaise khana chahiye? Khaali pet ya khaane ke baad?' },
    { label: 'Ponstan Usage', query: 'Ponstan goli toothache ya dard ke liye kaise lein?' },
    { label: 'Augmentin Side Effects', query: 'Augmentin antibiotic ke kya side effects hain aur isay kab lena chahiye?' }
  ];

  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
  });

  function isUrduText(text) {
    const urduRegex = /[\u0600-\u06FF]/;
    return urduRegex.test(text);
  }

  function initSuggestions() {
    suggestions.forEach(item => {
      const welcomeChip = createChipElement(item);
      welcomeChips.appendChild(welcomeChip);

      const miniChip = createChipElement(item);
      miniChips.appendChild(miniChip);
    });
  }

  function createChipElement(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = item.label;

    button.addEventListener('click', () => {
      if (isGenerating) return;
      handleSendMessage(item.query);
    });
    return button;
  }

  function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // === CREATE & APPEND MESSAGE BUBBLE ===
  function appendMessageBubble(role, content, isMarkdown = false, timeOverride = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (isUrduText(content)) {
      bubble.classList.add('urdu-message');
    }

    if (isMarkdown) {
      bubble.innerHTML = marked.parse(content);
    } else {
      const p = document.createElement('p');
      p.textContent = content;
      bubble.appendChild(p);
    }

    const meta = document.createElement('span');
    meta.className = 'bubble-meta';
    meta.textContent = timeOverride || getFormattedTime();
    bubble.appendChild(meta);

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);

    scrollToBottom();
  }

  function scrollToBottom() {
    chatWorkspace.scrollTo({
      top: chatWorkspace.scrollHeight,
      behavior: 'smooth'
    });
  }

  // === SAVE CHAT HISTORY TO BROWSER STORAGE ===
  function saveHistoryToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('Could not save chat history:', err);
    }
  }

  // === RESTORE CHAT HISTORY FROM BROWSER STORAGE ===
  function restoreHistoryFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const savedHistory = JSON.parse(saved);
      if (!Array.isArray(savedHistory) || savedHistory.length === 0) return;

      history = savedHistory;

      welcomeScreen.classList.add('hidden');
      welcomeScreen.style.display = 'none';
      chatMessages.classList.remove('hidden');
      miniChipsContainer.classList.remove('hidden');

      savedHistory.forEach(item => {
        const role = item.role === 'user' ? 'user' : 'ai';
        const isMarkdown = item.role !== 'user';
        appendMessageBubble(role, item.text, isMarkdown, item.time);
      });
    } catch (err) {
      console.warn('Could not restore chat history:', err);
    }
  }

  // === CORE DISPATCH FUNCTION ===
  async function handleSendMessage(messageText) {
    if (!messageText || isGenerating) return;

    isGenerating = true;
    userInput.value = '';
    toggleControls(true);

    if (welcomeScreen.style.display !== 'none') {
      welcomeScreen.classList.add('hidden');
      welcomeScreen.style.display = 'none';
      chatMessages.classList.remove('hidden');
      miniChipsContainer.classList.remove('hidden');
    }

    appendMessageBubble('user', messageText, false);

    const historySnapshot = [...history];

    history.push({ role: 'user', text: messageText, time: getFormattedTime() });
    saveHistoryToStorage();

    typingIndicator.classList.remove('hidden');
    scrollToBottom();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText,
          history: historySnapshot
        })
      });

      const data = await response.json();

      typingIndicator.classList.add('hidden');

      if (response.ok && data.text) {
        appendMessageBubble('ai', data.text, true);

        history.push({ role: 'model', text: data.text, time: getFormattedTime() });
        saveHistoryToStorage();
      } else {
        const errorMsg = data.error || 'Server encountered an unexpected error.';
        appendMessageBubble(
          'ai',
          `⚠️ **Error:** ${errorMsg}`,
          true
        );
      }
    } catch (err) {
      console.error('Frontend Fetch Error:', err);
      typingIndicator.classList.add('hidden');

      appendMessageBubble(
        'ai',
        '⚠️ **Connection Failed:** Could not connect to the MediGuide server.\n\n*Make sure the local server is running (run `npm start` in terminal) or verify network connectivity.*',
        true
      );
    } finally {
      isGenerating = false;
      toggleControls(false);
      userInput.focus();
    }
  }

  function toggleControls(disabled) {
    userInput.disabled = disabled;
    sendBtn.disabled = disabled;

    const allChips = document.querySelectorAll('.chip');
    allChips.forEach(chip => {
      chip.disabled = disabled;
      if (disabled) {
        chip.style.opacity = '0.5';
        chip.style.cursor = 'not-allowed';
      } else {
        chip.style.opacity = '1';
        chip.style.cursor = 'pointer';
      }
    });
  }

  // === EVENT LISTENERS ===
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message) {
      handleSendMessage(message);
    }
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Initialize Suggestion Chips
  initSuggestions();

  // Restore any previously saved conversation for this browser/device
  restoreHistoryFromStorage();

  // === NEW CHAT BUTTON ===
  const newChatBtn = document.getElementById('new-chat-btn');
  newChatBtn.addEventListener('click', () => {
    if (isGenerating) return;
    const confirmed = confirm('Start a new chat? This will clear your current conversation history on this device.');
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    history = [];
    chatMessages.innerHTML = '';
    chatMessages.classList.add('hidden');
    miniChipsContainer.classList.add('hidden');
    welcomeScreen.style.display = '';
    welcomeScreen.classList.remove('hidden');
  });
});
