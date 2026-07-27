/**
 * Elefante Assistente de Estudo - Módulo IA v1.0.0
 * Gerenciador de requisições HTTP (OpenRouter), prompts e parsing de respostas.
 * Totalmente isolado do DOM e da Interface de Usuário.
 */

(function () {
  'use strict';

  const AIModule = {
    name: 'ai',
    version: '1.0.0',
    depends: [],

    async init(runtime) {
      this.runtime = runtime;
      this.prompts = window.ElefanteAIPrompts || {};
      this.parser = window.ElefanteAIParser || {};

      // Registra a implementação do serviço abstrato no Runtime
      runtime.registerService('ai', {
        ask: (params) => this.askAI(params)
      });
    },

    async start() {
      console.log('[🤖 AI Module] Provedor de IA pronto.');
    },

    async stop() {
      console.log('[🤖 AI Module] Provedor de IA desativado.');
    },

    // -------------------------------------------------------------
    // LÓGICA CORE DE PROCESSAMENTO DE IA
    // -------------------------------------------------------------
    async askAI({ question, options = [], context = '', type = 'multipla' }) {
      const storage = this.runtime.services.storage;
      const apiKey = storage.getApiKey();
      const model = storage.getSelectedModel();
      const bookTitle = context || storage.getBookTitle() || '';

      if (!apiKey) {
        const err = new Error('Chave da API OpenRouter não configurada.');
        this.runtime.events.emit('ai:request:error', { error: err.message });
        throw err;
      }

      // 1. Emite evento informando início da requisição
      this.runtime.events.emit('ai:request:start', { type, model });

      // 2. Constrói o prompt adequado
      let promptText;
      if (type === 'dissertativa') {
        promptText = this.prompts.buildDissertativaPrompt({ question, bookTitle });
      } else {
        promptText = this.prompts.buildMultiplaEscolhaPrompt({ question, options, bookTitle });
      }

      try {
        // 3. Executa a requisição HTTP com limite de tempo (30s)
        const rawResponseText = await this.executeOpenRouterRequest({
          apiKey,
          model,
          promptText
        });

        // 4. Executa o parsing da resposta bruta
        const parsedResult = this.parser.parseResponse({
          rawText: rawResponseText,
          type
        });

        parsedResult.model = model;

        // 5. Emite evento de sucesso
        this.runtime.events.emit('ai:request:success', parsedResult);
        return parsedResult;

      } catch (err) {
        console.error('[🤖 AI Module Error]', err.message);
        this.runtime.events.emit('ai:request:error', { error: err.message });
        throw err;
      }
    },

    executeOpenRouterRequest({ apiKey, model, promptText }) {
      return new Promise((resolve, reject) => {
        let timeoutId;

        const timeoutPromise = new Promise((_, rej) => {
          timeoutId = setTimeout(() => rej(new Error('Tempo limite excedido na resposta da IA (30s)')), 30000);
        });

        const requestPromise = new Promise((res, rej) => {
          GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            data: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: 'Responda sempre em português do Brasil. Não dê tantos detalhes. Responda somente no formato pedido.'
                },
                { role: 'user', content: promptText }
              ],
              temperature: 0
            }),
            onload: response => {
              try {
                const data = JSON.parse(response.responseText);
                if (data.error) {
                  rej(new Error(`API OpenRouter: ${data.error.message}`));
                  return;
                }
                const content = data.choices?.[0]?.message?.content;
                if (!content) {
                  rej(new Error('Resposta vazia retornada pela IA.'));
                  return;
                }
                res(content);
              } catch (e) {
                rej(new Error('Erro ao processar JSON retornado pela API da IA.'));
              }
            },
            onerror: () => rej(new Error('Erro de conexão com a rede OpenRouter.'))
          });
        });

        Promise.race([requestPromise, timeoutPromise])
          .then(result => { clearTimeout(timeoutId); resolve(result); })
          .catch(err => { clearTimeout(timeoutId); reject(err); });
      });
    }
  };

  // Registrar módulo no Runtime se disponível
  if (window.ElefanteRuntime) {
    window.ElefanteRuntime.registerModule(AIModule);
  } else {
    window.ElefanteAIModule = AIModule;
  }

})();
