/* ===========================================================
   Swastik Mini v2.4 — Stable Chat + Voice (Send fixed)
   =========================================================== */

const HISTORY_KEY = "swastik_mini_history_v2";
const HISTORY_LIMIT = 20;

let recognition = null;
let listening = false;
let isMuted = false;
let messages = [];
let audioCtx, analyser, micStream, dataArray, animId;

/* ---------- Waveform Animation ---------- */
async function startWaveform(coreEl) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const len = analyser.frequencyBinCount;
    dataArray = new Uint8Array(len);
    src.connect(analyser);

    function animate() {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < len; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / len);
      const scale = 1 + rms * 0.8;
      if (coreEl) coreEl.style.transform = `scale(${scale.toFixed(2)})`;
      animId = requestAnimationFrame(animate);
    }
    animate();
  } catch (err) {
    console.warn("Mic waveform error:", err);
  }
}

function stopWaveform(coreEl) {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  if (coreEl) coreEl.style.transform = "scale(1)";
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
}

/* ---------- Recognition ---------- */
function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "en-IN";
  rec.interimResults = false;
  rec.continuous = false;
  return rec;
}

function startRecognition(onResult, coreEl) {
  if (listening) return;
  recognition = createRecognition();
  if (!recognition) {
    console.warn("SpeechRecognition not supported.");
    return;
  }

  recognition.onstart = () => {
    listening = true;
    coreEl?.classList.add("listening");
    startWaveform(coreEl);
  };

  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript.trim();
    stopRecognition(coreEl);
    onResult(text);
  };

  recognition.onerror = (e) => {
    console.warn("Speech error:", e);
    stopRecognition(coreEl);
  };

  recognition.onend = () => {
    stopRecognition(coreEl);
  };

  try {
    recognition.start();
  } catch (err) {
    console.warn("Recognition start failed:", err);
  }
}

function stopRecognition(coreEl) {
  if (!listening) return;
  try {
    recognition?.stop();
  } catch (err) {
    console.warn("Recognition stop failed:", err);
  }
  listening = false;
  stopWaveform(coreEl);
  coreEl?.classList.remove("listening");
  recognition = null;
}

