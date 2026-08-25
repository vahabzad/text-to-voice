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
    readText(message.text, message.settings);
    sendResponse({ ok: true });
  }

  if (message.type === "READ_SELECTION") {
    readText(getSelectedText(), message.settings);
    sendResponse({ ok: true });
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
  if (!text) return;

  const settings = { ...(await loadSettings()), ...messageSettings };
  const localResult = await tryLocalTts(text, settings);
  if (localResult?.ok) {
    return;
  }

  const ttsResult = await tryBackgroundTts(text);
  if (ttsResult?.ok) {
    return;
  }

  const lang = detectLanguage(text);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = Number(settings.rate) || DEFAULT_SETTINGS.rate;
  utterance.pitch = Number(settings.pitch) || DEFAULT_SETTINGS.pitch;
  utterance.volume = Number(settings.volume) || DEFAULT_SETTINGS.volume;

  const voice = await pickVoice(lang, settings);
  if (voice) utterance.voice = voice;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

async function tryBackgroundTts(text) {
  try {
    return await extensionApi.runtime.sendMessage({ type: "TTS_SPEAK", text });
  } catch {
    return null;
  }
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
  return family || null;
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
