const MENU_ID = "read-selected-text";

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: MENU_ID,
    title: "Read selected text",
    contexts: ["selection"]
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    browser.tabs.sendMessage(tab.id, { type: "READ_TEXT", text: info.selectionText || "" });
  }
});

browser.commands.onCommand.addListener(async (command) => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return;

  if (command === "read-selection") {
    browser.tabs.sendMessage(tab.id, { type: "READ_SELECTION" });
  }

  if (command === "stop-reading") {
    browser.tabs.sendMessage(tab.id, { type: "STOP_READING" });
  }
});
