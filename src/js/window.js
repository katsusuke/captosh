'use strict';

import fs from 'fs-extra';
import moment from 'moment-timezone';

import Url from 'url';
import util from 'util';

import { ipcRenderer, remote } from 'electron';
const BrowserWindow = remote.BrowserWindow;
const dialog = remote.dialog;

import TabGroup from 'electron-tabs';

import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux'
import { Provider } from 'react-redux';
import { createLogger } from 'redux-logger';
import rootReducer from './reducers';
import CaptureContainer from './containers/capture_container';

import BookmarkEvent from './bookmark_event';
import { newTask, clearView } from './actions';

let shiftKey = false
let cmdOrCtrlKey = false;
const defaultURL = 'https://builder.ptosh.com';
const middlewares = [];

if (process.env.NODE_ENV !== 'production') {
  const logger = createLogger({
    diff: true,
    collapsed: true,
  });
  middlewares.push(logger);
}

window.addEventListener('keydown', (e) => {
  shiftKey = e.shiftKey;
  cmdOrCtrlKey = e.ctrlKey || e.metaKey;
});

window.addEventListener('keyup', (e) => {
  shiftKey = e.shiftKey;
  cmdOrCtrlKey = e.ctrlKey || e.metaKey;
});

function showDialog(message) {
  const win = BrowserWindow.getFocusedWindow();
  const options = {
    type: 'error',
    buttons: ['閉じる'],
    title: 'error',
    message: 'error',
    detail: message
  };
  dialog.showMessageBox(win, options);
}

