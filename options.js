import { getToken } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const ipInput = document.getElementById('addr');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const extractContentInput = document.getElementById('extractContent');
    const saveButton = document.getElementById('save');
    /* 
    const llmApiKeyInput = document.getElementById('llmApiKey');
    const llmBaseUrlInput = document.getElementById('llmBaseUrl');
    const llmModelInput = document.getElementById('llmModel');
    const truncateContentInput = document.getElementById('truncateContent');
    const maxContentLengthInput = document.getElementById('maxContentLength');
    const truncateModeSelect = document.getElementById('truncateMode');
    const autoTagInput = document.getElementById('autoTag');

    const contentOptionsDiv = document.getElementById('contentOptions');
    const truncateOptionsDiv = document.getElementById('truncateOptions');

    function updateContentOptions() {
        if (extractContentInput.checked) {
            contentOptionsDiv.classList.add('visible');
        } else {
            contentOptionsDiv.classList.remove('visible');
        }
    }

    function updateTruncateOptions() {
        if (truncateContentInput.checked) {
            truncateOptionsDiv.classList.add('visible');
        } else {
            truncateOptionsDiv.classList.remove('visible');
        }
    }
    */

    const i18nElements = {
        'appName': 'appName',
        'basicSettings_text': 'basicSettings',
        'ipAddress': 'ipAddress',
        'username_text': 'username_text',
        'password_text': 'password_text',
        'saveSettings': 'saveSettings',
        'extractContent_text': 'extractContent_text'
    };

    Object.entries(i18nElements).forEach(([elementId, messageKey]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerText = chrome.i18n.getMessage(messageKey);
        }
    });

    chrome.storage.sync.get([
        'addr', 'username', 'password',
        'extractContent'
    ], (items) => {
        console.log('Loaded settings:', items);
        ipInput.value = items.addr || 'http://localhost:8005';
        usernameInput.value = items.username || 'guest';
        passwordInput.value = items.password || 'guest';
        extractContentInput.checked = items.extractContent ?? false;
        /* 
        llmApiKeyInput.value = items.llmApiKey || '';
        llmBaseUrlInput.value = items.llmBaseUrl || 'https://api.openai.com/v1';
        llmModelInput.value = items.llmModel || 'gpt-4o-mini';
        truncateContentInput.checked = items.truncateContent ?? true;
        maxContentLengthInput.value = items.maxContentLength ?? 1000;
        truncateModeSelect.value = items.truncateMode ?? 'first_para';
        updateContentOptions();
        updateTruncateOptions();
        */
    });


    saveButton.addEventListener('click', async () => {
        const settings = {
            addr: ipInput.value.trim(),
            username: usernameInput.value.trim(),
            password: passwordInput.value,
            extractContent: extractContentInput.checked
        };

        try {
            console.log('Verifying connection to:', settings.addr);
            const token = await getToken(settings.addr, settings.username, settings.password);
            console.log('Connection verified:', token.slice(0, 10) + '...');
            
            await new Promise(resolve => chrome.storage.sync.set(settings, resolve));

            alert(chrome.i18n.getMessage('settingsSaved'));
            
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                alert(chrome.i18n.getMessage('serverConnectionError'));
            } else if (error.message.includes('Network response was not ok')) {
                alert(chrome.i18n.getMessage('invalidCredentials'));
            } else {
                alert(chrome.i18n.getMessage('settingsSaveError') + ': ' + error.message);
            }
        }
    });

    chrome.storage.sync.get([
        'addr', 'username', 'password',
        'extractContent'
    ], (items) => {
        ipInput.value = items.addr || 'http://localhost:8005';
        usernameInput.value = items.username || 'guest';
        passwordInput.value = items.password || 'guest';
        extractContentInput.checked = items.extractContent ?? false;
    });
});