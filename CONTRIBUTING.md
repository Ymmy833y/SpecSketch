# Contributing to Spec Sketch

Thank you for considering a contribution to **Spec Sketch**!\
This project is a Chrome Extension built with **MV3 / TypeScript / ESM / Webpack / Tailwind CSS / Vitest**. Bug reports, feature requests, docs, tests—**all contributions are welcome**.

---

## Getting Started

**Prerequisites**

* **Node.js** v22+ (LTS recommended)
* **npm** (bundled with Node)

**Setup**

```bash
# 1) Fork & clone
git clone https://github.com/<your-username>/SpecSketch.git
cd SpecSketch

# 2) Install deps
npm install

# 3) Dev build
npm run dev

# 4) Production build (outputs dist/)
npm run build
```

**Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the project’s `dist/` folder

---

## How to Contribute

### Report Issues / Request Features

Open a new [Issue](https://github.com/Ymmy833y/SpecSketch/issues) and include:

* A concise summary and expected vs. actual behavior
* Reproduction steps (minimal repro where possible)
* Environment details (OS / Browser / Node)
* Screenshots or logs when helpful

### Submit Code Changes

1. **Create a branch**
   ```bash
   # Feature
   git checkout -b feat/implement-comment-from-side-panel

   # Fix
   git checkout -b fix/fullpage-capture-height
   ```
2. **Implement changes + add tests**
3. **Run quality checks**
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. **Commit**
5. **Push & open a Pull Request**
   * Explain the problem, solution, and approach
   * Add screenshots/GIFs for UI changes
   * Link issues (e.g., `Fixes #123`)
   * Describe test coverage or added tests

---

## Branching Strategy (Guideline)

* **master**: stable branch
* **release/x.y.z**: release prep & maintenance
* Topic branches:
  * `feat/*` – feature work
  * `fix/*` – bug fixes
  * `chore/*` – chores (deps, config, CI, etc.)
  * `docs/*` – documentation only

> [!important]
> If a hotfix must land on multiple branches, merge to the primary branch and **cherry-pick** into the relevant `release/*` branches.

---

## Code Style

* TypeScript with **strict** settings
* **ESLint (Flat Config)** + **Prettier** (with Tailwind plugin)
* **simple-import-sort** for import ordering
* Prefer clear, descriptive names and explicit types

```bash
# Lint
npm run lint

# Auto-fix
npm run lint:fix
```

---

## Testing

* Test runner: **Vitest v3**
* Example test layout:

  * `tests/unit-pure` – pure logic
  * `tests/unit-dom` – DOM behavior
  * `tests/unit-chrome` – Chrome API (mocked)
  * `tests/integration` – integration flows

```bash
# All tests
npm test

# Watch mode
npm run test:watch
```

> [!note]
> For each feature/fix, please include **regression tests** and **behavioral tests** that capture the expected UX or messaging flow across **Panel ⇄ Content ⇄ Background**.

---

## Project Structure (Quick Reference)

* `src/runtime/panel/**` – Side panel UI (selection list, capture actions, comment editing)
* `src/runtime/content/**` – Overlay rendering, element detection, size measurement
* `src/runtime/background/**` – Service worker (CDP screenshot, tab management)
* `src/common/**` – Shared types, i18n, message enums
* `src/infra/**` – Thin wrappers for Chrome APIs / CDP client

---

## Pull Request Checklist

* [ ] Clear problem statement and rationale
* [ ] User impact noted (UI/UX changes, compatibility)
* [ ] Tests added/updated; `npm test` passes
* [ ] `npm run lint` and `npm run build` pass
* [ ] Screenshots/GIFs for UI changes
* [ ] Linked to related Issues (e.g., `Fixes #...`)

---

## Security & Dependencies

* Keep dependencies minimal; reuse internal utilities when possible
* CI runs **lint / test / build**
* For **security vulnerabilities**, please avoid public issues when possible—contact the maintainer directly

---

**Happy hacking!** 🎉\
Questions? Open an Issue or start a discussion in your PR.
