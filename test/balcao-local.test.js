// Teste contra um Balcão rodando de verdade (docker compose up no repositório do Balcão).
// Rode com: BALCAO_URL=http://localhost:8080 BALCAO_TOKEN=... node --test
// Sem essas variáveis, o teste é pulado.

const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./simulador');

const url = process.env.BALCAO_URL;
const token = process.env.BALCAO_TOKEN;

test('lê os pedidos do Balcão e escreve a planilha', { skip: !url || !token ? 'sem BALCAO_URL/BALCAO_TOKEN' : false }, () => {
  const emails = [];
  const { gs, planilha } = carregar({ propriedades: { BALCAO_URL: url, BALCAO_TOKEN: token, EMAIL_RESUMO: 'teste@exemplo.com' }, emails });

  gs.enviarResumo();

  const pedidos = planilha.abas.Pedidos;
  assert.equal(pedidos.valor(1, 2), 'Cliente');
  assert.ok(pedidos.valor(2, 1) > 0, 'a aba Pedidos ficou vazia');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'teste@exemplo.com');
  console.log('Assunto do e-mail:', emails[0].subject);
  if (process.env.FATURAMENTO_ESPERADO) {
    assert.equal(planilha.abas.Resumo.valor(2, 2), Number(process.env.FATURAMENTO_ESPERADO));
  }
});
