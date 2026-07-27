/**
 * Elefante Assistente de Estudo - Módulo Quiz v1.0.0
 * Responsável por capturar o modal de quiz no DOM, extrair dados, solicitar resolução à IA e preencher respostas.
 * Totalmente desacoplado da UI e do gerenciamento de paginação do Reader.
 */

(function () {
  'use strict';

  const QuizModule = {
    name: 'quiz',
    version: '1.0.0',
    depends: ['ai'],

    observer: null,
    debounceTimer: null,
    quizProcessando: false,

    async init(runtime) {
      this.runtime = runtime;
    },

    async start() {
      console.log('[🧠 Quiz Module] Iniciando observação do DOM para quizzes...');
      this.setupObserver();
    },

    async stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      console.log('[🧠 Quiz Module] Observador de Quiz desativado.');
    },

    // -------------------------------------------------------------
    // MONITORAMENTO DO DOM (MUTATION OBSERVER)
    // -------------------------------------------------------------
    setupObserver() {
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver(() => {
        if (this.quizProcessando) return;

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.checkDOMState();
        }, 300);
      });

      this.observer.observe(document.body, { childList: true, subtree: true });
    },

    async checkDOMState() {
      if (this.quizProcessando) return;

      // 1. Checa se é a tela final de resultado (botão "Continuar")
      const continuarBtn = this.detectarTelaFinal();
      if (continuarBtn) {
        console.log('[🧠 Quiz Module] Tela final do quiz detectada. Clicando em Continuar...');
        continuarBtn.click();

        const esperarFechar = setInterval(() => {
          if (!this.getModal()) {
            clearInterval(esperarFechar);
            this.runtime.events.emit('quiz:closed');
          }
        }, 300);
        return;
      }

      // 2. Extrai dados do quiz
      const quizData = this.extrair();
      if (!quizData) return;

      // Se encontrou um quiz válido e não está processando, inicia a resolução
      this.processQuiz(quizData);
    },

    // -------------------------------------------------------------
    // FLUXO DE PROCESSAMENTO E RESOLUÇÃO DO QUIZ
    // -------------------------------------------------------------
    async processQuiz(quizData) {
      if (this.quizProcessando) return;
      this.quizProcessando = true;

      // Desconecta o observer temporariamente durante o processamento
      if (this.observer) this.observer.disconnect();

      // Notifica o sistema que um quiz foi aberto
      this.runtime.events.emit('quiz:opened', { type: quizData.tipo });

      try {
        const storage = this.runtime.services.storage;
        const bookTitle = storage.getBookTitle() || '';

        console.log(`[🧠 Quiz Module] Enviando questão para o serviço de IA (${quizData.tipo})...`);

        // Consome a IA através da abstração do serviço do Runtime
        const result = await this.runtime.services.ai.ask({
          question: quizData.pergunta,
          options: quizData.opcoes || [],
          context: bookTitle,
          type: quizData.tipo
        });

        console.log('[🧠 Quiz Module] Resultado recebido da IA:', result);

        if (quizData.tipo === 'dissertativa') {
          this.colarRespostaDissertativa(result.answer);
          await this.confirmarDissertativa();
        } else {
          await this.marcarAlternativaMultipla(result.choice);
        }

        // Emite evento de sucesso
        this.runtime.events.emit('quiz:solved', { answer: result.choice || result.answer });

      } catch (err) {
        console.error('[🧠 Quiz Module Error]', err.message);
        this.runtime.events.emit('quiz:error', { error: err.message });
      } finally {
        this.quizProcessando = false;
        // Reconecta o observer para monitorar próximas questões/fechamento
        this.setupObserver();
      }
    },

    // -------------------------------------------------------------
    // PARSING E INTERAÇÃO COM ELEMENTOS DO DOM
    // -------------------------------------------------------------
    getModal() {
      return document.querySelector('ngb-modal-window.quiz-modal') ||
             document.querySelector('[role="dialog"]');
    },

    detectarTelaFinal() {
      const modal = this.getModal();
      if (!modal) return null;
      const todosFund2 = [...modal.querySelectorAll('button.fund2-button')];
      if (todosFund2.length === 0) return null;
      const temW50 = todosFund2.some(b => b.classList.contains('w-50'));
      if (temW50) return null;
      return todosFund2.find(b => b.textContent.includes('Continuar')) || null;
    },

    extrair() {
      const modal = this.getModal();
      if (!modal) return null;

      const textarea = modal.querySelector('textarea.form-control');
      if (textarea) {
        const pergunta = modal.querySelector('h6')?.innerText?.trim() || '';
        if (pergunta) return { tipo: 'dissertativa', pergunta };
        return null;
      }

      const linhas = modal.innerText
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l =>
          !/^quiz$/i.test(l) &&
          !/^x$/i.test(l) &&
          !/^[1-9]$/.test(l) &&
          !/confirmar|voltar|próxima|proxima|continuar|biblioteca|analisar/i.test(l)
        );

      const opcoes = [];
      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const match = linha.match(/^([A-D])\.\s*(.*)$/);
        if (match) {
          let texto = match[2].trim();
          if (!texto && linhas[i + 1]) texto = linhas[i + 1].trim();
          opcoes.push({ letra: match[1], texto });
        }
      }

      if (opcoes.length < 2) return null;

      const indexA = linhas.findIndex(l => /^A\./.test(l));
      const pergunta = linhas.slice(0, indexA).join(' ').trim();

      if (!pergunta || pergunta.toLowerCase() === 'quiz') return null;

      return { tipo: 'multipla', pergunta, opcoes: opcoes.slice(0, 4) };
    },

    colarRespostaDissertativa(texto) {
      const modal = this.getModal();
      if (!modal) return;
      const textarea = modal.querySelector('textarea.form-control');
      if (!textarea) return;

      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(textarea, texto);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    },

    async marcarAlternativaMultipla(letra) {
      const modal = this.getModal();
      if (!modal || !letra) return;

      const btnAlternativa = [...modal.querySelectorAll('button.answer-btn')]
        .find(b => b.querySelector('h5')?.textContent.trim().startsWith(letra));

      if (btnAlternativa) {
        console.log(`[🧠 Quiz Module] Clicando na alternativa ${letra}...`);
        btnAlternativa.click();

        await new Promise(r => setTimeout(r, 1000));
        const btnConfirmar = modal.querySelector('button.fund2-button.w-50:not(.disabled):not([disabled])');
        if (btnConfirmar) {
          console.log('[🧠 Quiz Module] Clicando no botão Confirmar...');
          btnConfirmar.click();
        }
      }
    },

    async confirmarDissertativa() {
      const btnAnalisar = await this.aguardarBotao('Analisar com IA', 5000);
      if (btnAnalisar) {
        btnAnalisar.click();
      }

      const btnProxima = await new Promise((resolve) => {
        const inicio = Date.now();
        const intervalo = setInterval(() => {
          const modal = this.getModal();
          if (!modal) { clearInterval(intervalo); resolve(null); return; }
          const btn = modal.querySelector('button.fund2-button.w-50:not(.disabled):not([disabled])');
          if (btn) { clearInterval(intervalo); resolve(btn); return; }
          if (Date.now() - inicio > 10000) { clearInterval(intervalo); resolve(null); }
        }, 200);
      });

      if (btnProxima) btnProxima.click();
    },

    aguardarBotao(textoBotao, timeoutMs = 5000) {
      return new Promise((resolve) => {
        const inicio = Date.now();
        const intervalo = setInterval(() => {
          const modal = this.getModal();
          if (!modal) { clearInterval(intervalo); resolve(null); return; }

          const btn = [...modal.querySelectorAll('button')]
            .find(b =>
              b.textContent.trim().includes(textoBotao) &&
              !b.disabled &&
              !b.classList.contains('disabled')
            );

          if (btn) { clearInterval(intervalo); resolve(btn); return; }
          if (Date.now() - inicio > timeoutMs) { clearInterval(intervalo); resolve(null); }
        }, 200);
      });
    }
  };

  // Registrar módulo no Runtime se disponível
  if (window.ElefanteRuntime) {
    window.ElefanteRuntime.registerModule(QuizModule);
  } else {
    window.ElefanteQuizModule = QuizModule;
  }

})();
