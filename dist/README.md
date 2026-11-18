# WebGuard AI

> **AI-Powered Web Security System for Detecting Adversarial Content Targeting AI Agents**

[![Software Engineering Project](https://img.shields.io/badge/Course-Software%20Engineering%20Project-blue.svg)](#academic-project-details)
[![University of Delhi](https://img.shields.io/badge/Institution-Deen%20Dayal%20Upadhyaya%20College%20(DU)-red.svg)](#academic-project-details)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Gemma AI](https://img.shields.io/badge/Semantic%20Classifier-Gemma%204%20AI-orange.svg)](https://ai.google.dev/)

---

## 🎓 Academic Project Details

* **Institution:** Department of Computer Science, Deen Dayal Upadhyaya College (University of Delhi), Sector-3, Dwarka, New Delhi – 110078
* **Course:** Bachelor of Science (Hons.) Computer Science
* **Paper:** Software Engineering (Academic Session: 2026–2027 | **Semester V**)
* **Supervisor / Guide:** **Mr. Anil Kumar**, Associate Professor, Department of Computer Science
* **Date of Submission:** 19 Nov 2026

### 👥 Project Team Members (In Ascending Roll Number Order):
1. **Krishna Kumar** — Roll No: `24HCS4145`
2. **Prashansa Bhatia** — Roll No: `24HCS4157`
3. **Puneet Kumar** — Roll No: `24HCS4162`
4. **Tannu** — Roll No: `24HCS4190`

---

## 📌 Problem Statement & Threat Landscape

Modern web browsers are increasingly running autonomous **AI Agents** (Perplexity Comet, Microsoft Copilot, Claude Computer Use, OpenAI Operator) that navigate the DOM, summarize web articles, and click buttons. While human users perceive the rendered visual webpage, AI agents read the underlying DOM tree, accessibility attributes, scripts, and metadata.

Traditional web security safeguards (CSP, SOP, WAF, XSS sanitizers) only protect human users against binary script execution; **they fail completely against Natural Language Prompt Injections**. Attackers can embed hidden instructions in ordinary web content to trick AI agents into leaking session cookies, exfiltrating browsing history, or executing unintended actions.

### Real-World Case Study (Perplexity Comet Security Audit)
In 2025, security researchers exposed a vulnerability in Perplexity's Comet browser assistant where attackers hid adversarial prompts in invisible CSS containers (`display: none; opacity: 0; font-size: 0px; position: absolute; left: -9999px;`). Comet summarized the page, ingested the hidden command as higher-priority instructions, and transmitted private session tokens to an external collector server.

**WebGuard AI** resolves this vulnerability by functioning as a client-side, pre-execution security firewall inside Google Chrome. WebGuard AI intercepts webpage content and verifies it *before* any visiting AI browser agent is permitted to read or interact with it.

---

## 🛡️ Core Capabilities

WebGuard AI inspects webpage documents for adversarial AI traps across major categories:
- **Content Injection:** Prompt overrides, system prompt impersonation, and role hijacking.
- **Semantic Manipulation:** Camouflaged text matching background colors ($\Delta < 8$), microscopic font sizes ($< 1\text{px}$), and zero opacity.
- **Cognitive State Hijacking:** Recursive loops, memory exhaustion directives, and context window pollution.
- **Behavioral Control:** Unauthorized API dispatches, forced form submissions, and automated clickjacking.

---

## 🏛️ System Architecture

WebGuard AI implements a **Three-Tier Pre-Execution Sandbox Architecture**:

```
+-----------------------------------------------------------------------------------+
|                            TIER 1: PRESENTATION LAYER                             |
|  - React 18 Chrome Extension Popup Dashboard                                      |
|  - Real-Time Quantitative Risk Meter (1-10)                                       |
|  - Audit Log Viewer & JSON Report Exporter                                        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v  (Chrome Runtime Messaging API)
+-----------------------------------------------------------------------------------+
|                       TIER 2: BROWSER CLIENT-SIDE AGENT                           |
|  [Content Script (detector.js)]                                                   |
|  - Visual Concealment Engine (Computed CSS, Opacity, Coordinates, Zero Dimensions)|
|  - Structural Node Parser (HTML Comments, ARIA labels, JSON-LD Schema)            |
|  - Keyword & Pattern Matcher (Prompt Injection Dictionary)                       |
|  - IndexedDB Audit Persistence                                                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v  (Encrypted HTTPS REST JSON API)
+-----------------------------------------------------------------------------------+
|                        TIER 3: AI SEMANTIC REASONING ENGINE                       |
|  [Background Service Worker & Cloud AI Gateway]                                   |
|  - Gemma 4 Language Model Inference Pipeline                                     |
|  - Contextual Intent Classifier (Content Injection vs Behavioral Control)         |
|  - Confidence Scorer & Normalizer                                                |
+-----------------------------------------------------------------------------------+
```

---

## 🔬 Software Engineering Metrics & Verification

* **Process Model:** Linear Sequential Model with Prototyping (V-Model).
* **Function Point (FP) Analysis:**
  $$\text{UFP} = 72,\quad \sum F_i = 50,\quad \text{VAF} = 1.15 \implies \mathbf{FP = 83}$$
* **COCOMO Estimation (Semi-Detached):**
  $$\text{Code Size} \approx 4.15\text{ KLOC},\quad \text{Effort} = 14.77\text{ Person-Months},\quad \text{Schedule} = 6.42\text{ Months}$$
  $$\text{Recommended Team Size} \approx 2.3\text{ to }4\text{ Software Engineers (Matching the 4-student team)}$$
* **White-Box Testing (Basis Path Testing):**
  - Analyzed Module: `colorsClose(c1, c2)` in `detector.js`
  - Cyclomatic Complexity: $\mathbf{V(G) = 12 - 9 + 2(1) = 5}$
  - Basis Path Set: **5 linearly independent paths**, verified with a complete white-box test execution matrix.

---

## 🚀 Installation & Setup

### 1. Prerequisites
- Node.js (v18+ or v20+)
- Google Chrome browser

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Extension
```bash
npm run build
```
The production bundle is compiled into the `dist/` directory.

### 4. Load into Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top-right corner).
3. Click **Load unpacked** and select the `dist/` folder (or project root).
4. WebGuard AI is now active and monitoring tabs in real time.

---

## 🧪 Testing & Demos

You can test WebGuard AI against deliberately poisoned sample pages located in `demo-pages/`:
- `demo-pages/content-injection.html` — Hidden prompt overwriting agent instructions.
- `demo-pages/behavioural-control.html` — Invisible form and exfiltration API payload.
- `demo-pages/semantic-manipulation.html` — Microscopic and color-camouflaged text.
- `demo-pages/cognitive-state.html` — Structured JSON-LD cognitive state attack.

---

## 📜 References

1. Pressman, R. S., & Maxim, B. R. (2020). *Software Engineering: A Practitioner’s Approach* (9th ed.). McGraw-Hill Education.
2. McCabe, T. J. (1976). *A Complexity Measure*. IEEE Transactions on Software Engineering, SE-2(4), 308–320.
3. IEEE Computer Society. (1998). *IEEE Recommended Practice for Software Requirements Specifications* (IEEE Std 830-1998).
4. Greshake, K., et al. (2023). *Indirect Prompt Injection Threats on LLMs*. ACM AISEC '23.
5. Brave Software Security Research. (2025). *Security Audit of Autonomous Browser Agents*.
