let isFirstInstall = false;
let bookmarksToSyncCount = 0;
let createdNotificationId;
let bookmarksArray = [];

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

function convertBookmarksToArray(bookmarksTree, parentPath = '', status = 'todo', action='create') {
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
                path: currentPath,
                status: status,
                action: action
            });
        } else if (bookmark.children) {
            bookmarksArray.push(...convertBookmarksToArray(bookmark.children, currentPath, status, action));
        }
    });
    return bookmarksArray;
}

export function sendBookmarksToServer(bookmarks, status = 'todo', action='create') {
    if (Array.isArray(bookmarks)) {
        bookmarksArray = convertBookmarksToArray(bookmarks, '', status, action);
    } else {
        bookmarksArray = convertBookmarksToArray([bookmarks], '', status, action);
    }
    bookmarksToSyncCount = bookmarksArray.length;

    chrome.storage.sync.get(['addr', 'username', 'password'], (items) => {
        const addr = items.addr || 'http://localhost:8005';
        const username = items.username || 'guest'; 
        const password = items.password || 'guest'; 
        getToken(addr, username, password)
        .then(token => {
            const Token = 'Token ' + token;
            // console.log('Sending bookmarks to server:', JSON.stringify(bookmarksArray, null, 2));
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
        .then(data => { // the response return data
            console.log('Success:', data);
            const successCount = data.results.length || 0;
            console.log('input:', bookmarksToSyncCount, 'response:', successCount);
            
            if (successCount === bookmarksToSyncCount) {
                 // Use syncCompleteMessage as the notification content
                 const title = chrome.i18n.getMessage('appName');
                 const message = chrome.i18n.getMessage('syncCompleteMessage'); 
                 showNotification(title, message, false, [{ title: chrome.i18n.getMessage('closeButton') }], action);
                 console.log('Notification displayed:', title, message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            chrome.runtime.sendMessage({ action: "showError", message: error.message });
        });
    });
}

function checkAndCreateWatchLaterFolder(callback) {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        const bookmarksBar = bookmarkTreeNodes[0].children.find(node => 
            node.title === chrome.i18n.getMessage('bookmarksbar')
        );
        if (bookmarksBar) {
            let watchLaterFolder = bookmarksBar.children.find(node => node.title === chrome.i18n.getMessage('todo_text'));
            if (!watchLaterFolder) {
                chrome.bookmarks.create({
                    parentId: bookmarksBar.id,
                    title: chrome.i18n.getMessage('todo_text')
                }, (newFolder) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error creating folder:', chrome.runtime.lastError);
                    } else {
                        callback(newFolder.id);
                    }
                });
            } else {
                callback(watchLaterFolder.id);
            }
        } else {
            console.error('Bookmarks bar not found');
        }
    });
}


function getAndSendBookmark(bookmarkId, status, action='create') {

    if (action === 'delete') {
        sendBookmarksToServer(bookmarkId, status, action);
    } else {
        chrome.bookmarks.get(bookmarkId, (bookmarkArray) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting bookmark:', JSON.stringify(chrome.runtime.lastError));
            } else if (bookmarkArray && bookmarkArray.length > 0) {
                console.log('Bookmark', bookmarkArray[0], status, action);
                sendBookmarksToServer(bookmarkArray[0], status, action);
            } else {
                console.error('No bookmark found with id:', bookmarkId);
            }
        });
    }
}

// get the bookmark tree and send it to the server
function getAndSendBookmarkTree(status, action='all') {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        sendBookmarksToServer(bookmarkTreeNodes, status, action);
    });
}

export function syncBookmarks(status = 'collect', bookmarkId = 'all', action = 'all') {

    if (isFirstInstall) {
        console.log('Skipping sync on first install');
        return;
    }
    console.log('syncBookmarks: status:',status, 'bookmarkId:', bookmarkId, 'action:', action);
    if (bookmarkId !== 'all') {
        if (action === 'create' && status === 'todo') {
            checkAndCreateWatchLaterFolder((watchLaterFolderId) => {
                chrome.bookmarks.move(bookmarkId, { parentId: watchLaterFolderId }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error moving bookmark:', JSON.stringify(chrome.runtime.lastError));
                    } else {
                        console.log('Bookmark moved to watchlater folder');
                    }
                    getAndSendBookmark(bookmarkId, status, action);
                });
            });
        } else {
            getAndSendBookmark(bookmarkId, status, action);
        }
    } else{
        console.log('Bookmark ID is all', status);
        getAndSendBookmarkTree(status, action);
    }
}  

export function showNotification(title, message, autoClose = false, buttons=[], id = null, action = 'all') {
    console.log('showNotification', title, message, autoClose, buttons, id, action);
    if (!chrome.notifications) {
        console.error('Notifications API is not available.');
        return;
    }

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon-48.png',
        title: title,
        message: message,
        buttons: buttons
    }, (createdNotificationId) => {
        if (chrome.runtime.lastError) {
            console.error(`Error creating notification: ${chrome.runtime.lastError}`);
            return;
        }

        if (buttons.length > 0) {
            console.log('Notification created with buttons:', buttons);
            chrome.notifications.onButtonClicked.removeListener(buttonClickHandler);
            chrome.notifications.onClicked.removeListener(notificationClickHandler);
            // add new buttonClickHandler and notificationClickHandler
            chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
                buttonClickHandler(notifId, btnIdx, buttons, createdNotificationId, id, action);
            });
            chrome.notifications.onClicked.addListener((notifId) => {
                notificationClickHandler(notifId);
            });
        } else {
            console.log('Notification created without buttons, is remove action.');
            syncBookmarks('', id, action);
        }
    let timeoutId;
    if (autoClose) {
        timeoutId = setTimeout(() => {
            console.log( title, message, autoClose,id, action);
            console.log('Notification auto-closed.');
            chrome.notifications.clear(createdNotificationId);
        }, 5000);
    } else {
        console.log( title, message, autoClose,id, action);
        console.log('Notification will not auto-close, is closeButton.');
        timeoutId = null;
    }
    });
}

function buttonClickHandler(notifId, btnIdx, buttons, createdNotificationId, id, action) {
    if (!buttons || !Array.isArray(buttons)) {
        console.error('Buttons are not defined or not an array');
        return;
    }

    const button = buttons[btnIdx];
    if (notifId === createdNotificationId) {
        const buttonTitle = button.title;
        if (buttonTitle === chrome.i18n.getMessage('collect_text')) {
            console.log('=====> Collect <=====');
            syncBookmarks('collect', id, action);
        } else if (buttonTitle === chrome.i18n.getMessage('todo_text')) {
            console.log('=====> Watch Later <=====');
            syncBookmarks('todo', id, action);
        }
        chrome.notifications.clear(notifId);
    }
}

function notificationClickHandler(notifId, createdNotificationId) {
    if (notifId === createdNotificationId) {
        chrome.notifications.clear(notifId);
    }
}