const MENU_ID = "read-selected-text";
const DEFAULT_SETTINGS = {
  rate: 1,
  pitch: 1,
  volume: 1,
  preferredFaVoice: "",
  preferredEnVoice: "",
  useLocalHelper: true,
  helperUrl: "http://127.0.0.1:8765"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Read selected text",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    sendToTab(tab.id, { type: "READ_TEXT", text: info.selectionText || "" });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TTS_SPEAK") {
    speakText(message.text || "").then(sendResponse);
    return true;
  }

  if (message.type === "TTS_STOP") {
    chrome.tts.stop();
    sendResponse({ ok: true });
  }

  if (message.type === "TTS_GET_VOICES") {
    chrome.tts.getVoices((voices) => sendResponse({ ok: true, voices }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === "read-selection") {
    sendToTab(tab.id, { type: "READ_SELECTION" });
  }

  if (command === "stop-reading") {
    chrome.tts.stop();
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    chrome.scripting?.executeScript({
      target: { tabId },
      files: ["content.js"]
    }).then(() => chrome.tabs.sendMessage(tabId, message));
  });
}

async function speakText(rawText) {
  const text = normalizeText(rawText);
  if (!text) return { ok: false, error: "NO_TEXT" };

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const lang = detectLanguage(text);
  const voice = await pickVoice(lang, settings);

  chrome.tts.stop();

  return new Promise((resolve) => {
    chrome.tts.speak(text, {
      lang,
      voiceName: voice?.voiceName,
      rate: Number(settings.rate) || DEFAULT_SETTINGS.rate,
      pitch: Number(settings.pitch) || DEFAULT_SETTINGS.pitch,
      volume: Number(settings.volume) || DEFAULT_SETTINGS.volume,
      onEvent: (event) => {
        if (event.type === "error") {
          resolve({ ok: false, error: event.errorMessage || "TTS_ERROR", lang, voice: voice?.voiceName || "" });
        }

        if (event.type === "start" || event.type === "end" || event.type === "interrupted" || event.type === "cancelled") {
          resolve({ ok: true, lang, voice: voice?.voiceName || "" });
        }
      }
    }, () => {
      const message = chrome.runtime.lastError?.message;
      if (message) resolve({ ok: false, error: message, lang, voice: voice?.voiceName || "" });
    });
  });
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function detectLanguage(text) {
  const persianChars = text.match(/[\u0600-\u06FF]/g)?.length || 0;
  return persianChars > 0 ? "fa-IR" : "en-US";
}

function pickVoice(lang, settings) {
  return new Promise((resolve) => {
    chrome.tts.getVoices((voices) => {
      const preferredName = lang.startsWith("fa") ? settings.preferredFaVoice : settings.preferredEnVoice;
      const preferred = voices.find((voice) => voice.voiceName === preferredName);
      if (preferred) {
        resolve(preferred);
        return;
      }

      const exact = voices.find((voice) => voice.lang?.toLowerCase() === lang.toLowerCase());
      if (exact) {
        resolve(exact);
        return;
      }

      resolve(voices.find((voice) => voice.lang?.toLowerCase().startsWith(lang.slice(0, 2))) || null);
    });
  });
}
