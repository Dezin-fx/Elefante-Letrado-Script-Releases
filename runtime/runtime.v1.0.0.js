/**
 * Elefante Assistente de Estudo - Core Runtime v1.0.0
 * Orquestrador central e Sistema Operacional da plataforma de Userscript.
 */

(function () {
  'use strict';

  class EventBus {
    constructor() {
      this.listeners = new Map();
      this.commandHandlers = new Map();
    }

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(handler);
    }

    emit(event, payload = null) {
      console.log(`[📡 EventBus] Evento: "${event}"`, payload || '');
      if (!this.listeners.has(event)) return;
      this.listeners.get(event).forEach(handler => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[📡 EventBus] Erro no listener de "${event}":`, err);
        }
      });
    }

    handleCommand(command, handler) {
      this.commandHandlers.set(command, handler);
    }

    sendCommand(command, payload = null) {
      console.log(`[⚡ Command] Comando: "${command}"`, payload || '');
      const handler = this.commandHandlers.get(command);
      if (!handler) {
        console.warn(`[⚡ Command] Nenhum handler para comando: "${command}"`);
        return;
      }
      try {
        return handler(payload);
      } catch (err) {
        console.error(`[⚡ Command] Erro ao executar "${command}":`, err);
      }
    }
  }

  function resolveDependencyOrder(modulesMap) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(name) {
      if (visiting.has(name)) {
        throw new Error(`[TopologicalSort] Ciclo de dependência circular: "${name}"`);
      }
      if (!visited.has(name)) {
        visiting.add(name);
        const moduleDef = modulesMap.get(name);
        const depends = moduleDef?.depends || [];

        for (const dep of depends) {
          if (!modulesMap.has(dep)) {
            throw new Error(`[TopologicalSort] Módulo "${name}" exige dependência "${dep}", mas ela não foi registrada.`);
          }
          visit(dep);
        }

        visiting.delete(name);
        visited.add(name);
        sorted.push(name);
      }
    }

    for (const name of modulesMap.keys()) {
      visit(name);
    }

    return sorted;
  }

  class ElefanteRuntime {
    constructor() {
      this.version = "1.0.0";
      this.events = new EventBus();
      this.services = {};
      this.serviceStates = new Map();
      this.modules = new Map();
      this.states = new Map();
      this.started = false;

      // Safe Proxy de Serviços
      this.services = new Proxy({}, {
        get: (target, prop) => {
          if (!(prop in target)) {
            return new Proxy({}, {
              get: () => () => {
                throw new Error(`[⚙️ Runtime Error] Serviço "${String(prop)}" indisponível.`);
              }
            });
          }
          if (this.serviceStates.get(prop) === 'FAILED') {
            throw new Error(`[⚙️ Runtime Error] Serviço "${String(prop)}" em estado FAILED.`);
          }
          return target[prop];
        }
      });

      // Storage Nativo Encapsulado
      this.registerService('storage', {
        getApiKey: () => GM_getValue('apiKey', ''),
        setApiKey: (k) => GM_setValue('apiKey', k),
        getBookTitle: () => GM_getValue('bookTitle', ''),
        setBookTitle: (t) => GM_setValue('bookTitle', t),
        getNoAI: () => GM_getValue('noAI', false),
        setNoAI: (v) => GM_setValue('noAI', Boolean(v)),
        getSelectedModel: () => GM_getValue('selectedModel', 'cohere/north-mini-code:free'),
        setSelectedModel: (m) => GM_setValue('selectedModel', m),
        getAutoMinMin: () => GM_getValue('autoMinMin', 2),
        getAutoMaxMin: () => GM_getValue('autoMaxMin', 3),
        setAutoMinMin: (v) => GM_setValue('autoMinMin', v),
        setAutoMaxMin: (v) => GM_setValue('autoMaxMin', v),
        resetAll: () => {
          GM_setValue('apiKey', '');
          GM_setValue('bookTitle', '');
          GM_setValue('noAI', false);
        }
      });
    }

    registerService(name, serviceImpl) {
      this.services[name] = serviceImpl;
      this.serviceStates.set(name, 'READY');
      console.log(`[⚙️ Runtime] Serviço registrado: "services.${name}"`);
    }

    registerModule(moduleDef) {
      if (!moduleDef.name) {
        throw new Error('[⚙️ Runtime] Módulo sem propriedade "name".');
      }
      this.modules.set(moduleDef.name, moduleDef);
      this.states.set(moduleDef.name, 'UNINITIALIZED');
      console.log(`[⚙️ Runtime] Módulo "${moduleDef.name}" v${moduleDef.version || '1.0.0'} registrado.`);
    }

    async bootFromManifest(manifest, baseUrl) {
      console.log(`\n======================================================`);
      console.log(`🚀 RUNTIME v${this.version} - BOOT DO MANIFESTO (${manifest.channel})`);
      console.log(`======================================================\n`);

      const moduleEntries = Object.entries(manifest.modules || {});

      // 1. Download e Injeção de Módulos
      for (const [name, info] of moduleEntries) {
        try {
          const fullUrl = /^https?:\/\//i.test(info.file)
            ? info.file
            : baseUrl.replace(/\/+$/, '/') + info.file.replace(/^\/+/, '');

          console.log(`[⚙️ Runtime] Carregando módulo "${name}" de: ${fullUrl}`);
          const code = await this.fetchText(fullUrl);
          this.injectScript(code, `module-${name}`);
        } catch (err) {
          console.error(`❌ [⚙️ Runtime] Falha ao baixar módulo "${name}":`, err);
        }
      }

      // 2. Dispara a inicialização por ordem de dependências
      await this.startAll();
    }

    injectScript(code, id) {
      const script = document.createElement('script');
      if (id) script.id = id;
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
    }

    fetchText(url) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          onload: r => r.status === 200 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
          onerror: err => reject(err)
        });
      });
    }

    async startAll() {
      let initOrder = [];
      try {
        initOrder = resolveDependencyOrder(this.modules);
        console.log('🔗 Ordem calculada:', initOrder.join(' ➔ '));
      } catch (err) {
        console.error(`❌ [⚙️ Runtime Fatal] ${err.message}`);
        return false;
      }

      // Phase 1: INIT
      for (const name of initOrder) {
        const mod = this.modules.get(name);
        const depends = mod.depends || [];
        const hasFailedDep = depends.some(dep => this.states.get(dep) === 'FAILED' || this.states.get(dep) === 'BLOCKED');

        if (hasFailedDep) {
          console.warn(`🔒 [⚙️ Runtime] Módulo "${name}" marcado como BLOCKED.`);
          this.states.set(name, 'BLOCKED');
          continue;
        }

        try {
          if (typeof mod.init === 'function') {
            await mod.init(this);
          }
          this.states.set(name, 'INITIALIZED');
        } catch (err) {
          console.error(`❌ [⚙️ Runtime Error] Init falhou em "${name}":`, err.message);
          this.states.set(name, 'FAILED');
        }
      }

      // Phase 2: START
      for (const name of initOrder) {
        const st = this.states.get(name);
        if (st === 'FAILED' || st === 'BLOCKED') continue;

        const mod = this.modules.get(name);
        try {
          if (typeof mod.start === 'function') {
            await mod.start();
          }
          this.states.set(name, 'STARTED');
        } catch (err) {
          console.error(`❌ [⚙️ Runtime Error] Start falhou em "${name}":`, err.message);
          this.states.set(name, 'FAILED');
        }
      }

      this.started = true;
      console.log('\n✅ Boot Concluído com Sucesso!\n');
      return true;
    }

    async stopAll() {
      for (const [name, mod] of this.modules.entries()) {
        if (this.states.get(name) === 'STARTED' && typeof mod.stop === 'function') {
          try {
            await mod.stop();
            this.states.set(name, 'INITIALIZED');
          } catch (err) {
            console.error(`❌ Erro ao parar "${name}":`, err);
          }
        }
      }
      this.started = false;
    }
  }

  window.ElefanteRuntime = window.ElefanteRuntime || new ElefanteRuntime();

})();
