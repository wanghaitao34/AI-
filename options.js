document.addEventListener('DOMContentLoaded', () => {
    const apiProvider = document.getElementById('apiProvider');
    const apiEndpoint = document.getElementById('apiEndpoint');
    const apiKey = document.getElementById('apiKey');
    const modelSelect = document.getElementById('modelSelect');
    const customModelGroup = document.getElementById('customModelGroup');
    const customModel = document.getElementById('customModel');
    const saveButton = document.getElementById('saveButton');
    const togglePassword = document.getElementById('togglePassword');

    // 加载保存的设置
    chrome.storage.sync.get(['apiProvider', 'apiEndpoint', 'apiKey', 'model', 'customModel'], (result) => {
        if (result.apiProvider) apiProvider.value = result.apiProvider;
        if (result.apiEndpoint) apiEndpoint.value = result.apiEndpoint;
        if (result.apiKey) apiKey.value = result.apiKey;
        if (result.model) {
            if (result.model === 'custom') {
                modelSelect.value = 'custom';
                customModelGroup.classList.remove('hidden');
                customModel.value = result.customModel || '';
            } else {
                modelSelect.value = result.model;
            }
        }
    });

    // 显示/隐藏自定义模型输入框
    modelSelect.addEventListener('change', () => {
        if (modelSelect.value === 'custom') {
            customModelGroup.classList.remove('hidden');
        } else {
            customModelGroup.classList.add('hidden');
        }
    });

    // 切换密码可见性
    togglePassword.addEventListener('click', function () {
        const type = apiKey.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKey.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });

    // 保存设置
    saveButton.addEventListener('click', () => {
        const settings = {
            apiProvider: apiProvider.value,
            apiEndpoint: apiEndpoint.value,
            apiKey: apiKey.value,
            model: modelSelect.value
        };

        if (modelSelect.value === 'custom') {
            settings.customModel = customModel.value;
        }

        chrome.storage.sync.set(settings, () => {
            alert('设置已保存');
        });
    });
});
