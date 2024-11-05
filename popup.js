document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('appName').innerText = chrome.i18n.getMessage('appName');
    document.getElementById('syncButton').innerText = chrome.i18n.getMessage('syncButton');
   
    document.getElementById('syncButton').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "syncBookmarks" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(JSON.stringify(chrome.runtime.lastError));
            } else {
                console.log(response.status);
            }
        });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showError") {
            const errorMessage = request.message;
            alert(errorMessage);
        }
    });
});