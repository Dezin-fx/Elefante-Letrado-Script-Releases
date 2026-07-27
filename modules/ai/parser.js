/**
 * Elefante Assistente de Estudo - Parsers do Módulo IA
 * Processador e limpador de respostas fornecidas pelos modelos de IA.
 */

(function () {
  'use strict';

  window.ElefanteAIParser = {
    parseResponse({ rawText, type }) {
      if (!rawText) {
        throw new Error('Resposta vazia retornada pela IA.');
      }

      if (type === 'dissertativa') {
        // Limpa aspas, travessões extras e prefácios acidentais
        const cleaned = rawText
          .replace(/^[""\u201C\u201D''\u2018\u2019]+|[""\u201C\u201D''\u2018\u2019]+$/g, '')
          .replace(/^(Resposta:|Resposta\s*-):?/i, '')
          .trim();

        return {
          type: 'dissertativa',
          answer: cleaned,
          raw: rawText
        };
      }

      // Parsing de Múltipla Escolha (Procura por Resposta: [A/B/C/D])
      const match = rawText.match(/Resposta:\s*\[?([A-D])\]?/i);
      const choice = match ? match[1].toUpperCase() : null;

      // Extrai a explicação se houver
      const explMatch = rawText.match(/Explicação:\s*(.*)/i);
      const explanation = explMatch ? explMatch[1].trim() : '';

      if (!choice) {
        throw new Error(`Não foi possível extrair uma alternativa válida (A/B/C/D) da resposta da IA.`);
      }

      return {
        type: 'multipla',
        choice: choice,
        explanation: explanation,
        raw: rawText
      };
    }
  };

})();
