// state.js - settings and shared state

const DEFAULT_SETTINGS = {
  // Fixed by requirements: use academy edition for text
  textEdition: "quran-uthmani-quran-academy",
  audioEdition: "ar.alafasy",
  repeat: 1,
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

  window.qqkState = {
    getSettings,
    setSettings,
  };
