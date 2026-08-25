const DEFAULT_SETTINGS = {
  rate: 1,
  pitch: 1,
  volume: 1,
  preferredFaVoice: "",
  preferredEnVoice: "",
  useLocalHelper: true,
  helperUrl: "http://127.0.0.1:8765",
  localFaModel: "gyro"
};

const extensionApi = globalThis.browser || globalThis.chrome;
let localAudio = null;

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "READ_TEXT") {
    readText(message.text, message.settings).then(sendResponse);
    return true;
  }

  if (message.type === "READ_SELECTION") {
    readText(getSelectedText(), message.settings).then(sendResponse);
    return true;
  }

  if (message.type === "STOP_READING") {
    stopLocalAudio();
    speechSynthesis.cancel();
    sendResponse({ ok: true });
  }

  if (message.type === "PAUSE_READING") {
    if (localAudio) localAudio.pause();
    speechSynthesis.pause();
    sendResponse({ ok: true });
  }

  if (message.type === "RESUME_READING") {
    if (localAudio) localAudio.play().catch(() => {});
    speechSynthesis.resume();
    sendResponse({ ok: true });
  }

  return true;
});

async function readText(rawText, messageSettings = {}) {
  const text = normalizeText(rawText || getSelectedText());
  if (!text) return { ok: false, error: "NO_TEXT" };

  const settings = { ...(await loadSettings()), ...messageSettings };
  const localResult = await tryLocalTts(text, settings);
  if (localResult?.ok) return localResult;

  const lang = detectLanguage(text);
  const voice = await pickVoice(lang, settings);
  if (lang === "fa-IR" && !voice) {
    showReaderNotice("صدای فارسی یا نزدیک به فارسی در Firefox پیدا نشد. از تنظیمات سیستم یک Persian/Farsi voice نصب کنید.");
    return { ok: false, error: "NO_FA_VOICE", lang };
  }

  speechSynthesis.cancel();
  const chunks = splitText(text);
  for (const chunk of chunks) {
    const result = await speakChunk(chunk, lang, voice, settings);
    if (!result.ok) return result;
  }

  return { ok: true, lang, voice: voice?.name || "" };
}

function getSelectedText() {
  const active = document.activeElement;
  if (active && ["TEXTAREA", "INPUT"].includes(active.tagName)) {
    return active.value.slice(active.selectionStart || 0, active.selectionEnd || 0);
  }

  return window.getSelection()?.toString() || "";
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function tryLocalTts(text, settings) {
  if (!settings.useLocalHelper) return null;

  try {
    const response = await fetch(`${settings.helperUrl.replace(/\/$/, "")}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model: settings.localFaModel || DEFAULT_SETTINGS.localFaModel,
        rate: Number(settings.rate) || DEFAULT_SETTINGS.rate
      })
    });

    if (!response.ok) return { ok: false, error: "LOCAL_TTS_ERROR" };

    const audioBlob = await response.blob();
    stopLocalAudio();
    localAudio = new Audio(URL.createObjectURL(audioBlob));
    localAudio.volume = Number(settings.volume) || DEFAULT_SETTINGS.volume;
    await localAudio.play();
    return { ok: true, engine: "local-helper" };
  } catch {
    return null;
  }
}

function stopLocalAudio() {
  if (!localAudio) return;
  localAudio.pause();
  URL.revokeObjectURL(localAudio.src);
  localAudio = null;
}

function detectLanguage(text) {
  const persianChars = text.match(/[\u0600-\u06FF]/g)?.length || 0;
  return persianChars > 0 ? "fa-IR" : "en-US";
}

async function loadSettings() {
  return new Promise((resolve) => {
    const maybePromise = extensionApi.storage.sync.get(DEFAULT_SETTINGS, resolve);
    if (maybePromise?.then) maybePromise.then(resolve);
  });
}

async function pickVoice(lang, settings) {
  const voices = await getVoices();
  const preferredName = lang.startsWith("fa") ? settings.preferredFaVoice : settings.preferredEnVoice;
  const preferred = voices.find((voice) => voice.name === preferredName);
  if (preferred) return preferred;

  const exact = voices.find((voice) => voice.lang?.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;

  const family = voices.find((voice) => voice.lang?.toLowerCase().startsWith(lang.slice(0, 2)));
  if (family) return family;

  if (lang.startsWith("fa")) {
    return voices.find((voice) => {
      const voiceLang = voice.lang?.toLowerCase() || "";
      const voiceName = voice.name?.toLowerCase() || "";
      return voiceLang.startsWith("ar") ||
        voiceLang.startsWith("ur") ||
        voiceName.includes("arabic") ||
        voiceName.includes("urdu") ||
        voiceName.includes("persian") ||
        voiceName.includes("farsi");
    }) || null;
  }

  return null;
}

function getVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }

    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
  });
}

function splitText(text) {
  const chunks = [];
  const sentences = text.match(/[^.!?؟。]+[.!?؟。]*/g) || [text];
  let current = "";

  sentences.forEach((sentence) => {
    if ((current + sentence).length > 180 && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${sentence} `;
  });

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function speakChunk(text, lang, voice, settings) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = Number(settings.rate) || DEFAULT_SETTINGS.rate;
    utterance.pitch = Number(settings.pitch) || DEFAULT_SETTINGS.pitch;
    utterance.volume = Number(settings.volume) || DEFAULT_SETTINGS.volume;
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve({ ok: true });
    utterance.onerror = (event) => {
      const error = event.error || "SPEECH_ERROR";
      if (lang === "fa-IR") showReaderNotice("Firefox نتوانست متن فارسی را بخواند. صدای فارسی نصب/فعال نیست.");
      resolve({ ok: false, error, lang, voice: voice?.name || "" });
    };

    speechSynthesis.speak(utterance);
  });
}

function showReaderNotice(text) {
  const existing = document.getElementById("selected-text-reader-notice");
  if (existing) existing.remove();

  const notice = document.createElement("div");
  notice.id = "selected-text-reader-notice";
  notice.textContent = text;
  notice.setAttribute("dir", "rtl");
  Object.assign(notice.style, {
    position: "fixed",
    zIndex: "2147483647",
    left: "16px",
    bottom: "16px",
    maxWidth: "360px",
    padding: "12px 14px",
    borderRadius: "8px",
    color: "#fff",
    background: "#b91c1c",
    font: "13px Tahoma, Arial, sans-serif",
    lineHeight: "1.7",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)"
  });
  document.documentElement.appendChild(notice);
  setTimeout(() => notice.remove(), 6000);
}
