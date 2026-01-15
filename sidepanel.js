// sidepanel.js

const llmClient = new LLMClient();
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models-btn');
const saveKeyBtn = document.getElementById('save-key-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// --- UI Helpers ---

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);

    // Simple markdown-ish rendering for the bot (handling newlines at least)
    if (sender === 'bot') {
        msgDiv.innerText = text;
    } else {
        msgDiv.innerText = text;
    }

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTyping() {
    const loader = document.createElement('div');
    loader.id = 'typing-indicator';
    loader.classList.add('message', 'bot');
    loader.innerText = 'Thinking...';
    chatContainer.appendChild(loader);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTyping() {
    const loader = document.getElementById('typing-indicator');
    if (loader) loader.remove();
}

// --- Logic ---

async function getPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) throw new Error("No active tab found.");

    // If the page is a restricted chrome:// URL or similar, we might fail sending a message.
    if (tab.url && tab.url.startsWith('chrome://')) {
        throw new Error("Cannot read content from system pages.");
    } else if (!tab.url) {
        // Sometimes tab.url is undefined if we don't have permission yet or it's a restricted context
        console.warn("Tab URL is undefined. Attempting to proceed, but check permissions.");
    }

    // Ensure content script is ready (sometimes we need to inject it if it wasn't there)
    // But strictly, strict manifest v3 declarations injects it on match.
    // We'll assume it's there for now.

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "get_content" });
        if (response && response.content) {
            return response.content;
        } else {
            throw new Error("Could not extract content.");
        }
    } catch (err) {
        console.warn("Content script communication failed. Trying to inject script dynamically...");
        // Fallback: Inject script if not present (e.g., if extension was reloaded while tab was open)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        // Retry once
        const response = await chrome.tabs.sendMessage(tab.id, { action: "get_content" });
        return response.content;
    }
}

async function handleSend() {
    const query = userInput.value.trim();
    if (!query) return;

    addMessage(query, 'user');
    userInput.value = '';
    showTyping();

    try {
        // 1. Get Text Context
        let context = "";
        try {
            context = await getPageContent();
        } catch (e) {
            console.warn("Text extraction failed, relying on image:", e);
        }

        const limitedContext = context.substring(0, 500000);

        // 2. Capture Visual Context (Screenshot)
        // This is crucial for Sheets/Canvas apps where text isn't in DOM
        let screenshot = null;
        try {
            // Capture as JPEG. Quality 80 for better text readability in sheets.
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 90 });
            // Strip header to get raw base64
            screenshot = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
            console.log("Screenshot captured successfully. Length:", screenshot.length);
        } catch (e) {
            console.warn("Screenshot capture failed:", e);
        }

        // 3. Ask LLM (Multimodal)
        const answer = await llmClient.chat(limitedContext, query, screenshot);

        removeTyping();
        addMessage(answer, 'bot');

    } catch (error) {
        removeTyping();
        addMessage(`Error: ${error.message}`, 'system');

        if (error.message.includes("API Key")) {
            settingsModal.classList.remove('hidden');
        }
    }
}

// --- Helpers ---

async function populateModels(currentModel) {
    refreshModelsBtn.disabled = true;
    refreshModelsBtn.innerText = '...';
    try {
        const models = await llmClient.listModels();
        modelSelect.innerHTML = '';
        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.innerText = m;
            if (m === currentModel) option.selected = true;
            modelSelect.appendChild(option);
        });

        // If current model isn't in list (or list empty), add it manually or select first
        if (currentModel && !models.includes(currentModel)) {
            const option = document.createElement('option');
            option.value = currentModel;
            option.innerText = currentModel + " (Custom)";
            option.selected = true;
            modelSelect.appendChild(option);
        }
    } catch (e) {
        console.error(e);
    } finally {
        refreshModelsBtn.disabled = false;
        refreshModelsBtn.innerText = '🔄';
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    sendBtn.addEventListener('click', handleSend);

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    settingsBtn.addEventListener('click', () => {
        llmClient.loadConfig().then(config => {
            if (config.apiKey) apiKeyInput.value = config.apiKey;
            settingsModal.classList.remove('hidden');
            // Retrieve latest models - non-blocking
            populateModels(config.model);
        });
    });

    refreshModelsBtn.addEventListener('click', () => {
        // Temporarily save key to client if changed so listModels uses it
        llmClient.apiKey = apiKeyInput.value.trim();
        populateModels(modelSelect.value);
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const model = modelSelect.value;

        if (key) {
            chrome.storage.local.set({ geminiApiKey: key, geminiModel: model }, () => {
                llmClient.apiKey = key;
                llmClient.setModel(model);
                addMessage(`Settings saved! using model: ${model}`, 'system');
                settingsModal.classList.add('hidden');
            });
        }
    });

    // Initial check
    llmClient.loadConfig().then(config => {
        if (!config.apiKey) {
            addMessage("Please set your Gemini API Key in settings to start.", 'system');
            settingsModal.classList.remove('hidden');
        }
    });
});
