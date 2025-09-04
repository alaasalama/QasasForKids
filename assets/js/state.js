// state.js - settings and shared state

const DEFAULT_SETTINGS = {
  // Fixed by requirements: use academy edition for text
  textEdition: "quran-uthmani-quran-academy",
  audioEdition: "ar.alafasy",
  repeat: 1,
};

// Allowed audio editions (IDs) per requirements
const ALLOWED_AUDIO_IDS = [
  "ar.abdulbasitmurattal",
  "ar.alafasy",
  "ar.husary",
  "ar.hudhaify",
  "ar.minshawi",
  "ar.muhammadayyoub",
  "ar.aymanswoaid",
  "ar.mahermuaiqly",
];

// Arabic display names for allowed audio editions
const AUDIO_NAMES_AR = {
  "ar.abdulbasitmurattal": "عبد الباسط (مرتل)",
  "ar.alafasy": "مشاري العفاسي",
  "ar.husary": "محمود الحصري",
  "ar.hudhaify": "علي الحذيفي",
  "ar.minshawi": "محمد صديق المنشاوي",
  "ar.muhammadayyoub": "محمد أيوب",
  "ar.aymanswoaid": "أيمن سويد",
  "ar.mahermuaiqly": "ماهر المعيقلي",
};

function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("qqk.settings") || "null");
    const merged = { ...DEFAULT_SETTINGS, ...(s || {}) };
    // Force text edition to the required default regardless of any prior saved value
    merged.textEdition = DEFAULT_SETTINGS.textEdition;
    // Persist migration if it changed
    if (s && s.textEdition !== merged.textEdition) localStorage.setItem("qqk.settings", JSON.stringify(merged));
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function setSettings(partial) {
  const current = getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem("qqk.settings", JSON.stringify(next));
  return next;
}

async function initSettingsUI(root = document) {
  const modal = root.getElementById("settings-modal");
  const btnOpen = root.getElementById("open-settings");
  const btnCloseEls = modal?.querySelectorAll("[data-close]") || [];
  const s = getSettings();
  const audioSel = root.getElementById("audio-edition");
  const repeatSel = root.getElementById("repeat-count");

  // Populate audio editions; display Arabic names for the allowed list
  if (audioSel) {
    // Build options directly from the allowed list using Arabic names
    const options = ALLOWED_AUDIO_IDS.map(id => `<option value="${id}">${AUDIO_NAMES_AR[id] || id}</option>`).join("");
    audioSel.innerHTML = options;
    audioSel.value = s.audioEdition;
    audioSel.addEventListener("change", () => setSettings({ audioEdition: audioSel.value }));
  }
  if (repeatSel) {
    repeatSel.value = String(s.repeat || 1);
    repeatSel.addEventListener("change", () => setSettings({ repeat: Number(repeatSel.value) || 1 }));
  }

  function openModal() { modal?.setAttribute("aria-hidden", "false"); modal?.setAttribute("open", ""); }
  function closeModal() { modal?.setAttribute("aria-hidden", "true"); modal?.removeAttribute("open"); }
  btnOpen?.addEventListener("click", openModal);
  btnCloseEls.forEach(b => b.addEventListener("click", closeModal));
  modal?.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);

  return s;
}

  window.qqkState = {
    getSettings,
    setSettings,
    initSettingsUI,
  };
