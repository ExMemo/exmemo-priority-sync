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

    /* 
    extractContentInput.addEventListener('change', updateContentOptions);
    truncateContentInput.addEventListener('change', updateTruncateOptions);
    */

    // 修改存储设置的处理逻辑
    saveButton.addEventListener('click', async () => {
        const settings = {
            addr: ipInput.value.trim(), // 添加 trim() 去除可能的空格
            username: usernameInput.value.trim(),
            password: passwordInput.value,
            extractContent: extractContentInput.checked
        };

        try {
            // 验证连接信息
            console.log('Verifying connection to:', settings.addr);
            const token = await getToken(settings.addr, settings.username, settings.password);
            console.log('Connection verified:', token.slice(0, 10) + '...');
            
            // 保存到 Chrome Storage
            await new Promise(resolve => chrome.storage.sync.set(settings, resolve));

            /* 
            try {
                const response = await fetch(settings.addr + '/api/bm/settings/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Token ' + token
                    },
                    body: JSON.stringify({
                        settings: {
                            'extract_content': settings.extractContent
                        }
                    })
                });

                const data = await response.json();
                if (data.status !== 'success') {
                    throw new Error(data.message || 'Failed to save settings');
                }
            } catch (error) {
                if (error.message.includes('Failed to fetch')) {
                    alert(chrome.i18n.getMessage('serverConnectionError'));
                } else {
                    alert(chrome.i18n.getMessage('settingsSaveError') + ': ' + error.message);
                }
                return;
            }
            */

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

    // 加载存储的设置
    chrome.storage.sync.get([
        'addr', 'username', 'password',
        'extractContent'
    ], (items) => {
        ipInput.value = items.addr || 'http://localhost:8005';
        usernameInput.value = items.username || 'guest';
        passwordInput.value = items.password || 'guest';
        extractContentInput.checked = items.extractContent ?? false;
    });

    /* 
    document.getElementById('truncateMode_hint').innerText = chrome.i18n.getMessage('truncateMode_hint');
    document.getElementById('truncateContent_text').innerText = chrome.i18n.getMessage('truncateContent');
    document.getElementById('maxContentLength_text').innerText = chrome.i18n.getMessage('maxContentLength');
    document.getElementById('truncateMode_text').innerText = chrome.i18n.getMessage('truncateMode');
    document.getElementById('llmApiKey_text').innerText = chrome.i18n.getMessage('llmApiKey');
    document.getElementById('llmBaseUrl_text').innerText = chrome.i18n.getMessage('llmBaseUrl');
    document.getElementById('llmModel_text').innerText = chrome.i18n.getMessage('llmModel');
    document.getElementById('llmSettings_text').innerText = chrome.i18n.getMessage('llmSettings');
    document.getElementById('autoTagHint_text').innerText = chrome.i18n.getMessage('autoTagHint');
    document.getElementById('tagsSection_text').innerText = chrome.i18n.getMessage('tagsSection');
    document.getElementById('truncateContent_hint').innerText = chrome.i18n.getMessage('truncateContent_hint');
    document.getElementById('maxContentLength_hint').innerText = chrome.i18n.getMessage('maxContentLength_hint');
    document.getElementById('truncateMode_hint').innerText = chrome.i18n.getMessage('truncateMode_hint');
    */});