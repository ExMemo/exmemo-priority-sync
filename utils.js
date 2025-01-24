const BATCH_SIZE = 20;

let isFirstInstall = false;

let syncProgress = {
    total: 0,
    processed: 0,
    notificationId: null,
    intervalId: null,
    isBatchSync: false
};

function convertBookmarksToArray(bookmarksTree, parentPath = '', status = 'todo', action = 'create') {
    if (!Array.isArray(bookmarksTree)) {
        console.error('Invalid bookmarksTree:', bookmarksTree);
        return [];
    }

    function processBookmark(node, path) {
        const results = [];
        
        if (!node?.title) return results;


        let currentPath = path;
        const isBookmarksBar = node.title === chrome.i18n.getMessage('bookmarksbar');
        if (isBookmarksBar) {
            currentPath = '/' + node.title;
        } else if (!node.url) {
            currentPath = currentPath ? `${currentPath}/${node.title}` : node.title;
        }

        if (node.url) {
            const fullPath = currentPath ? `${currentPath}/${node.title}` : node.title;
            const isInWatchLater = fullPath.includes('/' + chrome.i18n.getMessage('todo_text') + '/');
            results.push({
                title: node.title,
                url: node.url,
                add_date: node.dateAdded ? new Date(parseInt(node.dateAdded)).toISOString() : null,
                path: fullPath,
                status: isInWatchLater ? 'todo' : status,
                action
            });
        }

        if (node.children?.length) {
            node.children.forEach(child => {
                results.push(...processBookmark(child, currentPath));
            });
        }

        return results;
    }

    return bookmarksTree.reduce((acc, node) => {
        acc.push(...processBookmark(node, parentPath));
        return acc;
    }, []);
}

// Check and create watch later folder if not exists

