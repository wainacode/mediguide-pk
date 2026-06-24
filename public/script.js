/**
 * MediGuide Pakistan - Client-Side (Frontend) JavaScript
 * 
 * This file runs directly in the user's web browser. It:
 * 1. Manages user interactions (clicking buttons, typing messages, hitting Enter).
 * 2. Formats messages into chat bubbles (User vs. AI).
 * 3. Automatically detects Urdu Script input to apply RTL (Right-to-Left) layout.
 * 4. Communicates with our Express.js backend server (/api/chat) using async HTTP requests.
 * 5. Manages loading states, scroll behavior, and error displays.
 */

document.addEventListener('DOMContentLoaded', () => {
  // === DOM ELEMENTS ===
  // We fetch references to the HTML elements so JavaScript can update them.
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
  // Stores the conversation history so Gemini knows the context of previous questions.
  // Format: [ { role: 'user', text: '...' }, { role: 'model', text: '...' } ]
  let history = []; 
  
  // Guard flag to prevent the user from sending a new message while the AI is responding.
  let isGenerating = false;

  // === SUGGESTION CHIPS ===
  // Common preset medication questions in Pakistan representing English, Urdu, and Roman Urdu inputs.
  const suggestions = [
    { label: '💊 Panadol Dosage', query: 'Panadol aur Calpol ka dosage guidelines kya hain?' },
    { label: '🧪 Flagyl Uses', query: 'Flagyl kis bimari ke liye aur kis tarah istemal hoti hai?' },
    { label: '⚠️ Brufen & Aspirin', query: 'Can I take Brufen and Aspirin together? Kya inka koi interaction hai?' },
    { label: '🧬 Risek Timing', query: 'Risek capsule kab aur kaise khana chahiye? Khaali pet ya khaane ke baad?' },
    { label: '🦷 Ponstan Usage', query: 'Ponstan goli toothache ya dard ke liye kaise lein?' },
    { label: '🦠 Augmentin Side Effects', query: 'Augmentin antibiotic ke kya side effects hain aur isay kab lena chahiye?' }
  ];

  // === MARKDOWN CONFIGURATION ===
  // Gemini responds using markdown (like bolding and bullet lists). 
  // Marked.js converts this formatting into plain HTML.
  marked.setOptions({
    gfm: true,        // Enable GitHub Flavored Markdown
    breaks: true,     // Convert single line breaks in text into <br> tags
    headerIds: false, // Turn off auto-ID generation for headers
    mangle: false     // Turn off code email obfuscation
  });

  // === DETECT URDU SCRIPT ===
  // Checks if the text contains Arabic/Persian/Urdu script character ranges.
  // This is used to automatically switch text alignment to Right-to-Left (RTL) for Urdu.
  function isUrduText(text) {
    const urduRegex = /[\u0600-\u06FF]/;
    return urduRegex.test(text);
  }

  // === INITIALIZE SUGGESTION CHIPS ===
  // Renders the quick-click buttons on the welcome page and inside the bottom sticky tray.
  function initSuggestions() {
    suggestions.forEach(item => {
      // Welcome Page Layout Chips
      const welcomeChip = createChipElement(item);
      welcomeChips.appendChild(welcomeChip);

      // Bottom Bar Horizontal-scroll Chips (visible during chat)
      const miniChip = createChipElement(item);
      miniChips.appendChild(miniChip);
    });
  }

  // Helper function to build a chip button element dynamically
  function createChipElement(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = item.label;
    
    // Trigger sending the message when the chip is clicked
    button.addEventListener('click', () => {
      if (isGenerating) return;
      handleSendMessage(item.query);
    });
    return button;
  }

  // === GET LOCAL TIMESTAMP ===
  // Returns current local time formatted like "12:05 PM"
  function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // === CREATE & APPEND MESSAGE BUBBLE ===
  // Generates bubble elements in the conversation workspace.
  function appendMessageBubble(role, content, isMarkdown = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    // Auto-detect Urdu script to apply RTL styling
    if (isUrduText(content)) {
      bubble.classList.add('urdu-message');
    }

    // Render text with markdown parse or plain text fallback
    if (isMarkdown) {
      bubble.innerHTML = marked.parse(content);
    } else {
      const p = document.createElement('p');
      p.textContent = content;
      bubble.appendChild(p);
    }

    // Attach timestamp
    const meta = document.createElement('span');
    meta.className = 'bubble-meta';
    meta.textContent = getFormattedTime();
    bubble.appendChild(meta);

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    
    // Smooth scroll down to reveal the latest message bubble
    scrollToBottom();
  }

  // === AUTO-SCROLL ===
  // Forces the chat body container to scroll down to the bottom
  function scrollToBottom() {
    chatWorkspace.scrollTo({
      top: chatWorkspace.scrollHeight,
      behavior: 'smooth'
    });
  }

  // === CORE DISPATCH FUNCTION ===
  // Dispatches network payload to Express and controls UI loading sequences.
  async function handleSendMessage(messageText) {
    if (!messageText || isGenerating) return;

    // 1. Lock state and clear input field
    isGenerating = true;
    userInput.value = '';
    toggleControls(true);

    // 2. Hide welcome card and show active chat viewport on first message
    if (welcomeScreen.style.display !== 'none') {
      welcomeScreen.classList.add('hidden');
      welcomeScreen.style.display = 'none';
      chatMessages.classList.remove('hidden');
      miniChipsContainer.classList.remove('hidden');
    }

    // 3. Render user's question bubble
    appendMessageBubble('user', messageText, false);

    // Take a snapshot of the current history *before* we push the new question
    const historySnapshot = [...history];

    // Push user message to local history track
    history.push({ role: 'user', text: messageText });

    // 4. Show typing loader animation
    typingIndicator.classList.remove('hidden');
    scrollToBottom();

    try {
      // 5. Send POST request to backend Express port
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
      
      // Remove loading state as soon as backend responds
      typingIndicator.classList.add('hidden');

      if (response.ok && data.text) {
        // 6. Render AI response bubble
        appendMessageBubble('ai', data.text, true);
        
        // Add AI response to local history track
        history.push({ role: 'model', text: data.text });
      } else {
        // Handle server-side API key configuration or limits errors
        const errorMsg = data.error || 'Server encountered an unexpected error.';
        appendMessageBubble(
          'ai', 
          `⚠️ **Error:** ${errorMsg}\n\n*Please verify that your GEMINI_API_KEY environment variable is set and restart the server.*`, 
          true
        );
      }
    } catch (err) {
      console.error('Frontend Fetch Error:', err);
      typingIndicator.classList.add('hidden');
      
      // Render offline connection failure bubble
      appendMessageBubble(
        'ai', 
        '⚠️ **Connection Failed:** Could not connect to the MediGuide server.\n\n*Make sure the local server is running (run `npm start` in terminal) or verify network connectivity.*', 
        true
      );
    } finally {
      // 7. Release locks and re-focus input
      isGenerating = false;
      toggleControls(false);
      userInput.focus();
    }
  }

  // === TOGGLE CONTROLS STATE ===
  // Disables/enables forms and buttons during API generation to prevent double-submits
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
  // Form submission (clicks the send icon)
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Stop page reload
    const message = userInput.value.trim();
    if (message) {
      handleSendMessage(message);
    }
  });

  // Enter key listener on input box
  userInput.addEventListener('keydown', (e) => {
    // If Enter key is pressed alone (no Shift modifier), trigger form submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Initialize Suggestion Chips
  initSuggestions();
});
