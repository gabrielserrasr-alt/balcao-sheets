const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./simulador');

const HOJE = new Date(2026, 10, 15, 10, 0, 0); // 15/11/2026 10h
const DIA = 24 * 60 * 60 * 1000;
const ha = (dias) => {
  const d = new Date(HOJE.getTime() - dias * DIA);
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}:00`;
};
const pedido = (campos) => ({
  id: 1, cliente: 'Padaria', cliente_telefone: '(11) 90000-0001', cliente_email: 'p@exemplo.com',
  descricao: 'Site', valor: 1000, status: 'pendente', criado_em: ha(0), atualizado_em: ha(0), ...campos,
});
const { gs } = carregar();
const tipo = (campos) => (gs.avaliarPedido(pedido(campos), HOJE) || { tipo: null }).tipo;

test('pendente: lembra o pagamento depois de 3 dias', () => {
  assert.equal(tipo({ criado_em: ha(3), atualizado_em: ha(3) }), null);
  assert.equal(tipo({ criado_em: ha(4), atualizado_em: ha(4) }), 'cobrar');
});

test('pendente parado há mais de 30 dias é esquecido, e diz se dá para resgatar', () => {
  const resgatavel = gs.avaliarPedido(pedido({ criado_em: ha(40), atualizado_em: ha(40) }), HOJE);
  assert.equal(resgatavel.tipo, 'esquecido');
  assert.match(resgatavel.motivo, /Os dois lados esqueceram/);
  assert.match(resgatavel.acao, /Dá para resgatar/);

  const perdido = gs.avaliarPedido(pedido({ criado_em: ha(90), atualizado_em: ha(90) }), HOJE);
  assert.match(perdido.acao, /Provavelmente perdido/);

  const semContato = gs.avaliarPedido(pedido({ criado_em: ha(40), atualizado_em: ha(40), cliente_telefone: null, cliente_email: null }), HOJE);
  assert.match(semContato.acao, /sem telefone e sem e-mail/);
});

test('pendente antigo mas mexido há pouco não é esquecido', () => {
  assert.equal(tipo({ criado_em: ha(40), atualizado_em: ha(2) }), 'cobrar');
});

test('pago: prazo de entrega cresce com o valor', () => {
  assert.equal(tipo({ status: 'pago', valor: 800, criado_em: ha(8) }), 'atrasado');    // até R$ 1.000: 7 dias
  assert.equal(tipo({ status: 'pago', valor: 3000, criado_em: ha(8) }), null);         // até R$ 5.000: 15 dias
  assert.equal(tipo({ status: 'pago', valor: 3000, criado_em: ha(16) }), 'atrasado');
  assert.equal(tipo({ status: 'pago', valor: 9000, criado_em: ha(16) }), null);        // acima: 30 dias
});

test('pago: depois da tolerância de 7 dias de atraso, devolver o dinheiro', () => {
  assert.equal(tipo({ status: 'pago', valor: 800, criado_em: ha(14) }), 'atrasado');   // 7 de atraso
  assert.equal(tipo({ status: 'pago', valor: 800, criado_em: ha(15) }), 'devolver');   // 8 de atraso
});

test('cancelado nos últimos 7 dias: tentar recuperar o cliente', () => {
  assert.equal(tipo({ status: 'cancelado', criado_em: ha(20), atualizado_em: ha(7) }), 'recuperar');
  assert.equal(tipo({ status: 'cancelado', criado_em: ha(20), atualizado_em: ha(8) }), null);
});

test('entregue nunca precisa de atenção', () => {
  assert.equal(tipo({ status: 'entregue', criado_em: ha(100), atualizado_em: ha(100) }), null);
});

test('pedido de R$ 5.000 para cima vai para a equipe sênior', () => {
  assert.equal(gs.avaliarPedido(pedido({ valor: 5000, criado_em: ha(4) }), HOJE).equipeSenior, true);
  assert.equal(gs.avaliarPedido(pedido({ valor: 4999.99, criado_em: ha(4) }), HOJE).equipeSenior, false);
});

test('a lista sai na ordem de chegada, não de valor', () => {
  const lista = gs.listarAtencao([
    pedido({ id: 1, valor: 9000, criado_em: ha(5), atualizado_em: ha(5) }),
    pedido({ id: 2, valor: 100, criado_em: ha(10), atualizado_em: ha(10) }),
    pedido({ id: 3, valor: 500, criado_em: ha(4), atualizado_em: ha(4) }),
  ], HOJE);
  assert.deepEqual(Array.from(lista, (item) => item.pedido.id), [2, 1, 3]);
});

test('mensagem pronta no WhatsApp com DDI do Brasil', () => {
  const p = pedido({ criado_em: ha(4) });
  const contato = gs.contatoDoCliente(p, gs.avaliarPedido(p, HOJE));
  assert.equal(contato.rotulo, 'Mandar no WhatsApp');
  assert.match(contato.link, /^https:\/\/wa\.me\/5511900000001\?text=/);
  assert.match(decodeURIComponent(contato.link), /lembrar do pagamento do pedido #1 \(Site\)/);
});

test('sem telefone, a mensagem vai por e-mail', () => {
  const p = pedido({ criado_em: ha(4), cliente_telefone: null });
  assert.match(gs.contatoDoCliente(p, gs.avaliarPedido(p, HOJE)).link, /^mailto:p@exemplo\.com\?subject=/);
});
