document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('appName').innerText = chrome.i18n.getMessage('appName');
    document.getElementById('syncButton').innerText = chrome.i18n.getMessage('syncButton');
    document.getElementById('bookmarkButton').innerText = chrome.i18n.getMessage('confirmButton');
    document.getElementById('bookmarkLabel').innerText = chrome.i18n.getMessage('bookmarkLabel');
    document.getElementById('collect_text').innerText = chrome.i18n.getMessage('collect_text');
    document.getElementById('watchLater').innerText = chrome.i18n.getMessage('watchLater');
    
    document.getElementById('syncButton').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "syncBookmarks" });
    });

    document.getElementById('bookmarkButton').addEventListener('click', () => {
        const bookmarkType = document.getElementById('bookmarkSelect').value;
        chrome.runtime.sendMessage({ action: "addType", type: bookmarkType });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showError") {
            const errorMessage = request.message;
            alert(errorMessage);
        }
    });
});