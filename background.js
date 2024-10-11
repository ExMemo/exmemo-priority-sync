let isFirstInstall = false;

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed');
    chrome.contextMenus.create({
        id: "syncBookmarks",
        title: chrome.i18n.getMessage('appName'), // Context menu item title
        contexts: ["action"]
    });
    if (details.reason === "install") {
        chrome.runtime.openOptionsPage();
        isFirstInstall = true;
        }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "syncBookmarks") {
        syncBookmarks(); // Trigger bookmark synchronization
    }
});

function syncBookmarks() {
    if (isFirstInstall) {
        console.log('Skipping sync on first install');
        return;
    }
    const title = chrome.i18n.getMessage('appName'); // notificationTitle
    const message = chrome.i18n.getMessage('syncMessage');
    showNotification(title, message, true);
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        console.log(bookmarkTreeNodes);   
        sendBookmarksToServer(bookmarkTreeNodes);
    });
} // Get the bookmark tree and call the function to send bookmarks to the server

function convertBookmarksToArray(bookmarksTree, parentPath = '') {
    if (!bookmarksTree) {
        console.error('bookmarksTree is undefined');
        return [];
    }

    const bookmarksArray = [];
    bookmarksTree.forEach(bookmark => {
        const currentPath = parentPath ? `${parentPath}/${bookmark.title}` : bookmark.title;

        if (bookmark.url) {
            // console.log('Bookmark:', bookmark); // Print bookmark properties
            const addDate = bookmark.dateAdded ? new Date(parseInt(bookmark.dateAdded)).toISOString() : null;
            bookmarksArray.push({
                title: bookmark.title,
                url: bookmark.url,
                add_date: addDate,
                path: currentPath
            });
        } else if (bookmark.children) {
            // Process child bookmarks recursively
            bookmarksArray.push(...convertBookmarksToArray(bookmark.children, currentPath));
        }
    });
    return bookmarksArray;
}

function getToken(addr, username, password) {
    return fetch(`${addr}/api/auth/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (data.token) {
            return data.token;
        } else {
            throw new Error('Token not found in response');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        throw error;
    });
}

let bookmarksToSyncCount = 0;
let bookmarksSyncedCount = 0;

function sendBookmarksToServer(bookmarks) {
    bookmarksToSyncCount = bookmarks.length;
    bookmarksSyncedCount = 0;

    chrome.storage.sync.get(['addr', 'username', 'password'], (items) => {
        const addr = items.addr || 'http://localhost:8005';
        const username = items.username || 'guest'; 
        const password = items.password || 'guest'; 
        getToken(addr, username, password)
        .then(token => {
            const bookmarksArray = convertBookmarksToArray(bookmarks);
            const Token = 'Token ' + token;

            console.log('Sending bookmarks to server:', JSON.stringify(bookmarksArray, null, 2)); // 打印发送服务器前的书签
            
            return fetch(`${addr}/api/bookmarks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': Token 
                },
                body: JSON.stringify(bookmarksArray)
            });
        })
        .then(response => {
            if (!response.ok) {
                console.error('Response Error:', response.status, response.statusText);
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            bookmarksSyncedCount++;
            if (bookmarksSyncedCount === bookmarksToSyncCount) {
                const title = chrome.i18n.getMessage('appName'); // Use appName as the notification title
                const message = chrome.i18n.getMessage('syncCompleteMessage'); // Use syncCompleteMessage as the notification content
                showNotification(title, message, false); // Manual close
            }
        })
        .catch(error => {
            console.error('Error:', error);
            chrome.runtime.sendMessage({ action: "showError", message: error.message });
        });
    });
}

function showNotification(title, message, autoClose = false) {
    if (chrome.notifications) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon-48.png',
            title: title,
            message: message,
            buttons: autoClose ? [] : [{ title: chrome.i18n.getMessage('closeButton') }]  // Decide whether to add a close button based on the autoClose parameter
        }, function(notificationId) {
            if (autoClose) {
                setTimeout(() => {
                    chrome.notifications.clear(notificationId);
                }, 5000);  // Set auto-close time to 5 seconds
            } else {
                // Listen for notification button click events
                chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
                    if (notifId === notificationId && btnIdx === 0) {
                        chrome.notifications.clear(notificationId);
                    }
                });

                // Listen for notification click events
                chrome.notifications.onClicked.addListener(function(notifId) {
                    if (notifId === notificationId) {
                        chrome.notifications.clear(notificationId);
                    }
                });
            }
        });
    } else {
        console.error('Notifications API is not available.');
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "syncBookmarks") {
        syncBookmarks();
        sendResponse({ status: "Sync initiated" });
    }
});

// Listen for bookmark events: add, delete, modify, move
chrome.bookmarks.onCreated.addListener(syncBookmarks);
chrome.bookmarks.onRemoved.addListener(syncBookmarks);
chrome.bookmarks.onChanged.addListener(syncBookmarks);
chrome.bookmarks.onMoved.addListener(syncBookmarks);