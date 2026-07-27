/**
 * Elefante Assistente de Estudo - Prompts do Módulo IA
 * Gerenciador e construtor de prompts para diferentes tipos de questões.
 */

(function () {
  'use strict';

  window.ElefanteAIPrompts = {
    buildDissertativaPrompt({ question, bookTitle }) {
      return `Você é especialista no livro "${bookTitle || 'da leitura'}".
Responda a pergunta abaixo em português, com entre 10 e 100 palavras. Seja direto e preciso.
Responda apenas com o texto da resposta, sem introdução, sem "Resposta:", sem formatação extra.

Pergunta: ${question}

REGRAS ABSOLUTAS:
- Comece a resposta diretamente, sem introdução
- Não use "Resposta:", "Claro!", "Aqui está" ou qualquer prefácio
- Não use marcadores, listas ou formatação
- Mínimo 10 palavras, máximo 80 palavras
- Não use -, ─ ou qualquer sinal que não seja , . : ; e acentuações`;
    },

    buildMultiplaEscolhaPrompt({ question, options, bookTitle }) {
      const opcoesTexto = options.map(o => `${o.letra}. ${o.texto}`).join('\n');

      return `Você é especialista no livro "${bookTitle || 'da leitura'}".

Analise com extremo cuidado.

Pergunta:
${question}

Alternativas:
${opcoesTexto}

INSTRUÇÕES IMPORTANTES:
- Leia TODAS as alternativas antes de decidir
- Compare cada alternativa com a pergunta

Formato obrigatório:
Resposta: [A/B/C/D]
Explicação: [uma breve explicação em português]

Não escreva nada antes de "Resposta:".
Depois, verifique: "A resposta realmente responde a pergunta?"
Se não, escolha outra.`;
    }
  };

})();