/* ---------- TTS ---------- */
function speak(text) {
  if (isMuted || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  let lang = /[अ-ह]/.test(text) ? "hi-IN" : "en-IN";
  utterance.lang = lang;
  utterance.rate = 1;
  utterance.pitch = 1;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang === lang);
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

/* ---------- Chat Core ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const chat = document.getElementById("chat");
  const msg = document.getElementById("msg");
  const sendBtn = document.getElementById("send");
  const micBtn = document.getElementById("mic");
  const themeToggle = document.getElementById("themeToggle");
  const muteToggle = document.getElementById("muteToggle");
  const voiceOnlyToggle = document.getElementById("voiceOnlyToggle");
  const swastikCore = document.getElementById("swastikCore");
  const assistantOverlay = document.getElementById("assistantOverlay");
  const assistantCore = document.querySelector(".assistant-core");
  const assistantClose = document.getElementById("assistantClose");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const chips = document.querySelectorAll(".chip");

  /* ---------- Chat Helpers ---------- */
  function addBubble(text, who = "bot", time = null) {
    const b = document.createElement("div");
    b.className = `bubble ${who}`;
    b.innerHTML = `<div class="typing-line">${text}</div><div class="meta">${time || new Date().toLocaleTimeString()}</div>`;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function addTypingSkeleton() {
    const b = document.createElement("div");
    b.className = "bubble bot typing";
    b.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
    return b;
  }

  /* ---------- Handle Message ---------- */
  async function handleUserMessage(text) {
    const t = text.trim();
    if (!t) return;

    messages.push({ role: "user", content: t, time: new Date().toLocaleTimeString() });
    addBubble(t, "user");
    msg.value = "";

    const typing = addTypingSkeleton();

    try {
      const res = await fetch("https://aimobile.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: t,
          history: messages.slice(-HISTORY_LIMIT)
        })
      });

      if (res.status === 401) throw new Error("401");
      const data = await res.json();
      typing.remove();

      const reply = data.reply || "Swastik couldn’t answer that right now.";
      messages.push({ role: "assistant", content: reply, time: new Date().toLocaleTimeString() });
      addBubble(reply, "bot");
      speak(reply);
    } catch (err) {
      typing.remove();
      if (err.message.includes("401")) addBubble("🛠️ Server closed. Try later.", "bot");
      else addBubble("⚠️ Network error.", "bot");
    }
  }

  /* ---------- Send Button + Enter ---------- */
  sendBtn?.addEventListener("click", () => {
    const v = msg.value.trim();
    if (v) handleUserMessage(v);
  });

  msg?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const v = msg.value.trim();
      if (v) handleUserMessage(v);
    }
  });

  /* ---------- Mic Hold ---------- */
  micBtn.addEventListener("mousedown", e => { e.preventDefault(); startRecognition(handleUserMessage, swastikCore); });
  micBtn.addEventListener("mouseup", e => { e.preventDefault(); stopRecognition(swastikCore); });
  micBtn.addEventListener("touchstart", e => { e.preventDefault(); startRecognition(handleUserMessage, swastikCore); });
  micBtn.addEventListener("touchend", e => { e.preventDefault(); stopRecognition(swastikCore); });

  /* ---------- Voice-only Orb ---------- */
  if (assistantCore) {
    const start = e => { e.preventDefault(); startRecognition(handleUserMessage, assistantCore); };
    const stop = e => { e.preventDefault(); stopRecognition(assistantCore); };
    ["mousedown", "touchstart"].forEach(ev => assistantCore.addEventListener(ev, start));
    ["mouseup", "mouseleave", "touchend"].forEach(ev => assistantCore.addEventListener(ev, stop));
  }

  /* ---------- Overlay ---------- */
  function openOverlay() {
    assistantOverlay?.classList.add("active");
    assistantOverlay?.setAttribute("aria-hidden", "false");
  }
  function closeOverlay() {
    assistantOverlay?.classList.remove("active");
    assistantOverlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("voice-only");
    stopRecognition(assistantCore);
  }

  swastikCore?.addEventListener("click", openOverlay);
  assistantClose?.addEventListener("click", closeOverlay);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeOverlay(); });

  /* ---------- Toggles ---------- */
  themeToggle?.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    themeToggle.textContent = dark ? "☀️" : "🌙";
  });

  muteToggle?.addEventListener("click", () => {
    isMuted = !isMuted;
    muteToggle.textContent = isMuted ? "🔇" : "🔊";
    if (isMuted) speechSynthesis.cancel();
  });

  voiceOnlyToggle?.addEventListener("click", () => {
    const active = document.body.classList.toggle("voice-only");
    if (active) openOverlay();
    else closeOverlay();
  });

  /* ---------- Clear History ---------- */
  clearHistoryBtn?.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    messages = [];
    chat.innerHTML = "";
    addBubble("🗑️ Chat history cleared!", "bot");
  });

  /* ---------- Quick Chips ---------- */
  chips.forEach(btn => {
    btn.addEventListener("click", () => handleUserMessage(btn.dataset.q || ""));
  });

  /* ---------- Greeting ---------- */
  if (messages.length === 0)
    addBubble("👋 Welcome to Swastik Mini — hold the mic or orb to talk.", "bot");
});

/* ---------- Typewriter ---------- */
function typeText(el, text, speed = 25) {
  return new Promise(resolve => {
    if (!el || !text) return resolve();
    el.textContent = "";
    let i = 0;
    const t = setInterval(() => {
      el.textContent += text[i++];
      el.scrollIntoView({ behavior: "smooth", block: "end" });
      if (i >= text.length) {
        clearInterval(t);
        resolve();
      }
    }, speed);
  });
}
