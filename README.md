English | [中文简体](./README_cn.md)

## 1. Introduction

The [ExMemo](https://github.com/ExMemo/exmemo.git) is a personal knowledge management project designed to centrally record and manage various types of information, including favorite texts, books, music, videos, web pages, work documents, as well as reflections and thoughts about life. By systematically integrating these elements, it aims to break through cognitive limitations and discover internal connections.

![](./images/img1.png)

The system consists of a database, backend, and multiple front-ends. Distributed storage and databases are used to store user files, text, and corresponding vector data. Data storage can be deployed locally to protect user privacy. The backend provides general interfaces for data creation, reading, updating, and deletion (CRUD) operations and is responsible for invoking large models and processing data. The system supports mainstream online large models like OpenAI, Gemini, Qwen as well as offline models like Ollama. Multiple front-ends are available in the form of web services, WeChat bots, Obsidian plugins, and browser extensions for users to upload and download data.

![](./images/img2.png)

`bookmarks-sync` is a Chrome extension based on ExMemo designed to sync browser bookmarks to the database.

## 2. Key Features

- **Sync Mechanism**: Users can manually click the "Sync" button or have the sync automatically triggered when bookmarks change.
- **Bookmark Management**: Supports setting bookmarks as "To-Read" or "Favorite," with favorites representing more important entries.
- **Link Detection**: Automatically identifies broken links and marks them in the database.
- **Incremental Sync**: Processes only data changes during each sync to improve efficiency.

## 3. Installation and Setup

### 3.1 Installation

1. Clone or download this repository.
2. Open Google Chrome and go to the Extensions Manager (type `chrome://extensions/` in the address bar).
3. Toggle the "Developer mode" switch in the upper right corner.
4. Click "Load unpacked" and select the `bookmarks-sync` folder to install.

### 3.2 Initial Setup

Upon the first installation, input the server address (`addr`), username, and password as prompted by the configuration page.  
Restart Google Chrome to apply changes.

## 4. Usage

- **First Manual Sync**: A manual sync needs to be triggered when using the extension for the first time.
- **Automatic Sync**: Subsequent changes will automatically sync.
- **Bookmark Categorization**: Tag bookmarks with types like "To-Read" or "Favorite."

## 5. To-Do

- Add configuration options to toggle bookmark content syncing.
- Make compatible with more browsers.

## 6. License

This project is licensed under the terms of the GNU Lesser General Public License v3.0. For more details, please see the [LICENSE](./LICENSE) file.