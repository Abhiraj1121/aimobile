// static/script.js (Complete Mobile Rewrite • Clean & Modular)
class SwastikApp {
  constructor() {
    this.messages = [];
    this.recognition = null;
    this.listening = false;
    this.isMuted = false;
    this.HISTORY_KEY = 'swastik_mobile_history_v2';
    this.HISTORY_LIMIT = 20;

    this.elements = {};
    this.initElements();
    this.loadHistory();
    this.initRecognition();
    this.bindEvents();
    this.addGreeting();
    this.handleKeyboard();
  }

  initElements() {
    const ids = [
      'chat', 'msg', 'send', 'mic', 'swastikCore', 'voiceStatus',
      'themeToggle', 'muteToggle', 'openMenu', 'closeMenu', 'menuBackdrop',
      'voiceOverlay', 'voiceCore', 'closeVoice', 'clearHistoryMenu',
      'themeToggleMenu', 'muteToggleMenu', 'voiceOnlyToggleMenu'
    ];
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    this.elements.chips = document.querySelectorAll('.chip');
  }

  bindEvents() {
    // Send
    this.elements.send.addEventListener('click', () => this.sendMessage());
    this.elements.msg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Mic Hold (Touch/Mouse)
    const micEvents = {
      start: ['mousedown', 'touchstart'],
      end: ['mouseup', 'touchend', 'mouseleave']
    };
    micEvents.start.forEach(ev => this.elements.mic.addEventListener(ev, (e) => {
      e.preventDefault();
      this.startListening();
    }));
    micEvents.end.forEach(ev => this.elements.mic.addEventListener(ev, (e) => {
      e.preventDefault();
      this.stopListening();
    }));

    // Voice Core Hold
    const voiceCore = this.elements.voiceCore;
    if (voiceCore) {
      micEvents.start.forEach(ev => voiceCore.addEventListener(ev, (e) => {
        e.preventDefault();
        this.startListening(true);
      }));
      micEvents.end.forEach(ev => voiceCore.addEventListener(ev, (e) => {
        e.preventDefault();
        this.stopListening();
      }));
    }

    // Menu
    this.elements.openMenu.addEventListener('click', () => this.openMenu());
    this.elements.closeMenu.addEventListener('click', () => this.closeMenu());
    this.elements.menuBackdrop.addEventListener('click', () => this.closeMenu());
    this.elements.closeVoice.addEventListener('click', () => this.closeVoiceOverlay());

    // Swastik Core → Voice Overlay
    this.elements.swastikCore.addEventListener('click', () => this.openVoiceOverlay());

    // Toggles (Topbar + Menu)
    ['themeToggle', 'themeToggleMenu'].forEach(id => {
      const el = this.elements[id];
      if (el) el.addEventListener('click', () => this.toggleTheme());
    });
    ['muteToggle', 'muteToggleMenu'].forEach(id => {
      const el = this.elements[id];
      if (el) el.addEventListener('click', () => this.toggleMute());
    });
    ['voiceOnlyToggleMenu'].forEach(id => {
      const el = this.elements[id];
      if (el) el.addEventListener('click', () => this.toggleVoiceOverlay());
    });

    // Clear History
    const clearBtns = [this.elements.clearHistoryMenu];
    clearBtns.forEach(btn => btn?.addEventListener('click', () => this.clearHistory()));

    // Chips
    this.elements.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.q;
        if (q) {
          this.sendMessage(q);
          this.closeMenu();
        }
      });
    });

    // Auto-focus input
    this.elements.msg.focus();
  }

  async sendMessage(text = null) {
    const msg = text || this.elements.msg.value.trim();
    if (!msg) return;

    this.messages.push({ role: 'user', content: msg });
    this.addBubble(msg, 'user');
    this.elements.msg.value = '';

    const typingEl = this.addTypingBubble();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: this.messages.slice(-this.HISTORY_LIMIT) })
      });
      const data = await res.json();
      typingEl.remove();

      const reply = data.reply || 'Sorry, I couldn\'t process that.';
      this.messages.push({ role: 'assistant', content: reply });
      this.addBubble(reply, 'bot');
      if (!this.isMuted) this.speak(reply);
    } catch (err) {
      typingEl.remove();
      this.addBubble('⚠️ Connection error. Try again!', 'bot');
    }
    this.saveHistory();
    this.scrollToBottom();
  }

  addBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${type}`;
    bubble.innerHTML = `
      <div>${text}</div>
      <div class="meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    this.elements.chat.appendChild(bubble);
    this.scrollToBottom();
  }

  addTypingBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble bot typing';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    this.elements.chat.appendChild(bubble);
    this.scrollToBottom();
    return bubble;
  }

  speak(text) {
    if (this.isMuted || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[अ-ह]/.test(text) ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  initRecognition() {
    if (!('webkitSpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-IN';
    this.recognition.interimResults = false;
    this.recognition.continuous = false;

    this.recognition.onstart = () => {
      this.listening = true;
      this.elements.mic?.classList.add('listening');
      this.elements.swastikCore?.classList.add('listening', 'active');
      this.elements.voiceCore?.classList.add('listening');
      this.elements.voiceStatus.textContent = 'Listening...';
    };

    this.recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      this.sendMessage(transcript);
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
    this.elements.swastikCore?.classList.remove('listening', 'active');
    this.elements.voiceCore?.classList.remove('listening');
    this.elements.voiceStatus.textContent = 'Ready to chat';
  }

  openMenu() {
    document.getElementById('mobileMenu').classList.add('open');
    document.getElementById('menuBackdrop').classList.add('active');
  }

  closeMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
    document.getElementById('menuBackdrop').classList.remove('active');
  }

  openVoiceOverlay() {
    document.getElementById('voiceOverlay').classList.add('active');
  }

  closeVoiceOverlay() {
    document.getElementById('voiceOverlay').classList.remove('active');
    this.stopListening();
  }

  toggleVoiceOverlay() {
    if (document.getElementById('voiceOverlay').classList.contains('active')) {
      this.closeVoiceOverlay();
    } else {
      this.openVoiceOverlay();
    }
  }

  toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    document.querySelectorAll('#themeToggle, #themeToggleMenu').forEach(el => {
      el.textContent = isLight ? '🌙' : '☀️';
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    document.querySelectorAll('#muteToggle, #muteToggleMenu').forEach(el => {
      el.textContent = this.isMuted ? '🔇' : '🔊';
    });
    if (this.isMuted) speechSynthesis.cancel();
  }

  clearHistory() {
    this.messages = [];
    this.elements.chat.innerHTML = '';
    this.addBubble('🗑️ Chat cleared! Start fresh.', 'bot');
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
        this.messages.forEach(msg => this.addBubble(msg.content, msg.role));
      }
    } catch {}
  }

  addGreeting() {
    if (this.messages.length === 0) {
      this.addBubble('👋 Hi! Hold the mic or tap the orb to talk about school. Or type below!', 'bot');
    }
  }

  scrollToBottom() {
    this.elements.chat.scrollTop = this.elements.chat.scrollHeight;
  }

  handleKeyboard() {
    let initialHeight = window.innerHeight;
    window.visualViewport?.addEventListener('resize', () => {
      const vh = window.visualViewport.height;
      if (vh < initialHeight * 0.9) {
        this.scrollToBottom();
      }
    });
    window.addEventListener('resize', () => this.scrollToBottom());
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => new SwastikApp());