# Context Aware Chat Extension

A Chrome Extension that allows you to chat with the content of your current tab using Google Gemini.

## Features

- **Context Aware**: Reads the text content of the active tab to answer questions.
- **Multimodal**: Uses screenshots to understand visual content (charts, tables, Google Sheets).
- **Google Sheets Support**: Automatically fetches CSV data from Google Sheets for deep analysis.
- **Privacy Focused**: Only runs when you open the side panel or click send. Keys stored locally.

## Installation

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable "Developer Mode".
4. Click "Load unpacked" and select this folder.

## Setup

1. Click the extension icon or use `Cmd/Ctrl + Shift + U` to open the Side Panel.
2. Click the **Settings** (⚙️) icon.
3. Enter your [Google Gemini API Key](https://aistudio.google.com/).
4. Select a model (e.g., `gemini-1.5-flash`) and click **Save**.

## Usage

- **Standard Pages**: Just ask a question!
- **Specific Text**: Highlight text on the page to ask strictly about that selection.
- **Google Sheets**: Open the sheet and ask questions. The extension will read all data in the current tab.

## License

MIT
