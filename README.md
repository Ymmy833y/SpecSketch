<h1 align="center"><img src="./.github/assets/icon128.png" alt="SpecSketch Logo" width="28" height="28" style="vertical-align:middle;border-radius:6px;"> Spec Sketch</h1>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-orange.svg"></a>
  <a href="https://github.com/Ymmy833y/SpecSketch/releases/tag/v1.1.0"><img alt="Version 1.1.0" src="https://img.shields.io/badge/Version-1.1.0-green.svg"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/-TypeScript-blue?style=flat-square&logo=typescript&logoColor=white">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/spec-sketch/njpkjlinikfhigfhiiiaffloinaofacd" target="_blank" rel="noopener">
    <img
      alt="Install on Chrome Web Store"
      src="https://img.shields.io/badge/Install%20on-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white"
    />
  </a>
</p>

> [!note]
> A Chrome extension (MV3) that lets you select elements, overlay numbered badges, and burn those annotations into **full-page** or **viewport** screenshots.\
> Ideal for spec reviews, UAT, bug reports, and UI documentation—fast and consistent.

<p align="center">
  <img src="./.github/assets/panel-overview.png" alt="Spec Sketch overview" width="860" style="max-width:100%;border-radius:12px;">
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick%20Start-1%20min-4CAF50?style=for-the-badge" alt="Quick Start"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Features-annotate%20%26%20capture-2196F3?style=for-the-badge" alt="Features"></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/Dev-TS%2FVitest%2FMV3-9C27B0?style=for-the-badge" alt="Dev"></a>
</p>

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Features](#features)
- [Demo](#demo)
- [Quick Start](#quick-start)
  - [Install (Recommended: Chrome Web Store)](#install-recommended-chrome-web-store)
- [User Guide](#user-guide)
  - [Select / Unselect Elements](#select--unselect-elements)
  - [Badge Tuning](#badge-tuning)
    - [Color / Shape / Size / Label Format / Visibility](#color--shape--size--label-format--visibility)
    - [Position](#position)
  - [Numbering, Grouping, Comments](#numbering-grouping-comments)
  - [Capture](#capture)
  - [Import / Export](#import--export)
  - [Theme](#theme)
- [Permissions \& Data](#permissions--data)
  - [Granted Permissions](#granted-permissions)
  - [Stored Data \& Privacy](#stored-data--privacy)
- [Supported / Limitations](#supported--limitations)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:stretch;">
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
    <h4>🖱️ Click to Select</h4>
    <p>Click elements to overlay a <b>bounding box + numbered badge</b>. Click again to unselect.</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
    <h4>🗂️ Side Panel Editing</h4>
    <p><b>Reorder</b>, <b>group</b>, and <b>comment</b> on selected items from the side panel (with collapsible groups).</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
    <h4>🖼️ Full / Viewport Capture</h4>
    <p>Full-page screenshots via Chrome CDP. Configure PNG/JPEG, scale, and quality.</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
    <h4>💾 Auto Restore</h4>
    <p>Persist selection state in <code>chrome.storage.local</code>; auto-restore on revisit.</p>
  </div>
</div>

---

## Demo

<figure>
  <img src="./.github/assets/demo-select-and-capture.gif" alt="Select and capture" width="860" style="max-width:100%;border-radius:12px;">
  <p align="center">① Select → ② Auto numbering → ③ Add comments → ④ Reorder → ⑤ Capture</p>
</figure>

<figure>
  <p align="center">Example: full-page screenshot with burned-in annotations (PNG)</@>
  <details>
    <summary>Full-page capture</summary>
    <img src="./.github/assets/demo-fullpage-capture.png" alt="Full page capture" width="860" style="max-width:100%;border-radius:12px;">
  </details>
</figure>

---

## Quick Start
> [!tip]
> If you're new to Spec Sketch, the **Chrome Web Store version** is the easiest way to get started.  
> If you're developing or validating changes, use the **Local (unpacked) install**.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/spec-sketch/njpkjlinikfhigfhiiiaffloinaofacd" target="_blank" rel="noopener">
    <img
      alt="Install on Chrome Web Store"
      src="https://img.shields.io/badge/Install%20on-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white"
    />
  </a>
</p>

### Install (Recommended: Chrome Web Store)

1. Click **Install on Chrome Web Store** above  
2. Click **Add to Chrome** → **Add extension**  
3. Open the **Side Panel** from the extensions icon in the toolbar  
4. Select elements on the page → run **Capture (Full / Viewport)**


<details>
  <summary><b>Local (Unpacked) Install — for developers</b></summary>

1. **Download ZIP**
   Open the [**spec-sketch** branch](https://github.com/Ymmy833y/SpecSketch/tree/spec-sketch) (or a <kbd>spec-sketch-x.x.x</kbd> branch), then <kbd>Code</kbd> → <kbd>Download ZIP</kbd>.

2. **Unzip**
   Extract the ZIP. The folder to load must have **`manifest.json` at its root**.

3. **Load unpacked (Chrome)** <kbd>Extensions</kbd> → <kbd>Developer mode</kbd> → <kbd>Load unpacked</kbd> → select the **unzipped folder** from Step 2.

4. **Open Side Panel**
   Launch the **Side Panel** from the extension icon on the toolbar.

</details>

---

## User Guide

### Select / Unselect Elements

* Turn **Select mode** **ON** in the side panel → click elements to show **box & numbered badge**
* Click again to unselect
* The hover outline follows the cursor; positions auto-update on scroll/resize

### Badge Tuning

#### Color / Shape / Size / Label Format / Visibility
<table>
  <thead>
    <tr>
      <th>Item</th>
      <th>Options</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>🎨 Color</td>
      <td>Gray / Red / Orange / Green / Blue / Purple / Pink / Yellow / Lime / Cyan</td>
      <td></td>
    </tr>
    <tr>
      <td>⬛ Shape</td>
      <td>Circle / Square</td>
      <td></td>
    </tr>
    <tr>
      <td>📏 Size</td>
      <td>10px – 30px</td>
      <td></td>
    </tr>
    <tr>
      <td>🔠 Label Format</td>
      <td>Numbers (123…) / Uppercase letters (ABC…) / Lowercase letters (abc…) / None</td>
      <td>
        Selecting <b>“None”</b> hides <b>only the badge</b>.<br>
        Comments remain visible.
      </td>
    </tr>
    <tr>
      <td>👁️ Visibility</td>
      <td>Show / Hide</td>
      <td>
        Selecting <b>“Hide”</b> hides <b>both the badge and the comment</b>.<br>
        The data is retained and can be shown again later.
      </td>
    </tr>
  </tbody>
</table>

#### Position

> [!note]
> Choose from **16 compass points + Center**.\
> Prefer positions that don’t cover important text or UI.

| Positions    | Options          |
| ------------ | ---------------- |
| Right Top    | Outside / Inside |
| Right        | Outside / Inside |
| Right Bottom | Outside / Inside |
| Top          | Outside / Inside |
| Center       | —                |
| Bottom       | Outside / Inside |
| Left Top     | Outside / Inside |
| Left         | Outside / Inside |
| Left Bottom  | Outside / Inside |

### Numbering, Grouping, Comments

* **Auto numbering** for new items; **reorder** items from the side panel (drag or panel controls depending on your setup)
* **Groups** (A/B/C… or Ungrouped) support **collapse/expand**
* **Comments** support multiple lines

### Capture

<table>
  <thead>
    <tr>
      <th>Setting</th><th>Options</th><th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Format</td><td>PNG / JPEG</td><td>For JPEG, set <code>quality</code> (0–100)</td></tr>
    <tr><td>Area</td><td>Full / Viewport</td><td>Full = entire page; Viewport = current view</td></tr>
    <tr><td>Scale</td><td>0.5 ~ 2.0</td><td>Higher scale = sharper image, larger file size</td></tr>
  </tbody>
</table>

### Import / Export

You can export and import saved data per page in JSON format.

**Export**
- Outputs a single file per page containing the selected items (badge settings, comments, etc.).

**Import (merge behavior)**
- Matches against existing data by <b>anchor ({ kind, version, value }</b>). If a <b>matching anchor already exists, it will neither add nor overwrite</b> (duplicates are skipped).
- The page’s existing visual settings—<b>size / label format / color, etc.</b>—<b>take precedence</b>.
- Therefore, if you <b>want the import file to take precedence</b>, <b>delete</b> the corresponding elements from the page first, then import.

> [!note]
> - Import works in a “add-if-new / skip-duplicates” safe mode.<br>
> - Useful when you want to keep the page’s visual settings while importing only the item data.

<p align="center">
  <img src="./.github/assets/setting-modal-overview.png" alt="Spec Sketch overview" width="860" style="max-width:100%;border-radius:12px;">
</p>

### Theme

Choose from three options:

- **Light** — Always use the light theme
- **Dark** — Always use the dark theme
- **Device** — Follow the OS / browser setting

> [!tip]
> Select <b>“Device”</b> if you want the theme to match your environment by default.

---

## Permissions & Data

### Granted Permissions

* `sidePanel` — side panel UI
* `scripting` — dynamic content script injection when needed
* `storage` — persist and restore selection state locally
* `tabs` — read active tab/connect, etc.
* `debugger` — Chrome DevTools Protocol (CDP) for full-page capture
* `downloads` — save generated images to the local machine
* **host_permissions**: `"<all_urls>"` — allow the extension to operate on any site (including loading overlay CSS)

### Stored Data & Privacy

* **Storage**: page-scoped selection data in `chrome.storage.local`
* **Network**: no data is sent to external servers
* **Output**: generated images are saved locally via the Downloads API

> [!note]
> 🔐 All data stays on your device. No external transmission.

---

## Supported / Limitations

* Not available on internal pages like `chrome://` or `about:`
* Very long pages or pages with many large images may hit memory limits
* If the DOM changes substantially, previously saved selections may no longer match

---

## Troubleshooting

<details>
  <summary>🧩 Unable to capture due to permission errors</summary>
  <ul>
    <li>Reopen the side panel and check the extension is enabled for the target tab</li>
    <li>After a user interaction, Chrome may prompt for <code>debugger</code> permission (panel → capture)</li>
  </ul>
</details>

<details>
  <summary>💾 Saved selections aren’t restored</summary>
  <ul>
    <li>Check for URL or DOM differences</li>
    <li>Clear storage and re-create selections if necessary</li>
  </ul>
</details>

---

## License
[MIT License](./LICENSE)
