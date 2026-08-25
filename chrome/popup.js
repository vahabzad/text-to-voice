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

const LOCAL_FA_MODELS = [
  ["gyro", "Gyro"],
  ["amir", "Amir"],
  ["ganji", "Ganji"],
  ["ganji_adabi", "Ganji Adabi"],
  ["reza_ibrahim", "Reza Ibrahim"]
];

const extensionApi = globalThis.browser || globalThis.chrome;

const elements = {
  read: document.getElementById("read"),
  pause: document.getElementById("pause"),
  resume: document.getElementById("resume"),
  stop: document.getElementById("stop"),
  rate: document.getElementById("rate"),
  pitch: document.getElementById("pitch"),
  rateValue: document.getElementById("rateValue"),
  pitchValue: document.getElementById("pitchValue"),
  faVoice: document.getElementById("faVoice"),
  enVoice: document.getElementById("enVoice"),
  useLocalHelper: document.getElementById("useLocalHelper"),
  localFaModel: document.getElementById("localFaModel"),
  helperUrl: document.getElementById("helperUrl"),
  status: document.getElementById("status")
};

init();

async function init() {
  const settings = await extensionApi.storage.sync.get(DEFAULT_SETTINGS);
  elements.rate.value = settings.rate;
  elements.pitch.value = settings.pitch;
  elements.useLocalHelper.checked = Boolean(settings.useLocalHelper);
  fillLocalModelSelect(settings.localFaModel);
  elements.helperUrl.value = settings.helperUrl;
  updateRangeLabels();
  await populateVoices(settings);
  bindEvents();
}

function bindEvents() {
  elements.read.addEventListener("click", () => sendToActiveTab({ type: "READ_SELECTION", settings: currentPopupSettings() }));
  elements.pause.addEventListener("click", () => sendToActiveTab({ type: "PAUSE_READING" }));
  elements.resume.addEventListener("click", () => sendToActiveTab({ type: "RESUME_READING" }));
  elements.stop.addEventListener("click", () => sendToActiveTab({ type: "STOP_READING" }));

  elements.rate.addEventListener("input", saveSettings);
  elements.pitch.addEventListener("input", saveSettings);
  elements.faVoice.addEventListener("change", saveSettings);
  elements.enVoice.addEventListener("change", saveSettings);
  elements.useLocalHelper.addEventListener("change", saveSettings);
  elements.localFaModel.addEventListener("change", saveSettings);
  elements.helperUrl.addEventListener("change", saveSettings);
}

async function sendToActiveTab(message) {
  const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const result = message.type === "STOP_READING"
      ? await extensionApi.runtime.sendMessage({ type: "TTS_STOP" })
      : await extensionApi.tabs.sendMessage(tab.id, message);
    setStatus(result?.ok === false ? readableError(result) : doneMessage(result));
  } catch {
    setStatus("صفحه را یک بار refresh کنید و دوباره امتحان کنید.");
  }
}

function readableError(result) {
  if (result?.error === "NO_TEXT") return "اول یک متن را انتخاب کنید.";
  if (result?.error === "LOCAL_TTS_UNAVAILABLE") return "موتور محلی روشن نیست یا صفحه refresh نشده.";
  if (result?.error === "LOCAL_TTS_ERROR") return `مدل محلی اجرا نشد: ${result.model || ""}`;
  if (result?.lang === "fa-IR") {
    return "صدای فارسی روی مرورگر/سیستم پیدا نشد.";
  }

  return "پخش صدا انجام نشد.";
}

function doneMessage(result) {
  if (result?.engine === "local-helper") return `مدل اجرا شد: ${result.model || "local"}`;
  return "انجام شد";
}

async function saveSettings() {
  updateRangeLabels();
  await extensionApi.storage.sync.set(currentPopupSettings());
}

function currentPopupSettings() {
  return {
    rate: Number(elements.rate.value),
    pitch: Number(elements.pitch.value),
    preferredFaVoice: elements.faVoice.value,
    preferredEnVoice: elements.enVoice.value,
    useLocalHelper: elements.useLocalHelper.checked,
    localFaModel: elements.localFaModel.value || DEFAULT_SETTINGS.localFaModel,
    helperUrl: elements.helperUrl.value.trim() || DEFAULT_SETTINGS.helperUrl
  };
}

function fillLocalModelSelect(selectedModel) {
  elements.localFaModel.replaceChildren();
  LOCAL_FA_MODELS.forEach(([value, label]) => {
    elements.localFaModel.add(new Option(label, value));
  });
  elements.localFaModel.value = selectedModel || DEFAULT_SETTINGS.localFaModel;
}

function updateRangeLabels() {
  elements.rateValue.textContent = `${elements.rate.value}x`;
  elements.pitchValue.textContent = elements.pitch.value;
}

async function populateVoices(settings) {
  const voices = await getVoices();
  fillVoiceSelect(elements.faVoice, voices, "fa", settings.preferredFaVoice);
  fillVoiceSelect(elements.enVoice, voices, "en", settings.preferredEnVoice);
}

function fillVoiceSelect(select, voices, langPrefix, selectedName) {
  const matching = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(langPrefix));
  select.replaceChildren(new Option("Auto", ""));

  matching.forEach((voice) => {
    const name = voice.voiceName || voice.name;
    select.add(new Option(`${name} (${voice.lang})`, name));
  });

  select.value = selectedName || "";
}

function getVoices() {
  return new Promise((resolve) => {
    extensionApi.runtime.sendMessage({ type: "TTS_GET_VOICES" }).then((result) => {
      if (result?.voices?.length) {
        resolve(result.voices);
      }
    }).catch(() => {});

    const voices = speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }

    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
  });
}

function setStatus(text) {
  elements.status.textContent = text;
  setTimeout(() => {
    elements.status.textContent = "";
  }, 2500);
}