function checkAndCreateWatchLaterFolder(callback) {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        const bookmarksBar = bookmarkTreeNodes[0].children.find(node => 
            node.title === chrome.i18n.getMessage('bookmarksbar')
        );
        if (bookmarksBar) {
            let watchLaterFolder = bookmarksBar.children.find(node => node.title === chrome.i18n.getMessage('todo_text'));
            if (!watchLaterFolder) {
                console.log('readlater folder does not exist, creating...');
                chrome.bookmarks.create({
                    parentId: bookmarksBar.id,
                    title: chrome.i18n.getMessage('todo_text')
                }, (newFolder) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error creating folder:', chrome.runtime.lastError);
                    } else {
                        console.log('Successfully created the pending folder:', newFolder.title);
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

// Get specified bookmark and send it to server
function getAndSendBookmark(bookmarkId, status, action='create') {
    try {
        if (typeof bookmarkId === 'object' && action === 'delete') {
            const bookmarkData = {
                url: bookmarkId.url,
                title: bookmarkId.title,
                path: '',
                action: 'delete'
            };
            sendBookmarksToServer([bookmarkData], status, action);
            return;
        }

        chrome.bookmarks.get(bookmarkId, (bookmarkArray) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting bookmark:', JSON.stringify(chrome.runtime.lastError));
                return;
            }
            if (!bookmarkArray || bookmarkArray.length === 0) {
                console.error('No bookmark found with id:', bookmarkId);
                return;
            }
            console.log('Processing bookmark:', bookmarkArray[0]);
            sendBookmarksToServer(bookmarkArray[0], status, action);
        });
    } catch (error) {
        console.error('Error in getAndSendBookmark:', error);
    }
}

// get the bookmark tree and send it to the server
function getAndSendBookmarkTree(status, action='all') {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        // console.log('Original bookmark tree structure:', JSON.stringify(bookmarkTreeNodes, null, 2));
        
        if (!bookmarkTreeNodes || bookmarkTreeNodes.length === 0) {
            console.error('Retrieved bookmark tree is empty');
            return;
        }

        const rootNode = bookmarkTreeNodes[0];
        if (!rootNode.children || rootNode.children.length === 0) {
            console.error('No children found in bookmark tree root');
            return;
        }

        console.log('Sending bookmark tree with structure:', rootNode.children.length);
        sendBookmarksToServer(rootNode.children, status, action);

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

function getToken(addr, username, password) {
    return fetch(`${addr}/api/auth/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => {
        // check response type
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Unexpected response type: ${contentType}`);
        }
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

function sendRequestToServer(endpoint, data, successCallback) {
    const TIMEOUT = 60000;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000;
    
    const makeRequest = async (retryCount = 0) => {
        try {
            const items = await chrome.storage.sync.get(['addr', 'username', 'password', 'extractContent']);
            const addr = items.addr || 'http://localhost:8005';
            const username = items.username || 'guest';
            const password = items.password || 'guest';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort('Timeout');
            }, TIMEOUT);

            try {
                const token = await getToken(addr, username, password);
                const response = await fetch(`${addr}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Token ' + token,
                        'X-Extract-Content': items.extractContent || 'false'
                    },
                    body: JSON.stringify(data),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();
                successCallback(responseData);
            } catch (error) {
                if (error.name === 'AbortError' && retryCount < MAX_RETRIES) {
                    console.log(`Request timed out, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                    return makeRequest(retryCount + 1);
                }
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            console.error('Request failed:', error);
            if (retryCount < MAX_RETRIES) {
                console.log(`Request failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return makeRequest(retryCount + 1);
            }
            
            try {
                chrome.runtime.sendMessage({
                    action: "showError",
                    message: error.name === 'AbortError' ? 
                        chrome.i18n.getMessage('requestTimeout') :
                        chrome.i18n.getMessage('serverConnectionError')
                });
            } catch (e) {
                console.warn('Failed to send error message:', e);
            }
        }
    };

    makeRequest();
}

function getBookmarkPath(bookmarkId, callback) {
    const pathParts = [];
    
    function getParentPath(nodeId) {
        if (!nodeId) {
            const fullPath = pathParts.reverse().join('/');
            callback(fullPath);
            return;
        }
        
        chrome.bookmarks.get(nodeId, (nodes) => {
            if (chrome.runtime.lastError) {
                console.error('get bm wrong:', chrome.runtime.lastError);
                callback('');
                return;
            }
            const node = nodes[0];
            pathParts.push(node.title);
            getParentPath(node.parentId);
        });
    }
    
    chrome.bookmarks.get(bookmarkId, (nodes) => {
        if (chrome.runtime.lastError || !nodes.length) {
            console.error('get bm wrong:', chrome.runtime.lastError);
            callback('');
            return;
        }
        getParentPath(nodes[0].parentId);
    });
}

// updata batchsize progress
function updateSyncProgress(processed, total) {
    if (!syncProgress.isBatchSync) return;
    
    syncProgress.processed = processed;
    const percentage = Math.round((processed / total) * 100);
    const progressMsg = `[${processed}/${total}] (${percentage}%)`;
    console.log(`[Sync Progress] Progress: ${progressMsg}`);
    
    return new Promise((resolve) => {
        chrome.notifications.clear(syncProgress.notificationId, () => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon-48.png',
                title: chrome.i18n.getMessage('appName'),
                message: progressMsg,
                priority: 2,
                requireInteraction: true,
                silent: false
            }, (newId) => {
                syncProgress.notificationId = newId;
                resolve();
            });
        });
    });
}

function startProgressNotification(total) {
    console.log(`[Sync Start] Starting sync for ${total} bookmarks`);
    
    syncProgress.total = total;
    syncProgress.processed = 0;
    syncProgress.isBatchSync = true;
    
    return new Promise((resolve) => {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon-48.png',
            title: chrome.i18n.getMessage('appName'),
            message: `[0/${total}] (0%)`,
            priority: 2,
            requireInteraction: true,
            silent: false
        }, (id) => {
            syncProgress.notificationId = id;
            console.log(`[Sync Progress] Created persistent notification with ID: ${id}`);
            resolve(id);
        });
    });
}

function finishProgressNotification(success = true) {
    if (!syncProgress.isBatchSync) return;
    
    const finalStatus = success ? 'Success' : 'Failed';
    const endMsg = success 
        ? chrome.i18n.getMessage('syncStatus')
        : chrome.i18n.getMessage('syncFailed');
    
    console.log(`[Sync End] Sync completed with status: ${finalStatus}`);
    console.log(`[Sync Summary] Total: ${syncProgress.total}, Processed: ${syncProgress.processed}, Success Rate: ${Math.round((syncProgress.processed/syncProgress.total) * 100)}%`);
    
    if (syncProgress.intervalId) {
        clearInterval(syncProgress.intervalId);
        syncProgress.intervalId = null;
    }
    
    return new Promise((resolve) => {
        chrome.notifications.clear(syncProgress.notificationId, () => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon-48.png',
                title: chrome.i18n.getMessage('appName'),
                message: endMsg,
                priority: 2,
                requireInteraction: true,
                silent: false
            }, (newId) => {
                syncProgress.notificationId = newId;
                syncProgress.isBatchSync = false;
                console.log('[Sync End] Created final notification:', newId);
                resolve();
            });
        });
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === syncProgress.notificationId) {
        // user clicked on the sync notification
        chrome.notifications.clear(notificationId);
        syncProgress.notificationId = null;
    }
});

// bm sync to server
async function sendBookmarksToServer(bookmarks, status = 'todo', action='create') {
    try {
        if (!bookmarks) {
            throw new Error('Bookmarks parameter is required');
        }
        
        if (action === 'delete') {
            const deleteBookmark = Array.isArray(bookmarks) ? bookmarks[0] : bookmarks;
            const processedBookmark = {
                url: deleteBookmark.url,
                title: deleteBookmark.title,
                path: '',
                status: status,
                action: 'delete',
                is_batch: false
            };
            
            sendRequestToServer('/api/bookmarks/', [processedBookmark], (data) => {
                if (!data || !data.results) {
                    showNotification(
                        chrome.i18n.getMessage('appName'),
                        chrome.i18n.getMessage('syncFailedError'),
                        true
                    );
                    return;
                }
                showNotification(
                    chrome.i18n.getMessage('appName'),
                    chrome.i18n.getMessage('removeSuccess'),
                    true
                );
            });
            return;
        }

        const processBookmarks = new Promise(async (resolve, reject) => {
            try {
                let processedBookmarks;

                if (Array.isArray(bookmarks)) {
                    if (bookmarks[0] && bookmarks[0].children) {
                        console.log('detalied bookmarks:', bookmarks);
                        processedBookmarks = convertBookmarksToArray(bookmarks, '', status, action);
                    } else {
                        const path = await new Promise(resolve => {
                            getBookmarkPath(bookmarks[0].id, resolve);
                        });
                        processedBookmarks = convertBookmarksToArray(bookmarks, path, status, action);
                    }
                } else {
                    if (!bookmarks.id) {
                        processedBookmarks = convertBookmarksToArray([bookmarks], '', status, action);
                    } else {
                        const path = await new Promise(resolve => {
                            getBookmarkPath(bookmarks.id, resolve);
                        });
                        processedBookmarks = convertBookmarksToArray([bookmarks], path, status, action);
                    }
                }
                resolve(processedBookmarks);
            } catch (error) {
                reject(error);
            }
        });

        const processedBookmarks = await processBookmarks;
        console.log('detalied bm:', processedBookmarks.length);

        const validBookmarks = processedBookmarks.filter(bookmark => {
            if (!bookmark) {
                console.warn('Found null or undefined bookmark entry');
                return false;
            }
            if (!bookmark.url) {
                console.warn('Skipping bookmark without URL:', bookmark);
                return false;
            }
            if (!bookmark.title) {
                console.warn('Skipping bookmark without title:', bookmark);
                return false;
            }
            return true;
        });

        if (validBookmarks.length === 0) {
            throw new Error('No valid bookmarks found after filtering');
        }

        // add is batch for each bookmark
        const isBatch = validBookmarks.length > 1;
        validBookmarks.forEach(bookmark => {
            bookmark.is_batch = isBatch;
        });

        // batch sync
        if (isBatch) {
            await startProgressNotification(validBookmarks.length);
            const batches = [];
            
            for (let i = 0; i < validBookmarks.length; i += BATCH_SIZE) {
                batches.push(validBookmarks.slice(i, i + BATCH_SIZE));
            }
            
            console.log(`[Sync Info] Split into ${batches.length} batches, ${BATCH_SIZE} bookmarks per batch`);
            let processed = 0;
            
            // process each batch
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`[Sync Batch] Processing batch ${i + 1}/${batches.length}`);
                
                try {
                    await new Promise((resolve) => {
                        sendRequestToServer('/api/bookmarks/', batch, async (data) => {
                            if (data && data.results) {
                                processed += data.results.length;
                                syncProgress.processed = processed;
                                
                                await updateSyncProgress(processed, validBookmarks.length);
                                console.log(`[Sync Batch] Batch ${i + 1} completed: ${processed}/${validBookmarks.length}`);
                            }
                            setTimeout(resolve, 1000);
                        });
                    });
                } catch (error) {
                    console.error(`[Sync Error] Batch ${i + 1} failed:`, error);
                }
            }
            
            // finish progress notification
            await finishProgressNotification(processed > 0);
        } else {
            // single sync
            sendRequestToServer('/api/bookmarks/', validBookmarks, async (data) => {
                if (!data || !data.results) {
                    await finishProgressNotification(false);
                    if (!syncProgress.isBatchSync) {
                        showNotification(
                            chrome.i18n.getMessage('appName'),
                            chrome.i18n.getMessage('syncFailedError'),
                            true
                        );
                    }
                    return;
                }

                if (syncProgress.isBatchSync) {
                    syncProgress.processed = data.results.length;
                    await updateSyncProgress(data.results.length, validBookmarks.length);
                    setTimeout(() => {
                        finishProgressNotification(true);
                    }, 1000);
                } else {
                    showNotification(
                        chrome.i18n.getMessage('appName'),
                        chrome.i18n.getMessage('syncCompleteMessage'),
                        true
                    );
                }
            });
        }
    } catch (error) {
        await finishProgressNotification(false);
        console.error('[Sync Error] Error in sendBookmarksToServer:', error);
        const title = chrome.i18n.getMessage('appName');
        const message = `${chrome.i18n.getMessage('bookmarkError')} (${error.message})`;
        showNotification(title, message, true);
    }
}

function sendClickDataToServer(clickData) {
    console.log('Preparing to send click data:', JSON.stringify(clickData));
    
    if (!clickData || !clickData.url) {
        console.error('Invalid click data:', clickData);
        return;
    }

    sendRequestToServer('/api/bookmark/click/', clickData, (data) => {
        if (data.status === 'success') {
            console.log('Click data sent successfully:', JSON.stringify(data));
        } else {
            console.error('Failed to send click data:', JSON.stringify(data));
            showNotification(
                chrome.i18n.getMessage('appName'),
                chrome.i18n.getMessage('clickSyncError'),
                true
            );
        }
    });
}

function syncBookmarks(status = 'collect', bookmarkId = 'all', action = 'all') {

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

function showNotification(title, message, autoClose = false, buttons=[], id = null, action = 'all') {
    console.log('showNotification called with:', {title, message, autoClose, buttons, id, action});
    if (!chrome.notifications) {
        console.error('Notifications API is not available.');
        return;
    }

    if (message === chrome.i18n.getMessage('syncMessage') && buttons.length === 0) {
        console.log('Direct sync triggered for action:', action);
        syncBookmarks('collect', id, action);
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
            chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
                buttonClickHandler(notifId, btnIdx, buttons, createdNotificationId, id, action);
            });
            chrome.notifications.onClicked.addListener((notifId) => {
                notificationClickHandler(notifId);
            });
        }

        let timeoutId;
        if (autoClose) {
            timeoutId = setTimeout(() => {
                console.log('Notification auto-closed.');
                chrome.notifications.clear(createdNotificationId);

                if (message === chrome.i18n.getMessage('syncMessage') && !buttons.length) {
                    console.log('Triggering sync after auto-close');
                    syncBookmarks('collect', id='all', action);
                }
            }, 5000);
        } else {
            console.log('Notification will not auto-close.');
            timeoutId = null;
        }
    });
}

export { 
    getToken,
    sendRequestToServer,
    sendBookmarksToServer,
    sendClickDataToServer,
    syncBookmarks, 
    showNotification
};