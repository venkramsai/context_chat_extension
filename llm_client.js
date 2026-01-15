// llm_client.js

class LLMClient {
    constructor() {
        this.apiKey = null;
        this.model = 'gemini-1.5-flash'; // Default
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
    }

    setModel(modelName) {
        this.model = modelName || 'gemini-1.5-flash';
    }

    async loadConfig() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey', 'geminiModel'], (result) => {
                this.apiKey = result.geminiApiKey;
                this.model = result.geminiModel || 'gemini-1.5-flash';
                resolve({ apiKey: this.apiKey, model: this.model });
            });
        });
    }

    async saveApiKey(key) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ geminiApiKey: key }, () => {
                this.apiKey = key;
                resolve();
            });
        });
    }

    async chat(context, userQuery, imageBase64 = null) {
        if (!this.apiKey) {
            await this.loadApiKey();
            if (!this.apiKey) {
                throw new Error("API Key not found. Please set it in settings.");
            }
        }

        const promptText = `You are a helpful assistant. You have access to the web page content the user is viewing.
    
PRIORITY INSTRUCTIONS:
1. ANALYZE THE SCREENSHOT (if provided). It contains the true visual state of the page (charts, tables, canvas apps like Sheets).
2. Use the text context as a supplement.
3. If the user asks about data provided in the screenshot (like a spreadsheet table), EXTRACT it from the image.

Context Text:
${context}

User Question:
${userQuery}
`;

        const parts = [];

        if (imageBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64
                }
            });
        }

        // Text prompt comes after image for standard multimodal context flow
        parts.push({ text: promptText });

        const url = `${this.baseUrl}${this.model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: parts
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'API Request failed');
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error("LLM Error:", error);
            throw error;
        }
    }

    async listModels() {
        if (!this.apiKey) {
            await this.loadApiKey();
            if (!this.apiKey) return [];
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            if (!response.ok) throw new Error("Failed to fetch models");
            const data = await response.json();

            // Filter for models that likely support chat/content generation
            return data.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name.replace('models/', ''));
        } catch (error) {
            console.error("Failed to list models:", error);
            return ['gemini-1.5-flash', 'gemini-pro']; // Fallbacks
        }
    }
}

// Export a singleton instance if we were using modules, but for vanilla extension scripts, just exposing the class is fine.
// We'll instantiate it in sidepanel.js
