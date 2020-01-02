// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
const { ipcRenderer, remote } = require('electron');
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
let apkFiles = [];
let buildToolPath = null;
let settingsWin;
let key = null;

let dragFile = document.getElementById("drag-file");
dragFile.addEventListener('drop', function (e) {
    // console.log(e);
    e.preventDefault();
    e.stopPropagation();

    apkFiles.length = 0;
    for (let f of e.dataTransfer.files) {
        log(`APK: ${f.path}`);
        apkFiles.push(f)
    }
});

dragFile.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
});


$('#settings-btn').on('click', async (e) => {
    settingsWin = new remote.BrowserWindow({
        width: 550,
        height: 460,
        webPreferences: {
            nodeIntegration: true
        },
        parent: remote.getCurrentWindow(),
        modal: true,
        show: false,
        resizable: false,
    })
    settingsWin.loadFile('src/settings.html')
    settingsWin.once('ready-to-show', () => {
        settingsWin.show();
        // settingsWin.openDevTools();
    })
    settingsWin.on('closed', () => {
        settingsWin = null;
        store.reload();
        selectKey();
    })
});

$('#sign-btn').on('click', async (e) => {
    if (apkFiles.length === 0) {
        log('Invalid apk!');
        return;
    }
    if (buildToolPath === null) {
        log('BuildTools not found!');
        return;
    }
    $(e.target).prop('disabled', true);

    let alignedApk = appendFilePath(apkFiles[0].path, "_aligned");
    let alignRet = await alignApk(path.join(buildToolPath, 'zipalign'), apkFiles[0], alignedApk);
    if (!alignRet) {
        $(e.target).prop('disabled', false);
        return;
    }

    let signedApk = appendFilePath(alignedApk, "_signed");
    let signRet = await signApk(path.join(buildToolPath, os.platform() === 'win32' ? 'apksigner.bat' : 'apksigner'), alignedApk, signedApk);
    if (!signRet) {
        $(e.target).prop('disabled', false);
        return;
    }
    log('DONE: ' + signedApk);
    $(e.target).prop('disabled', false);
});

function selectKey() {
    let keyList = store.get('keys');
    let index = store.get('index');
    if (keyList.length > 0) {
        let oldKey = key;
        key = keyList[index];
        if (!oldKey || oldKey.path != key.path) {
            log("KEY: " + key.path);
        }
    } else {
        key = null;
        log("KEY: NONE");
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

function log(msg) {
    let content = $('#txtarea').val();
    $('#txtarea').text(content + msg + "\n");
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
        console.log('sss')
        log('Aligning: ' + file.name);
        try {
            await exec(execPath, ['4', file.path, target]);
        } catch (e) {
            console.log(e);
            log(e.message);
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
    log('Signing: ' + file);
    try {
        await exec(execPath, args);
    } catch (e) {
        console.log(e);
        log(e.message);
        return false;
    }
    return true;
}

function init() {
    buildToolPath = findBuildTool();
    console.log(buildToolPath)
    log("BUILD_TOOLS: " + buildToolPath);
    selectKey();

}

init();