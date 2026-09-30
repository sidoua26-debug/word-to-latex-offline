// background.ts — Minimal background service worker for Word to LaTeX (Offline)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Word to LaTeX] Extension installed and ready.');
});