window.addEventListener('load', () => {
  const tabGroup = new TabGroup();
  createTab();

  document.getElementById('add-tab-button').addEventListener('click', () => {
    createTab();
  });

  const submitButton = document.getElementById('submit-button');
  const urlBar = document.getElementById('url-bar');

  submitButton.addEventListener('click', () => {
    tabGroup.getActiveTab().webview.setAttribute('src', urlBar.value);
  });

  urlBar.addEventListener('keypress', (event) => {
    if (event.keyCode === 13) {
      submitButton.click();
    }
  });

  document.getElementById('back-button').addEventListener('click', () => {
    const webview = tabGroup.getActiveTab().webview;
    if (webview.canGoBack()) {
      webview.goBack();
    }
  });

  document.getElementById('next-button').addEventListener('click', () => {
    const webview = tabGroup.getActiveTab().webview;
    if (webview.canGoForward()) {
      webview.goForward();
    }
  });

  document.getElementById('reload-button').addEventListener('click', () => {
    tabGroup.getActiveTab().webview.reload();
  });

  document.getElementById('photo-button').addEventListener('click', async () => {
    try {
      await savePDF();
    } catch (error) {
      showDialog(error.message);
    }
  });

  document.getElementById('folder-text').value = process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"];

  function selectFolder() {
    const win = BrowserWindow.getFocusedWindow();
    dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    }, (directories) => {
      if (directories) {
        document.getElementById('folder-text').value = directories[0];
      }
    });
  }

  document.getElementById('folder-button').addEventListener('click', () => {
    selectFolder();
  });

  const captureContainer = document.getElementById('capture-container');
  const captureText = document.getElementById('capture-text');

  document.getElementById('prepare-button').addEventListener('click', () => {
    if (captureContainer.style['display'] === 'none') {
      captureContainer.style['display'] = 'block';
    } else {
      captureContainer.style['display'] = 'none';
      captureText.value = '';
    }
  });

  document.getElementById('capture-button').addEventListener('click', () => {
    if (captureText.value.length > 0) {
      store.dispatch(newTask(Date.now(), captureText.value.split('\n').filter(v => v)));
    }
  });

  new BookmarkEvent({
    select: document.getElementById('bookmark-select'),
    moveButton: document.getElementById('bookmark-move-button'),
    deleteButton: document.getElementById('bookmark-delete-button'),
    addButton: document.getElementById('bookmark-add-button'),
    getActiveTab: tabGroup.getActiveTab.bind(tabGroup),
    showDialog: showDialog
  });

  const store = createStore(rootReducer, {}, applyMiddleware(...middlewares));
  ReactDOM.render(
    <Provider store={store}>
      <CaptureContainer savePDFWithAttr={savePDFWithAttr} captureTasks={[]} capturing={false} result={''} />
    </Provider>,
    document.getElementById('capture-view')
  );

  function createTab(url = defaultURL, active = true) {
    const urlBar = document.getElementById('url-bar');

    const tab = tabGroup.addTab({
      title: 'blank',
      src: url,
      visible: true,
      active: active,
      webviewAttributes: { partition: 'persist:ptosh' }
    });
    tab.on('active', (tab) => {
      urlBar.value = tab.webview.src;
    });
    tab.webview.preload = './js/webview.js';
    tab.webview.addEventListener('did-stop-loading', () => {
      if (active) {
        urlBar.value = tab.webview.src;
      }
      tab.setTitle(tab.webview.getTitle());
      // tab.webview.openDevTools();
    });
    tab.webview.addEventListener('new-window', (e) => {
      if (shiftKey && cmdOrCtrlKey) {
        createTab(e.url, false);
      } else {
        createTab(e.url);
      }
    });
  }

  async function savePDF(webview = tabGroup.getActiveTab().webview, fileName) {
    const today = new Date();

    if (document.getElementById('show-url').checked) {
      webview.send('insert-url', webview.src);
    }
    if (document.getElementById('show-datetime').checked) {
      webview.send('insert-datetime', moment(today).tz('Asia/Tokyo').format());
    }

    const path = getSavePDFPath(webview.src, today, fileName);
    const printToPDF = () => util.promisify(webview.printToPDF.bind(webview))({ printBackground: true });
    const writeFile = util.promisify(fs.writeFile);

    try {
      const data = await printToPDF();
      fs.ensureFileSync(path);
      await writeFile(path, data);
    } finally {
      webview.send('remove-inserted-element');
    }
  }

  function getSavePDFPath(src, today, fileName) {
    const saveDirectory = document.getElementById('folder-text').value;
    if (fileName) {
      return `${saveDirectory}/${fileName}`;
    }

    const trialName = src.split('/')[4];
    const sheetName = src.split('/')[8];
    const datetime = moment(today).tz('Asia/Tokyo').format('YYYYMMDD_HHmmssSSS');
    return `${saveDirectory}/ptosh_crf_image/${trialName}/${sheetName}/${datetime}.pdf`;
  }

  async function savePDFWithAttr(targetUrl, targetFileName) {
    const tab = tabGroup.addTab({
      title: 'blank',
      src: targetUrl,
      visible: true,
      webviewAttributes: { partition: 'persist:ptosh' }
    });
    tab.webview.preload = './js/webview.js';
    const didStopLoading = () => {
      return new Promise(resolve => {
        tab.webview.addEventListener('did-stop-loading', resolve);
      });
    }

    try {
      await didStopLoading();
      if (tab.webview.src.indexOf('users/sign_in') !== -1) {
        store.dispatch(clearView());
        requireSignin();
      } else {
        await savePDF(tab.webview, targetFileName);
      }
    } catch (error) {
      return { errorText: `${targetUrl}の保存に失敗しました。(${error.message})\n` };
    } finally {
      tab.close();
    }
  }

  async function request(url) {
    const captureContainer = document.getElementById('capture-container');
    if (captureContainer.style['display'] === 'none') {
      captureContainer.style['display'] = 'block';
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        headers: {
          'Content-Type': 'text/plain',
        },
        redirect: 'manual'
      });
      if (response.type === 'opaqueredirect' || response.status === 401) {
        requireSignin();
        return;
      }
      const text = await response.text();

      const targetUrl = new Url.URL(url);
      const urls = text.split(/\n/).map((value) => {
        const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;
        if (value.includes(',')) {
          return `${new Url.URL(value.split(',')[0], baseUrl).href},${value.split(',')[1]}`;
        } else {
          return new Url.URL(value, baseUrl).href;
        }
      });

      store.dispatch(newTask(Date.now(), urls));
    } catch(error) {
      showDialog(error);
    }
  }

  ipcRenderer.on('exec-api', (e, arg) => {
    request(arg);
  });

  function requireSignin() {
    captureContainer.style['display'] = 'none';
    tabGroup.getActiveTab().webview.src = defaultURL;
    showDialog('captoshアプリ内でptoshにログインしていません。ログイン後に再度実行してください。');
  }
});
