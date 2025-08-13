# Spec Sketch

> Overlay numbered badges on elements you pick—and save full-page screenshots with those annotations. A simple Chrome extension for specs, reviews, and bug reports.

---

## What can it do?

* Number elements you select
  Turn Selection mode ON and click elements to add a badge. Click again to remove.
* Clear, responsive overlay
  Borders and badges sit on top of the page and follow scroll/resize.
* Auto-save per page
  Your selections are stored locally and restored when you revisit the same page.
* Full-page screenshots
  Capture the entire page (beyond the visible area) as a single image (PNG/JPEG).
* English / Japanese UI
  Text switches automatically based on your browser language.


---

## Quick start

1. Open the side panel from the extension icon.
2. Switch Select mode: ON.
3. Click elements to select / deselect.
4. See your picks in the panel list (count included).
5. Press Capture to save a full-page image.

   * Don’t want annotations in the image? Press Clear before capturing.

---

## Data & Privacy

* Selections are stored locally in your browser (`chrome.storage.local`).
* No data is sent to external servers.
* Captured images are saved via the Downloads API.

---

## Required permissions (and why)

* `sidePanel` — to show the side panel UI
* `scripting` — to inject the content script when needed
* `storage` — to save and restore your selections locally
* `tabs` — to access the active tab and connect to it
* `debugger` — to take full-page screenshots
* `downloads` — to save images to your device
* `host_permissions: <all_urls>` — to work on any website you open

---

## Supported / Limitations

* Does not work on browser-internal pages like `chrome://`, `edge://`, `about:`, or `moz-extension://`.
* Very long pages may hit browser/device limits when capturing.
* If a page’s structure changes significantly, some saved selections may no longer match.

---

## Languages

* English, 日本語

---

## License

MIT License.
