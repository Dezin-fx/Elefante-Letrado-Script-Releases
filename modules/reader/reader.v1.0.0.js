/**
 * Elefante Letrado Script- Módulo Reader v1.0.0
 * Responsável pelo temporizador aleatório e automação da virada de página (ArrowRight).
 * Totalmente desacoplado da UI e de chamadas diretas de outros módulos.
 */

(function () {
  'use strict';

  const ReaderModule = {
    name: 'reader',
    version: '1.0.0',
    depends: [],

    // Estado interno do módulo (não vazado para a UI)
    active: false,
    timer: null,
    wasActiveBeforeQuiz: false,

    async init(runtime) {
      this.runtime = runtime;

      // 1. Handlers de COMANDOS DE AÇÃO (Intenção externa)
      runtime.events.handleCommand('command:reader:start', () => {
        this.startReading();
      });

      runtime.events.handleCommand('command:reader:stop', () => {
        this.stopReading('Solicitação direta do usuário');
      });

      // 2. Escuta EVENTOS DE DOMÍNIO para auto-pausa e retomada
      runtime.events.on('quiz:opened', () => {
        if (this.active) {
          this.wasActiveBeforeQuiz = true;
          this.stopReading('Quiz aberto no leitor');
        }
      });

      runtime.events.on('quiz:closed', () => {
        if (this.wasActiveBeforeQuiz) {
          this.wasActiveBeforeQuiz = false;
          console.log('[📖 Reader] Retomando autopaginação após término do Quiz...');
          this.startReading();
        }
      });

      // Captura o título do livro do DOM automaticamente
      const checkBookTitle = () => {
        const titleEl = document.querySelector('span.book-title');
        const title = titleEl?.title?.trim() || titleEl?.textContent?.trim();
        if (title) {
          runtime.services.storage.setBookTitle(title);
          runtime.events.emit('reader:book-found', { title });
          return true;
        }
        return false;
      };

      if (!checkBookTitle()) {
        const observer = new MutationObserver(() => {
          if (checkBookTitle()) {
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    },

    async start() {
      console.log('[📖 Reader] Módulo de leitura pronto.');
    },

    async stop() {
      this.stopReading('Desativação do módulo');
    },

    // -------------------------------------------------------------
    // LÓGICA CORE DE LEITURA
    // -------------------------------------------------------------
    startReading() {
      if (this.active) return;
      this.active = true;
      console.log('[📖 Reader] ▶ Autopaginação ATIVADA!');

      // Notifica o sistema que a leitura começou
      this.runtime.events.emit('reader:started');

      // Executa o primeiro tick IMEDIATAMENTE (igual ao script original)
      // O tick vira a página na hora e depois agenda a próxima virada
      this.tick();
    },

    stopReading(reason = 'Parada') {
      if (!this.active) return;
      this.active = false;

      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }

      console.log(`[📖 Reader] ⏹ Autopaginação PAUSADA. Motivo: ${reason}`);

      // Notifica o sistema que a leitura parou
      this.runtime.events.emit('reader:stopped', { reason });
    },

    scheduleNextTick() {
      if (!this.active) return;

      const storage = this.runtime.services.storage;
      const minMin = storage.getAutoMinMin ? storage.getAutoMinMin() : 2;
      const maxMin = storage.getAutoMaxMin ? storage.getAutoMaxMin() : 3;

      const minMs = Math.max(0.5, minMin) * 60000;
      const maxMs = Math.min(60, maxMin) * 60000;
      const delay = Math.random() * (maxMs - minMs) + minMs;

      console.log(`[📖 Reader] Próxima página em ${(delay / 1000).toFixed(1)}s (entre ${minMin}m e ${maxMin}m)`);

      this.timer = setTimeout(() => {
        this.tick();
      }, delay);
    },

    tick() {
      if (!this.active) return;

      // Trava de segurança: Se houver quiz visível, não troca a página
      if (!this.isQuizModalOpen()) {
        this.triggerPageTurn();
      } else {
        console.warn('[📖 Reader] Trava acionada: Quiz visível no DOM. Pulando virada de página.');
      }

      // Reagenda a próxima página se continuar ativo
      if (this.active) {
        this.scheduleNextTick();
      }
    },

    triggerPageTurn() {
      console.log('[📖 Reader] ➡️ Disparando tecla ArrowRight no leitor...');
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39,
        which: 39,
        bubbles: true
      });
      document.body.dispatchEvent(evt);
      document.dispatchEvent(evt);
    },

    isQuizModalOpen() {
      const modal = document.querySelector('ngb-modal-window.quiz-modal') ||
                    document.querySelector('[role="dialog"]');
      if (!modal) return false;
      const buttons = [...modal.querySelectorAll('button')]
        .map(b => b.textContent.trim())
        .filter(t => t.length > 5 && !/confirmar|voltar|próxima|continuar/i.test(t));
      return buttons.length >= 2;
    }
  };

  // Registrar módulo no Runtime se disponível
  if (window.ElefanteRuntime) {
    window.ElefanteRuntime.registerModule(ReaderModule);
  } else {
    window.ElefanteReaderModule = ReaderModule;
  }

})();
