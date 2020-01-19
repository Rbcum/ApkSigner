const { ipcRenderer, remote } = require('electron');
const { dialog } = remote
const path = require('path');
const $ = require('jquery');
const Store = require('./store.js');
const keyList = [];
const store = new Store({
    configName: 'settings',
    defaults: {
        keys: [],
        index: -1,
    }
});
let selectedIndex = 0;
keyList.push(...store.get('keys'));

updateUI();

bindInputs('#ks-pass', 'ksPass');
bindInputs('#key-alias', 'keyAlias');
bindInputs('#key-pass', 'keyPass');

$('#save-btn').on('click', function (e) {
    store.set('keys', keyList);
    remote.getCurrentWindow().close();
})
$('#cancel-btn').on('click', function (e) {
    remote.getCurrentWindow().close();
})
$('#add-key').on('click', async function (e) {
    let ret = await dialog.showOpenDialog(remote.getCurrentWindow, {
        properties: ['openFile']
    });
    if (ret.filePaths.length > 0) {
        keyList.push({ path: ret.filePaths[0] })
        if (selectedIndex == -1) selectedIndex = 0;
        updateUI();
    }
})
$('#remove-key').on('click', function (e) {
    if (selectedIndex == -1) return;
    keyList.splice(selectedIndex, 1);
    selectedIndex = keyList.length == 0 ? -1 : Math.max(0, selectedIndex - 1);
    updateUI();
})


function bindInputs(inputId, prop) {
    $(inputId).on('input', (e) => {
        keyList[selectedIndex][prop] = e.target.value;
    });
}

function updateUI() {
    $('#key-list').empty();
    for (let index = 0; index < keyList.length; index++) {
        let k = keyList[index];
        let button = document.createElement("button");
        let classAttr = "list-group-item list-group-item-action border-0";
        if (selectedIndex == index) classAttr += ' active';
        button.setAttribute('class', classAttr);
        button.innerHTML = path.basename(k.path);
        button.onclick = (e) => {
            selectedIndex = index;
            updateUI();
        };
        $('#key-list').append(button);
    }
    if (selectedIndex != -1) {
        let key = keyList[selectedIndex];
        $('#ks-file').val(key.path);
        $('#ks-pass').val(key.ksPass);
        $('#key-alias').val(key.keyAlias);
        $('#key-pass').val(key.keyPass);
    } else {
        $('#ks-file').val(null);
        $('#ks-pass').val(null);
        $('#key-alias').val(null);
        $('#key-pass').val(null);
    }
}


