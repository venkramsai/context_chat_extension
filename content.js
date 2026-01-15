// content.js
console.log("Context Chat Content Script Loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_content") {
        (async () => {
            try {
                // SPECIAL HANDLING: Google Sheets
                // Sheets renders as Canvas, so text extraction fails. Screenshot is limited to viewport.
                // BEST SOLUTION: Fetch the CSV export of the current sheet.
                if (window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/')) {
                    console.log("Detected Google Sheet. Attempting to fetch CSV data...");

                    // Parse 'gid' (Sheet Tab ID) from URL hash (#gid=1234)
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const gid = hashParams.get('gid') || '0';

                    // Construct export URL. 
                    // remove /edit and anything after, append /export
                    // e.g. .../d/KEY/edit -> .../d/KEY/export
                    const baseUrl = window.location.href.split('/edit')[0];
                    // Add timestamp to prevent caching of old data
                    const exportUrl = `${baseUrl}/export?format=csv&gid=${gid}&t=${Date.now()}`;

                    try {
                        const response = await fetch(exportUrl);
                        if (response.ok) {
                            const csvText = await response.text();
                            console.log("Successfully fetched CSV data. Length:", csvText.length);
                            sendResponse({ content: `[CONTEXT: GOOGLE SHEET CSV DATA]\n${csvText}` });
                            return;
                        } else {
                            console.warn("CSV fetch failed:", response.status);
                        }
                    } catch (err) {
                        console.error("Error fetching CSV:", err);
                    }
                }

                // STANDARD HANDLING (Normal Pages)
                // Strategy 1: Check if user has selected text. 
                const selection = window.getSelection().toString().trim();
                // Strategy 2: Fallback to full body text
                const bodyText = document.body.innerText;

                // If selection is substantial, use it. Otherwise use full page.
                const content = selection.length > 0 ? `[User Selected Content]:\n${selection}` : bodyText;

                sendResponse({ content: content });

            } catch (error) {
                console.error("Content extraction error:", error);
                sendResponse({ content: "" }); // detailed error handling in sidepanel
            }
        })();

        return true; // Keep channel open for async response
    }
});
