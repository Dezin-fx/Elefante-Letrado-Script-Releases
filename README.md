# ⚙️ Elefante Assistente - Core & Releases

**Repositório oficial de distribuição, releases, runtime e módulos do Elefante Assistente de Estudo.**

---

## 🏗️ Estrutura do Repositório

```text
Elefante-Assistente-Releases/
├── 📋 channels/
│   ├── 📄 stable.json       # Manifesto do Canal Estável
│   ├── 📄 beta.json         # Manifesto do Canal Beta
│   └── 📄 dev.json          # Manifesto de Desenvolvimento
│
├── ⚙️ runtime/
│   └── 📄 runtime.v1.0.0.js # Orquestrador / SO da plataforma
│
├── 🧩 modules/              # Módulos Funcionais Desacoplados
│   ├── 🎨 ui/
│   ├── 📖 reader/
│   ├── 🤖 ai/
│   └── 🧠 quiz/
│
└── 📐 schemas/
    └── 📄 manifest.schema.json # Esquema de validação dos manifestos
```

---

## 🌐 Distribuição via CDN

Este repositório é distribuído via CDN do **jsDelivr**:
- **Manifesto Estável:** `https://cdn.jsdelivr.net/gh/Dezin-fx/Elefante-Assistente-Releases@main/channels/stable.json`
- **Runtime v1.0.0:** `https://cdn.jsdelivr.net/gh/Dezin-fx/Elefante-Assistente-Releases@main/runtime/runtime.v1.0.0.js`
