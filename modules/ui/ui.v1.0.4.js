/**
 * Elefante Letrado Script - Módulo UI v1.0.4
 * Gerenciador de interface visual, renderizador de painel flutuante e formulários.
 */

(function () {
  'use strict';

  const UIModule = {
    name: 'ui',
    version: '1.0.4',
    depends: [],

    async init(runtime) {
      this.runtime = runtime;
      this.icons = window.ElefanteUIIcons || {};
      this.styles = window.ElefanteUIStyles || {};

      // 1. Escuta EVENTOS DE DOMÍNIO para atualizar a interface sem acoplamento
      runtime.events.on('quiz:opened', () => {
        this.setStatus('🧠 Resolvendo Quiz...', '#cba6f7');
      });

      runtime.events.on('quiz:closed', () => {
        this.resetStatus();
      });

      runtime.events.on('quiz:solved', (payload) => {
        this.appendResult(`\n[Quiz Resolvido]: ${payload?.answer || 'OK'}`);
      });

      runtime.events.on('reader:started', () => {
        this.updateAutoButton(true);
        this.setStatus('Navegando...', '#89b4fa');
      });

      runtime.events.on('reader:stopped', () => {
        this.updateAutoButton(false);
        this.resetStatus();
      });

      // Se o módulo Settings ou Runtime for resetado
      runtime.events.on('config:reset', () => {
        this.renderSetupScreen();
      });
    },

    async start() {
      // Injeta fontes e folhas de estilo CSS
      if (this.styles.inject) this.styles.inject();

      // Cria o painel flutuante arrastável no DOM
      this.createPanelShell();

      // Decide qual tela inicial exibir com base nas configurações do storage
      const storage = this.runtime.services.storage;
      const apiKey = storage.getApiKey();
      const noAI = storage.getNoAI();
      const bookTitle = storage.getBookTitle();

      if (noAI || (apiKey && bookTitle)) {
        this.renderMainScreen();
      } else {
        this.renderSetupScreen();
      }
    },

    async stop() {
      const panel = document.getElementById('ea-panel');
      if (panel) panel.remove();
    },

    // -------------------------------------------------------------
    // API DO PAINEL REUTILIZÁVEL (COMPONENT API)
    // -------------------------------------------------------------
    createPanelShell() {
      let panel = document.getElementById('ea-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'ea-panel';
        panel.style.cssText = `
          position: fixed; top: 20px; right: 20px; z-index: 999999;
          background: #1e1e2e; color: #cdd6f4; font-family: monospace;
          border: 1px solid #313244; border-radius: 16px; padding: 20px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6); width: 380px;
          max-width: calc(100vw - 40px); display: flex; flex-direction: column;
        `;

        panel.innerHTML = `
          <div id="ea-drag-header" style="
            cursor: move; user-select: none; background: #11111b;
            margin: -20px -20px 0 -20px; padding: 16px 20px 24px 20px;
            border-radius: 16px 16px 0 0; display: flex; justify-content: space-between;
            align-items: center; position: relative; z-index: 1;
          ">
            <strong style="color:#af74f0;font-family:'Outfit',sans-serif;font-weight:700;font-size:16px;animation:eaTitleGlow 4s ease-in-out infinite;letter-spacing:-0.2px;"> Elefante Letrado Script</strong>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button id="ea-min-btn" class="ea-btn-icone" style="width: 24px; height: 24px; border: none; border-radius: 6px; background: #313244; color: #cdd6f4; cursor: pointer; font-size: 14px; font-weight: bold; line-height: 1; transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;">−</button>
            </div>
          </div>
          <div id="ea-panel-content" class="ea-panel-content"></div>
        `;

        document.body.appendChild(panel);

        // Eventos de Drag & Drop
        let isDragging = false, offsetX = 0, offsetY = 0;
        const header = document.getElementById("ea-drag-header");

        header.addEventListener('mousedown', e => {
          if (e.target.tagName === "BUTTON") return;
          isDragging = true;
          offsetX = e.clientX - panel.offsetLeft;
          offsetY = e.clientY - panel.offsetTop;
        });

        document.addEventListener('mousemove', e => {
          if (!isDragging) return;
          let newLeft = e.clientX - offsetX;
          let newTop  = e.clientY - offsetY;
          const maxLeft = window.innerWidth - panel.offsetWidth;
          const maxTop  = window.innerHeight - panel.offsetHeight;

          if (newLeft < 0) newLeft = 0;
          if (newLeft > maxLeft) newLeft = maxLeft;
          if (newTop < 0) newTop = 0;
          if (newTop > maxTop) newTop = maxTop;

          panel.style.left = newLeft + "px";
          panel.style.top = newTop + "px";
          panel.style.right = "auto";
          panel.style.bottom = "auto";
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
      }

      // Lógica de Minimização (Evita interferência do mousedown e adiciona rotação suave)
      const minBtn = document.getElementById("ea-min-btn");
      const contentArea = document.getElementById("ea-panel-content");

      if (minBtn && contentArea) {
        minBtn.onmousedown = (e) => {
          e.stopPropagation();
        };

        minBtn.onclick = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const isMinimized = contentArea.classList.contains('ea-minimizing');
          if (!isMinimized) {
            contentArea.style.maxHeight = contentArea.scrollHeight + 'px';
            void contentArea.offsetHeight;
            contentArea.classList.remove('ea-maximizing');
            contentArea.classList.add('ea-minimizing');
            minBtn.textContent = "+";
            minBtn.style.transform = "rotate(180deg)";
          } else {
            contentArea.classList.remove('ea-minimizing');
            contentArea.classList.add('ea-maximizing');
            contentArea.style.maxHeight = (contentArea.scrollHeight + 60) + 'px';
            minBtn.textContent = "−";
            minBtn.style.transform = "rotate(0deg)";
            setTimeout(() => {
              if (!contentArea.classList.contains('ea-minimizing')) {
                contentArea.style.maxHeight = 'none';
              }
            }, 380);
          }
        };
      }

      return panel;
    },

    renderContent(html) {
      const contentArea = document.getElementById('ea-panel-content');
      if (contentArea) {
        contentArea.innerHTML = `<div class="ea-fade-in">${html}</div>`;
      }
    },

    getDefaultStatus() {
      const storage = this.runtime?.services?.storage;
      if (!storage) return { text: '🛈 Modo com IA ativa', color: '#a6e3a1' };
      const apiKey = storage.getApiKey();
      const noAI = storage.getNoAI();
      const hasAI = Boolean(apiKey) && !noAI;

      return {
        text: hasAI ? '🛈 Modo com IA ativa' : 'ⓘ Modo de apenas leitura',
        color: hasAI ? '#a6e3a1' : '#f9e2af'
      };
    },

    setStatus(text, color = '#a6e3a1') {
      const statusEl = document.getElementById('ea-status');
      if (statusEl) {
        statusEl.textContent = text;
        statusEl.style.color = color;
      }
    },

    resetStatus() {
      const def = this.getDefaultStatus();
      this.setStatus(def.text, def.color);
    },

    updateAutoButton(active) {
      const autoBtn = document.getElementById('ea-auto-btn');
      if (autoBtn) {
        const storage = this.runtime.services.storage;
        const hasKey = Boolean(storage.getApiKey());
        if (active) {
          autoBtn.textContent = '⏹ Parar';
          autoBtn.style.background = '#f38ba8';
        } else {
          autoBtn.textContent = hasKey ? '▶ Iniciar' : '▶ Iniciar Auto-Página';
          autoBtn.style.background = '#89b4fa';
        }
      }
    },

    appendResult(text) {
      const resultEl = document.getElementById('ea-result');
      if (resultEl) {
        resultEl.textContent += text;
      }
    },

    // -------------------------------------------------------------
    // RENDERIZAÇÃO DAS TELAS DA INTERFACE
    // -------------------------------------------------------------
    renderSetupScreen() {
      const i = this.icons;
      this.renderContent(`
        <b style="color:#cba6f7;font-family: 'Manrope', sans-serif;font-weight: 700;font-size:16px;display:flex;align-items:center;gap:8px;">${i.svgChave} Chave da API</b>
        <p style="font-family: 'Inter', sans-serif;font-weight:400;margin:14px 0 8px;font-size:14px;color:#a6adc8;">Cole sua API Key do OpenRouter:</p>
        <div style="position: relative; width: 100%; box-sizing: border-box; margin: 0 0 6px 0; transform: translateY(-7px);">
          <input id="ea-inp" type="password" placeholder="sk-or-..." style="
            width:100%; box-sizing:border-box; padding:11px 42px 11px 12px;
            border:2px solid #6c5fc7; border-radius:8px; background:#11111b;
            color:#cdd6f4; font-family:'Inter', sans-serif; font-weight:500; letter-spacing:0.8px; font-size:14px; outline:none;
            display:block; text-align:left; margin:0;
          ">
          <button id="ea-toggle-eye" class="ea-eye-btn" style="
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; color: #6c7086; cursor: pointer;
            padding: 4px; display: flex; align-items: center; justify-content: center;
          " title="Mostrar/Ocultar chave">${i.svgOlhoFechado}</button>
        </div>
        <div id="ea-err" class="ea-error-box" style="width:100%;color:#f38ba8;font-size:12px;line-height:1.2;transform:translateY(-15px);opacity:0.90;"></div>
        <button id="ea-ok" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;border-radius:10px; font-family: 'Manrope', sans-serif;
          font-weight:700; background:#a6e3a1;color:#1e1e2e; font-size:14px;cursor:pointer; margin-top: -12px;
        ">Continuar</button>
        <button id="ea-noai" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;border-radius:10px; font-weight:600;
          background:#313244;color:#cdd6f4; font-size:14px;cursor:pointer;
        ">Não quero usar IA</button>
      `);

      const inputChave = document.getElementById('ea-inp');
      const err = document.getElementById('ea-err');
      const botaoOlho = document.getElementById('ea-toggle-eye');
      const storage = this.runtime.services.storage;

      inputChave.addEventListener('input', () => err.classList.remove('show'));

      botaoOlho.onclick = () => {
        if (inputChave.type === 'password') {
          inputChave.type = 'text';
          botaoOlho.innerHTML = i.svgOlhoAberto;
          botaoOlho.style.color = '#cba6f7';
        } else {
          inputChave.type = 'password';
          botaoOlho.innerHTML = i.svgOlhoFechado;
          botaoOlho.style.color = '#6c7086';
        }
      };

      document.getElementById('ea-ok').onclick = () => {
        const key = inputChave.value.trim();
        if (!key) {
          err.textContent = 'Insira uma API Key.';
          err.classList.add('show');
          return;
        }
        storage.setApiKey(key);
        storage.setNoAI(false);
        this.renderMainScreen();
      };

      document.getElementById('ea-noai').onclick = () => {
        storage.setNoAI(true);
        this.renderMainScreen();
      };
    },

    renderMainScreen() {
      const i = this.icons;
      const storage = this.runtime.services.storage;

      const domTitle = document.querySelector('span.book-title')?.title?.trim() ||
                       document.querySelector('span.book-title')?.textContent?.trim();
      if (domTitle) {
        storage.setBookTitle(domTitle);
      }

      const bookTitle = storage.getBookTitle() || domTitle || 'Modo leitura';
      const apiKey = storage.getApiKey();
      const defaultStatus = this.getDefaultStatus();

      const readerModule = typeof this.runtime?.getModule === 'function'
        ? this.runtime.getModule('reader')
        : this.runtime?.modules?.get('reader');

      const isRunning = Boolean(readerModule && readerModule.active);

      const buttonText = isRunning
        ? '⏹ Parar'
        : (apiKey ? '▶ Iniciar' : '▶ Iniciar Auto-Página');

      const buttonBg = isRunning ? '#f38ba8' : '#89b4fa';
      const statusText = isRunning ? 'Navegando...' : defaultStatus.text;
      const statusColor = isRunning ? '#89b4fa' : defaultStatus.color;

      this.renderContent(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <b style="color:#cba6f7;font-family: 'Plus Jakarta Sans', sans-serif;font-size:15px;letter-spacing: 0.3px;font-weight:600;display:flex;align-items:center;gap:8px;">${i.svgLivro} ${bookTitle}</b>
          <button id="ea-config-btn" class="ea-btn-icone ea-config-btn" title="Configurações" style="background:#313244;border:none;border-radius:8px;color:#cdd6f4;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;">${i.svgConfig}</button>
        </div>
        <div id="ea-status" style="font-size:14px;color:${statusColor};font-family:'Nunito Sans', sans-serif;font-weight:500;letter-spacing:0.2px;">${statusText}</div>

        <button id="ea-auto-btn" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none; font-family: 'Manrope', sans-serif;
          font-weight:700; border-radius:10px;background:${buttonBg};
          font-size:14px;cursor:pointer;color:#1e1e2e; transform:translateY(5px);
        ">${buttonText}</button>

        <div id="ea-result" style="max-height:300px;overflow:auto;font-size:12px;white-space:pre-wrap;color:#a6adc8;"></div>

        <button id="ea-reset-btn" class="ea-btn-animado" style="
          width:100%;padding:10px;border:none; font-weight:600; font-family: 'Inter', sans-serif;
          border-radius:10px;background:#45475a; font-size:13px;cursor:pointer;color:#cdd6f4;
        ">⚙ Reconfigurar</button>
      `);

      const autoBtn = document.getElementById('ea-auto-btn');
      const configBtn = document.getElementById('ea-config-btn');
      const resetBtn = document.getElementById('ea-reset-btn');

      // Emite COMANDOS de ação para o EventBus baseando-se no estado REAL do Reader
      autoBtn.onclick = () => {
        const currentReader = typeof this.runtime?.getModule === 'function'
          ? this.runtime.getModule('reader')
          : this.runtime?.modules?.get('reader');

        const activeNow = Boolean(currentReader && currentReader.active);

        if (activeNow) {
          this.runtime.events.sendCommand('command:reader:stop');
        } else {
          this.runtime.events.sendCommand('command:reader:start');
        }
      };

      configBtn.onclick = () => {
        this.renderConfigScreen();
      };

      resetBtn.onclick = () => {
        storage.resetAll();
        this.runtime.events.sendCommand('command:reader:stop');
        this.renderSetupScreen();
      };
    },

    renderConfigScreen() {
      const i = this.icons;
      const storage = this.runtime.services.storage;
      const modeloSalvo = storage.getSelectedModel() || 'cohere/north-mini-code:free';
      const minSalvo = storage.getAutoMinMin();
      const maxSalvo = storage.getAutoMaxMin();

      const presets = [
        'cohere/north-mini-code:free',
        'openai/gpt-oss-120b:free',
        'meta-llama/llama-3.3-70b-instruct:free'
      ];
      const isCustom = !presets.includes(modeloSalvo);
      const selectedValue = isCustom ? '__custom__' : modeloSalvo;

      this.renderContent(`
        <div style="display:flex;flex-direction:column;align-items:center;">
          <b style="color:#cba6f7;font-family:'Manrope', sans-serif;font-weight:700;letter-spacing:0.2px;font-size:16px;display:flex;align-items:center;gap:8px;">${i.svgConfig} Configurações</b>
          
          <p style="font-family: 'Inter', sans-serif;font-weight: 600;letter-spacing:0.2px;transform:translateY(9px);margin:14px 0 6px;font-size:15px;color:#a6adc8;width:100%;text-align:left;">Modelo de IA:</p>
          <select id="ea-model-select" style="width:100%;box-sizing:border-box;padding:9px 10px;border:2px solid #45475a;border-radius:8px;background:#11111b;color:#cdd6f4;font-family:monospace;font-size:13px;margin-bottom:8px;display:block;text-align:center;text-align-last:center;">
            <option value="cohere/north-mini-code:free" ${selectedValue === 'cohere/north-mini-code:free' ? 'selected' : ''}>Cohere: North Mini Code (free)</option>
            <option value="openai/gpt-oss-120b:free" ${selectedValue === 'openai/gpt-oss-120b:free' ? 'selected' : ''}>OpenAI: gpt-oss-120b (free)</option>
            <option value="meta-llama/llama-3.3-70b-instruct:free" ${selectedValue === 'meta-llama/llama-3.3-70b-instruct:free' ? 'selected' : ''}>Meta: Llama 3.3 70B Instruct (free)</option>
            <option value="__custom__" ${isCustom ? 'selected' : ''}>Outro (digitar manualmente)</option>
          </select>

          <input id="ea-custom-model-input" type="text" placeholder="provider/nome-do-modelo:free" value="${isCustom ? modeloSalvo : ''}" style="width:100%;box-sizing:border-box;padding:9px 10px;border:2px solid #45475a;border-radius:8px;background:#11111b;color:#89b4fa;font-family:Inter,sans-serif;font-size:12px;margin-bottom:6px;display:${isCustom ? 'block' : 'none'};text-align:left;">

          <div style="font-size:11px;color:#6c7086;margin-bottom:4px;width:100%;text-align:left;">
            Mais modelos em: <a href="https://openrouter.ai/models" target="_blank" style="color:#89b4fa;text-decoration:none;">openrouter.ai/models</a>
          </div>

          <div style="width:100%;border-top:1px solid #313244;margin:14px 0;"></div>

          <p style="margin:0 0 8px;font-size:15px;color:#a6adc8;width:100%;text-align:left;font-family: 'Inter', sans-serif;font-weight: 600;letter-spacing:0.3px;transform:translateY(9px);">Intervalo de auto-página (minutos):</p>
          <div style="display:flex;align-items:center;gap:10px;width:100%;margin-bottom:4px;">
            <input id="ea-min-input" type="text" inputmode="decimal" value="${minSalvo}" style="flex:1 1 0;min-width:0;height:48px;padding:0 12px;border:2px solid #45475a;border-radius:8px;background:#11111b;color:#cdd6f4;font-family:Inter,sans-serif;font-size:15px;font-weight:500;line-height:48px;text-align:center;box-sizing:border-box;outline:none;">
            <span style="color:#a6adc8;font-weight:600;font-family:'Manrope',sans-serif;flex-shrink:0;">a</span>
            <input id="ea-max-input" type="text" inputmode="decimal" value="${maxSalvo}" style="flex:1 1 0;min-width:0;height:48px;padding:0 12px;border:2px solid #45475a;border-radius:8px;background:#11111b;color:#cdd6f4;font-family:Inter,sans-serif;font-size:15px;font-weight:500;line-height:48px;text-align:center;box-sizing:border-box;outline:none;">
          </div>
          <div id="ea-interval-err" style="color:#f38ba8;font-size:12px;min-height:0;margin-bottom:2px;width:100%;transform:translateY(-7px);opacity:0.90;"></div>

          <button id="ea-model-save" class="ea-btn-animado" style="width:100%;padding:11px;border:none;border-radius:10px;background:#a6e3a1;color:#1e1e2e;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px;">💾 Salvar</button>
          <button id="ea-model-back" class="ea-btn-animado" style="width:100%;padding:10px;border:none;border-radius:10px;background:#45475a;color:#cdd6f4;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">${i.svgVoltar} Voltar</button>
        </div>
      `);

      const selectEl = document.getElementById('ea-model-select');
      const customInput = document.getElementById('ea-custom-model-input');
      const saveBtn = document.getElementById('ea-model-save');
      const backBtn = document.getElementById('ea-model-back');

      selectEl.onchange = () => {
        if (selectEl.value === '__custom__') {
          customInput.style.display = 'block';
        } else {
          customInput.style.display = 'none';
        }
      };

      saveBtn.onclick = () => {
        let modeloFinal = selectEl.value;
        if (modeloFinal === '__custom__') {
          modeloFinal = customInput.value.trim();
          if (!modeloFinal) {
            document.getElementById('ea-interval-err').textContent = 'Digite o nome do modelo customizado.';
            return;
          }
        }

        const minVal = parseFloat(document.getElementById('ea-min-input').value.replace(',', '.'));
        const maxVal = parseFloat(document.getElementById('ea-max-input').value.replace(',', '.'));

        if (isNaN(minVal) || isNaN(maxVal) || minVal < 0.5 || maxVal > 60 || minVal >= maxVal) {
          document.getElementById('ea-interval-err').textContent = 'Insira intervalos válidos (mín 0.5, máx 60).';
          return;
        }

        storage.setSelectedModel(modeloFinal);
        storage.setAutoMinMin(minVal);
        storage.setAutoMaxMin(maxVal);

        this.renderMainScreen();
      };

      backBtn.onclick = () => this.renderMainScreen();
    }
  };

  // Registrar módulo no Runtime se disponível
  if (window.ElefanteRuntime) {
    window.ElefanteRuntime.registerModule(UIModule);
  } else {
    window.ElefanteUIModule = UIModule;
  }

})();
