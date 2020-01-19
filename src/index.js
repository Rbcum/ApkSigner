// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
const { clipboard, ipcRenderer, remote, shell } = require('electron');
const dialog = remote.dialog;
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const shellEnv = require('shell-env');
const exec = util.promisify(require('child_process').execFile);
const copyFile = util.promisify(require('fs').copyFile);
const $ = require('jquery');
const Store = require('./store.js');

const store = new Store({
    configName: 'settings',
    defaults: {
        keys: [],
    }
});
let apk = null;
let buildToolPath = null;
let settingsWin = null;
let key = null;

function updateUI() {
    $('#buildTools').val(buildToolPath);
    if (apk != null) {
        $('#apkFile').val(apk.name);
        $('#aligned').val(appendFilePath(apk.name, "_aligned"));
        $('#signed').val(appendFilePath(apk.name, "_aligned_signed"));
    }
}

let dragFile = document.body;
dragFile.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    apk = e.dataTransfer.files[0];
    updateUI();
});

dragFile.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
});


$('#settings-btn').on('click', async (e) => {
    settingsWin = new remote.BrowserWindow({
        width: 600,
        height: 435,
        webPreferences: {
            nodeIntegration: true
        },
        parent: remote.getCurrentWindow(),
        modal: true,
        show: false,
    })
    settingsWin.loadFile('src/settings.html')
    settingsWin.once('ready-to-show', () => {
        settingsWin.show();
        // settingsWin.openDevTools();
    })
    settingsWin.on('closed', () => {
        settingsWin = null;
        store.reload();
        updateKey();
    })
});

$('#sign-btn').on('click', async (e) => {
    if (key === null) {
        dialog.showErrorBox('Key not found!', '');
        return;
    }
    if (apk === null) {
        dialog.showErrorBox('Invalid apk!', '');
        return;
    }
    if (buildToolPath === null) {
        dialog.showErrorBox('BuildTools not found!', '');
        return;
    }
    $(e.target).prop('disabled', true);

    let alignedApk = appendFilePath(apk.path, "_aligned");
    let signedApk = appendFilePath(apk.path, "_aligned_signed");

    let alignRet = await alignApk(path.join(buildToolPath, 'zipalign'), apk, alignedApk);
    if (!alignRet) {
        $(e.target).prop('disabled', false);
        return;
    }

    let signRet = await signApk(path.join(buildToolPath, os.platform() === 'win32' ? 'apksigner.bat' : 'apksigner'), alignedApk, signedApk);
    if (!signRet) {
        $(e.target).prop('disabled', false);
        return;
    }

    $(e.target).prop('disabled', false);

    let dialogResult = await dialog.showMessageBox(remote.getCurrentWindow(), {
        message: 'Signing Success!',
        buttons: ['Open Folder', 'Close'],
    })
    switch (dialogResult.response) {
        case 0:
            shell.showItemInFolder(signedApk);
            break;
    }
});

function updateKey() {
    let keyList = store.get('keys');
    let selectedKey = store.get('selectedKey');
    $('#keyList').empty();
    $('#keyListButton').text('Select Key');
    key = null;
    if (keyList.length === 0) {
        return;
    }
    for (let index = 0; index < keyList.length; index++) {
        let k = keyList[index];
        let kFileName = path.basename(k.path);
        let a = document.createElement("a");
        a.setAttribute('class', 'dropdown-item');
        a.setAttribute('href', '#');
        a.innerHTML = kFileName;
        a.onclick = (e) => {
            key = k;
            $('#keyListButton').text(kFileName);
            store.set('selectedKey', k.path);
        };
        if (selectedKey === k.path) {
            key = k;
            $('#keyListButton').text(kFileName);
        }
        $('#keyList').append(a);
    }
}

function findBuildTool() {
    let sdk = shellEnv.sync().ANDROID_HOME;
    let dir = path.join(sdk, "build-tools");
    let versionsDirs = fs.readdirSync(dir);
    versionsDirs = versionsDirs.filter(f => f.match(/\d+.\d+.\d+/));
    versionsDirs.sort();
    return path.join(dir, versionsDirs.pop());
}

function appendFilePath(name, append) {
    let i = name.lastIndexOf(".");
    return name.substring(0, i) + append + name.substring(i);
}

async function alignApk(execPath, file, target) {
    async function isAligned() {
        try {
            await exec(execPath, ['-c', '4', file.path]);
            return true;
        } catch (e) {
            // console.log(e);
            return false;
        }
    }

    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
    }
    let aligned = await isAligned();
    if (!aligned) {
        try {
            await exec(execPath, ['4', file.path, target]);
        } catch (e) {
            dialog.showErrorBox('Align Failed', e.message);
            return false;
        }
    } else {
        await copyFile(file.path, target);
    }
    return true;
}


async function signApk(execPath, file, target) {
    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
    }
    let args = [
        'sign',
        '--ks', key.path,
        '--ks-pass', 'pass:' + key.ksPass,
        '--ks-key-alias', key.keyAlias,
        '--key-pass', 'pass:' + key.keyPass,
        '--v1-signing-enabled', 'true',
        '--v2-signing-enabled', 'false',
        '--in', file,
        '--out', target,
    ];
    try {
        await exec(execPath, args);
    } catch (e) {
        dialog.showErrorBox('Sign Failed', e.message);
        return false;
    }
    return true;
}

function init() {
    buildToolPath = findBuildTool();
    updateKey();
    updateUI();
}

init();