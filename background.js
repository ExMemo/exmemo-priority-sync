let isFirstInstall = false;
import { showNotification, syncBookmarks, sendBookmarksToServer } from './utils.js';

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed');
    chrome.contextMenus.create({
        id: "syncBookmarks",
        title: chrome.i18n.getMessage('appName'), 
        contexts: ["all"]
        // contexts: ["action"]
    });
    if (details.reason === "install") {
        chrome.runtime.openOptionsPage();
        isFirstInstall = true;
        }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse, action='all') => {
    console.log("Message received:", request);
    if (request.action === "syncBookmarks") {
        const title = chrome.i18n.getMessage('appName');
        const message = chrome.i18n.getMessage('syncMessage');
        showNotification(title, message, true);
        console.log("Notification displayed:", title, message);        
        syncBookmarks('collect', action);
        sendResponse({ status: "Sync initiated" });
    }

    return true;
});

// Listen for bookmark events: add, delete, modify, move
chrome.bookmarks.onCreated.addListener((id, bookmark, action='create') => {
    const title = chrome.i18n.getMessage('appName');
    const message = chrome.i18n.getMessage('syncMessage');
    const buttons = [
        { title: chrome.i18n.getMessage('collect_text') }, 
        { title: chrome.i18n.getMessage('todo_text') } 
    ];
    
    showNotification(title, message, true, buttons, id, action);
    console.log("onCreated:", id, message, buttons, action);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo, bookmark, action='delete') => {
    const bookmarkNode = removeInfo.node;
    console.log("removeInfo:", removeInfo);
    if (bookmarkNode) {
        const title = chrome.i18n.getMessage('appName'); 
        const message = chrome.i18n.getMessage('syncRemovedMessage');
        showNotification(title, message, true, [], bookmarkNode, action);
        console.log("onRemoved:", id, message, action);
    } else {
        console.error('No bookmark node found in removeInfo:', removeInfo);
    }
});

chrome.bookmarks.onChanged.addListener((id, bookmark, action='change') => {
    const title = chrome.i18n.getMessage('appName'); 
    const message = chrome.i18n.getMessage('syncMessage');
    showNotification(title, message, true, id, action);
    console.log("onChanged:", id, message, action);
    syncBookmarks('null', id, action);
});