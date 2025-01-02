import { showNotification, syncBookmarks, sendClickDataToServer } from './utils.js';

let isFirstInstall = false;

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed');
    chrome.contextMenus.create({
        id: "syncBookmarks",
        title: chrome.i18n.getMessage('appName'), 
        contexts: ["all"]
    });
    
    if (details.reason === "install") {
        chrome.runtime.openOptionsPage();
        isFirstInstall = true;
    }
    
    // 初始化监听器
    initializeBookmarkListeners();
});

// 添加URL规范化函数
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // 移除末尾的斜杠
        return urlObj.href.replace(/\/$/, '');
    } catch (e) {
        console.error('Invalid URL:', url, e);
        return url;
    }
}

// 修改 initializeBookmarkListeners 函数
const initializeBookmarkListeners = () => {
    if (chrome.history) {
        console.log('History API is available, setting up visit listener');
        chrome.history.onVisited.addListener((historyItem) => {
            console.log('History visit detected:', JSON.stringify(historyItem));
            
            if (!historyItem.url) {
                console.warn('No URL in history item');
                return;
            }

            const normalizedUrl = normalizeUrl(historyItem.url);
            console.log('Normalized URL:', normalizedUrl);
            
            // 修改搜索方式,使用精确匹配
            chrome.bookmarks.search({}, (bookmarks) => {
                const matchingBookmark = bookmarks.find(b => normalizeUrl(b.url) === normalizedUrl);
                
                if (matchingBookmark) {
                    console.log('Found matching bookmark:', JSON.stringify(matchingBookmark));
                    
                    const clickData = {
                        url: normalizedUrl,
                        meta: {
                            source: 'chrome_extension',
                            visit_time: new Date().toISOString(),
                            bookmark_id: matchingBookmark.id,
                            title: matchingBookmark.title
                        }
                    };
                    
                    console.log('Sending click data to server:', JSON.stringify(clickData));
                    sendClickDataToServer(clickData);
                } else {
                    console.log('No matching bookmark found');
                }
            });
        });
    } else {
        console.error('chrome.history API not available');
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);
    
    if (request.action === "showError") {
        const title = chrome.i18n.getMessage('appName');
        showNotification(title, request.message, true);
        console.log("Error notification displayed:", request.message);
    } else if (request.action === "syncBookmarks") {
        sendResponse({ status: "Sync initiated" });
        
        const title = chrome.i18n.getMessage('appName');
        const message = chrome.i18n.getMessage('syncMessage');
        showNotification(title, message, true);
        console.log("Notification displayed:", title, message);        
        syncBookmarks('collect', 'all');
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

chrome.bookmarks.onRemoved.addListener((id, removeInfo, action='delete') => {
    const bookmarkNode = removeInfo.node;
    if (bookmarkNode) {
        const title = chrome.i18n.getMessage('appName'); 
        const message = chrome.i18n.getMessage('syncRemovedMessage');
        showNotification(title, message, true);
        
        setTimeout(() => {
            syncBookmarks('null', bookmarkNode, 'delete');
        }, 0);
        
        console.log("onRemoved:", id, "async delete initiated");
    } else {
        console.error('No bookmark node found in removeInfo:', removeInfo);
    }
});

chrome.bookmarks.onChanged.addListener((id, bookmark) => {
    console.log('Bookmark changed:', {id, bookmark});
    
    if (!bookmark || (!bookmark.title && !bookmark.url)) {
        console.log('No meaningful changes detected');
        return;
    }

    const title = chrome.i18n.getMessage('appName');
    const message = chrome.i18n.getMessage('syncMessage');
    
    console.log('Triggering sync for changed bookmark');
    showNotification(title, message, true, [], id, 'change');
});

function buttonClickHandler(notifId, btnIdx, buttons, createdNotificationId, id, action) {
    if (!buttons || !Array.isArray(buttons)) {
        console.error('Buttons are not defined or not an array');
        return;
    }

    const button = buttons[btnIdx];
    if (notifId === createdNotificationId) {
        const buttonTitle = button.title;
        console.log(`=====> ${buttonTitle} <=====`);
        syncBookmarks('collect', id, action);
        chrome.notifications.clear(notifId);
    }
}