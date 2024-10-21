chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "aiInterpreter",
    title: "AI解读助手",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "simpleExplanation",
    title: "简单解释",
    parentId: "aiInterpreter",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "detailedAnalysis",
    title: "详细分析",
    parentId: "aiInterpreter",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "keySummary",
    title: "关键点总结",
    parentId: "aiInterpreter",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "aiInterpreterSettings",
    title: "设置",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "simpleExplanation" || 
      info.menuItemId === "detailedAnalysis" || 
      info.menuItemId === "keySummary") {
    chrome.tabs.sendMessage(tab.id, {
      action: "interpret", 
      text: info.selectionText,
      interpreterType: info.menuItemId
    });
  } else if (info.menuItemId === "aiInterpreterSettings") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "openDialog" });
});
