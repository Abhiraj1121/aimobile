// static/script.js – Final Version (2025) – Clickable Links + Perfect Mobile UX
document.addEventListener('DOMContentLoaded', () => {
  // =================================================================
  // 1. MOBILE KEYBOARD + AUTO-SCROLL
  // =================================================================
  const chat = document.getElementById('chat');
  let initialHeight = window.innerHeight;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      chat.scrollTop = chat.scrollHeight;
    });
  };

  const observer = new MutationObserver(scrollToBottom);
  observer.observe(chat, { childList: true, subtree: true });

  // Adjust padding when keyboard opens
  window.visualViewport?.addEventListener('resize', () => {
    const diff = initialHeight - window.visualViewport.height;
    chat.style.paddingBottom = diff > 100 ? `${diff + 140}px` : '140px';
    scrollToBottom();
  });

  scrollToBottom();

  // =================================================================
  // 2. SWASTIK APP CORE – Enhanced with Clickable Links
  // =================================================================
  class SwastikApp {
    constructor() {
      this.messages = [];
      this.recognition = null;
      this.listening = false;
      this.isMuted = false;
      this.HISTORY_KEY = 'swastik_chat_history';
      this.HISTORY_LIMIT = 30;

      this.elements = this.getElements();
      this.loadHistory();
      this.initSpeech();
      this.bindEvents();
      this.addGreeting();
    }

    getElements() {
      return {
        chat: document.getElementById('chat'),
        input: document.getElementById('msg'),
        send: document.getElementById('send'),
        mic: document.getElementById('mic'),
        swastikCore: document.getElementById('swastikCore'),
        voiceStatus: document.getElementById('voiceStatus'),
        voiceCore: document.getElementById('voiceCore'),
        themeToggle: document.getElementById('themeToggle'),
        muteToggle: document.getElementById('muteToggle'),
        openMenu: document.getElementById('openMenu'),
        closeMenu: document.getElementById('closeMenu'),
        menuBackdrop: document.getElementById('menuBackdrop'),
        mobileMenu: document.getElementById('mobileMenu'),
        themeToggleMenu: document.getElementById('themeToggleMenu'),
        muteToggleMenu: document.getElementById('muteToggleMenu'),
        voiceOnlyToggleMenu: document.getElementById('voiceOnlyToggleMenu'),
        clearHistoryMenu: document.getElementById('clearHistoryMenu'),
        closeVoice: document.getElementById('closeVoice'),
        voiceOverlay: document.getElementById('voiceOverlay'),
        chips: document.querySelectorAll('.chip')
      };
    }

    // Auto-link URLs, phone numbers, and emails
    linkifyText(text) {
      if (!text) return text;

      // URLs (http, https)
      text = text.replace(
        /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      // Phone numbers (Indian +91 or plain 10-digit)
      text = text.replace(
        /(\+91[-\s]?[0-9]{5}[-\s]?[0-9]{5}|[0-9]{10})/g,
        '<a href="tel:$1">$1</a>'
      );

      // Email addresses
      text = text.replace(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        '<a href="mailto:$1">$1</a>'
      );

      return text;
    }

    bindEvents() {
      this.elements.send.addEventListener('click', () => this.send());
      this.elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.send();
        }
      });

      // Voice input (hold mic or orb)
      ['mousedown', 'touchstart'].forEach(ev =>
        this.elements.mic.addEventListener(ev, (e) => {
          e.preventDefault();
          this.startListening();
        })
      );
      ['mouseup', 'touchend', 'mouseleave'].forEach(ev =>
        this.elements.mic.addEventListener(ev, (e) => {
          e.preventDefault();
          this.stopListening();
        })
      );

      if (this.elements.voiceCore) {
        ['mousedown', 'touchstart'].forEach(ev =>
          this.elements.voiceCore.addEventListener(ev, (e) => {
            e.preventDefault();
            this.startListening(true);
          })
        );
        ['mouseup', 'touchend', 'mouseleave'].forEach(ev =>
          this.elements.voiceCore.addEventListener(ev, (e) => {
            e.preventDefault();
            this.stopListening();
          })
        );
      }

      // Menu & overlay controls
      this.elements.openMenu?.addEventListener('click', () => this.openMenu());
      this.elements.closeMenu?.addEventListener('click', () => this.closeMenu());
      this.elements.menuBackdrop?.addEventListener('click', () => this.closeMenu());
      this.elements.closeVoice?.addEventListener('click', () => this.closeVoiceOverlay());
      this.elements.swastikCore?.addEventListener('click', () => this.openVoiceOverlay());

      // Settings
      [this.elements.themeToggle, this.elements.themeToggleMenu].forEach(btn =>
        btn?.addEventListener('click', () => this.toggleTheme())
      );
      [this.elements.muteToggle, this.elements.muteToggleMenu].forEach(btn =>
        btn?.addEventListener('click', () => this.toggleMute())
      );
      this.elements.voiceOnlyToggleMenu?.addEventListener('click', () => this.toggleVoiceOverlay());
      this.elements.clearHistoryMenu?.addEventListener('click', () => this.clearHistory());

      // Quick questions
      this.elements.chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const q = chip.dataset.q;
          if (q) this.send(q);
          this.closeMenu();
        });
      });

      this.elements.input.focus();
    }

    async send(text = null) {
      const msg = (text || this.elements.input.value.trim());
      if (!msg) return;

      this.messages.push({ role: 'user', content: msg });
      this.addBubble(this.linkifyText(msg), 'user');
      this.elements.input.value = '';

      const typingBubble = this.addBubble('', 'bot');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            history: this.messages.slice(-this.HISTORY_LIMIT)
          })
        });
        const data = await res.json();

        typingBubble.remove();

        const reply = data.reply || "Sorry, I couldn't respond.";
        this.messages.push({ role: 'assistant', content: reply });
        this.addBubble(reply, 'bot'); // Now with linkify
        if (!this.isMuted) this.speak(reply);
      } catch (err) {
        typingBubble.remove();
        this.addBubble('Connection error. Please try again.', 'bot');
      }
      this.saveHistory();
    }

    // Enhanced bubble with clickable links
    addBubble(text, type) {
      const bubble = document.createElement('div');
      bubble.className = `bubble ${type}`;
      const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      if (type === 'bot' && text) {
        bubble.innerHTML = `
          <div class="typing-container">
            <span class="typing-text"></span>
            <span class="typing-cursor">|</span>
          </div>
          <div class="meta">${time}</div>
        `;
        this.elements.chat.appendChild(bubble);
        const typingText = bubble.querySelector('.typing-text');

        // Type first, then convert to clickable links
        this.typeReply(typingText, text, () => {
          typingText.innerHTML = this.linkifyText(text);
          scrollToBottom();
        });
      } else {
        const content = text ? this.linkifyText(text) : '';
        bubble.innerHTML = content
          ? `<div>${content}</div><div class="meta">${time}</div>`
          : `<div class="typing-container"><span class="typing-text"></span><span class="typing-cursor">|</span></div><div class="meta">${time}</div>`;
        this.elements.chat.appendChild(bubble);
        if (!text) scrollToBottom();
      }
      return bubble;
    }

    // Typing animation with callback when done
    typeReply(element, text, onComplete = null) {
      let i = 0;
      const cursor = element.parentNode.querySelector('.typing-cursor');
      cursor.style.animation = 'blink 1s step-end infinite';

      const type = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          scrollToBottom();
          setTimeout(type, 25 + Math.random() * 25);
        } else {
          cursor.style.display = 'none';
          if (onComplete) onComplete();
        }
      };
      setTimeout(type, 300);
    }

    speak(text) {
      if (this.isMuted || !('speechSynthesis' in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = /[अ-ह]/.test(text) ? 'hi-IN' : 'en-IN';
      utter.rate = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
    }

    // Speech Recognition (unchanged)
    initSpeech() {
      if (!('webkitSpeechRecognition' in window)) return;
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new Rec();
      this.recognition.lang = 'en-IN';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.listening = true;
        this.elements.mic?.classList.add('listening');
        this.elements.swastikCore?.classList.replace('idle', 'listening');
        this.elements.voiceCore?.classList.replace('idle', 'listening');
        this.elements.voiceStatus.textContent = 'Listening...';
      };

      this.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim();
        this.send(transcript);
      };

      this.recognition.onerror = this.recognition.onend = () => {
        this.stopListening();
      };
    }

    startListening(voiceMode = false) {
      if (this.listening || !this.recognition) return;
      if (voiceMode) this.openVoiceOverlay();
      this.recognition.start();
    }

    stopListening() {
      if (!this.listening) return;
      this.recognition?.stop();
      this.listening = false;
      this.elements.mic?.classList.remove('listening');
      this.elements.swa
stikCore?.classList.replace('listening', 'idle');
      this.elements.voiceCore?.classList.replace('listening', 'idle');
      this.elements.voiceStatus.textContent = 'Ready to chat';
    }

    openMenu() { this.elements.mobileMenu.classList.add('open'); this.elements.menuBackdrop.classList.add('active'); }
    closeMenu() { this.elements.mobileMenu.classList.remove('open'); this.elements.menuBackdrop.classList.remove('active'); }
    openVoiceOverlay() { this.elements.voiceOverlay.classList.add('active'); }
    closeVoiceOverlay() { this.elements.voiceOverlay.classList.remove('active'); this.stopListening(); }
    toggleVoiceOverlay() { this.elements.voiceOverlay.classList.contains('active') ? this.closeVoiceOverlay() : this.openVoiceOverlay(); }

    toggleTheme() {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      const icon = isLight
        ? `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
        : `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42"/></svg>`;
      const label = isLight ? 'Dark Mode' : 'Light Mode';
      [this.elements.themeToggle, this.elements.themeToggleMenu].forEach(el => {
        if (el) {
          el.innerHTML = `${icon} <span class="label">${label}</span>`;
          el.title = label;
        }
      });
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      const icon = this.isMuted
        ? `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M1 12h22"/></svg>`
        : `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      const label = this.isMuted ? 'Unmute' : 'Mute';
      [this.elements.muteToggle, this.elements.muteToggleMenu].forEach(el => {
        if (el) {
          el.innerHTML = `${icon} <span class="label">${label}</span>`;
          el.title = label;
        }
      });
      if (this.isMuted) speechSynthesis.cancel();
    }

    clearHistory() {
      this.messages = [];
      this.elements.chat.innerHTML = '';
      this.addBubble('Chat cleared!', 'bot');
      localStorage.removeItem(this.HISTORY_KEY);
      this.closeMenu();
    }

    saveHistory() {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.messages.slice(-this.HISTORY_LIMIT)));
    }

    loadHistory() {
      try {
        const saved = localStorage.getItem(this.HISTORY_KEY);
        if (saved) {
          this.messages = JSON.parse(saved);
          this.messages.forEach(m => this.addBubble(m.content, m.role === 'assistant' ? 'bot' : 'user'));
        }
      } catch (e) {
        console.error('History load failed', e);
      }
    }

    addGreeting() {
      if (this.messages.length === 0) {
        this.addBubble('Hi! I am Swastik. Hold mic or tap orb to talk. Or type below!', 'bot');
      }
    }
  }

  // =================================================================
  // 3. LAUNCH SWASTIK
  // =================================================================
  new SwastikApp();
});
