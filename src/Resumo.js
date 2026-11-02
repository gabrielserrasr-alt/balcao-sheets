// Regras de negócio do resumo. Nada aqui fala com o Google, então dá para testar no Node.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const UM_DIA = 24 * 60 * 60 * 1000;

// Regras de atenção (definidas pelo Gabriel). Os prazos ficam aqui para ajustar sem mexer na lógica.
const REGRAS = {
  lembrarPagamentoAposDias: 3,      // pendente há mais que isso: lembrar o cliente
  canceladoRecenteDias: 7,          // cancelado dentro desse período: tentar recuperar o cliente
  esquecidoAposDias: 30,            // pendente sem nenhuma alteração há mais que isso: esquecido
  resgatavelAteDias: 60,            // esquecido até aqui ainda dá para resgatar
  toleranciaDevolucaoDias: 7,       // dias de atraso aceitos antes de devolver o dinheiro
  equipeSeniorAPartirDe: 5000,      // pedido desse valor para cima vai para a equipe mais experiente
  // Pedido maior é mais complexo e tem mais prazo de entrega. Vale a primeira faixa em que o valor couber.
  prazoDeEntrega: [
    { ate: 1000, dias: 7 },
    { ate: 5000, dias: 15 },
    { ate: Infinity, dias: 30 },
  ],
};

/** "2026-11-02 14:05:00" (MySQL) vira Date no fuso do script. */
function lerData(texto) {
  const [dia, hora = '00:00:00'] = String(texto).split(' ');
  const [a, m, d] = dia.split('-').map(Number);
  const [hh, mm, ss] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm, ss || 0);
}

function diasDesde(data, hoje) {
  return Math.floor((hoje.getTime() - data.getTime()) / UM_DIA);
}

function dias(n) {
  return n + (n === 1 ? ' dia' : ' dias');
}

function dinheiro(valor) {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  return (valor < 0 ? '-' : '') + 'R$ ' + inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + centavos;
}

function prazoDeEntrega(valor) {
  return REGRAS.prazoDeEntrega.find((faixa) => valor <= faixa.ate).dias;
}

/**
 * Totais do mês atual, com a regra do Balcão:
 * pago + entregue = faturamento; pendente fica separado; cancelado nunca entra.
 * O mês conta pela data de criação do pedido. Os valores somam em centavos para não acumular erro de ponto flutuante.
 */
function calcularResumo(pedidos, hoje) {
  const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const centavos = {};
  const quantidade = {};
  Object.keys(STATUS).forEach((s) => { centavos[s] = 0; quantidade[s] = 0; });

  pedidos
    .filter((p) => STATUS[p.status] && lerData(p.criado_em) >= inicioDoMes)
    .forEach((p) => {
      centavos[p.status] += Math.round(Number(p.valor) * 100);
      quantidade[p.status] += 1;
    });

  const porStatus = {};
  Object.keys(STATUS).forEach((s) => { porStatus[s] = { quantidade: quantidade[s], valor: centavos[s] / 100 }; });

  return {
    mes: MESES[hoje.getMonth()] + ' de ' + hoje.getFullYear(),
    faturamento: VENDA_REALIZADA.reduce((soma, s) => soma + centavos[s], 0) / 100,
    porStatus: porStatus,
    atencao: listarAtencao(pedidos, hoje),
  };
}

/** Pedidos que precisam de atenção, do mais antigo para o mais novo: quem pediu primeiro é atendido primeiro, seja qual for o valor. */
function listarAtencao(pedidos, hoje) {
  return pedidos
    .map((pedido) => ({ pedido: pedido, alerta: avaliarPedido(pedido, hoje) }))
    .filter((item) => item.alerta)
    .sort((a, b) => lerData(a.pedido.criado_em) - lerData(b.pedido.criado_em));
}

/**
 * Diz se o pedido precisa de atenção e o que fazer. Devolve null quando está tudo certo.
 * A idade conta da criação do pedido; "parado" conta da última alteração no Balcão.
 */
function avaliarPedido(pedido, hoje) {
  const valor = Number(pedido.valor);
  const idade = diasDesde(lerData(pedido.criado_em), hoje);
  const parado = diasDesde(lerData(pedido.atualizado_em), hoje);
  const alerta = (tipo, titulo, motivo, acao) => ({
    tipo: tipo,
    titulo: titulo,
    motivo: motivo,
    acao: acao,
    equipeSenior: pedido.status !== 'cancelado' && valor >= REGRAS.equipeSeniorAPartirDe,
  });

  if (pedido.status === 'cancelado') {
    if (parado > REGRAS.canceladoRecenteDias) {
      return null;
    }
    return alerta('recuperar', 'Cancelado recentemente',
      'Cancelado há ' + dias(parado) + '.',
      'Perguntar ao cliente por que cancelou e tentar resolver, para não perder o cliente.');
  }

  if (pedido.status === 'pendente') {
    if (parado > REGRAS.esquecidoAposDias) {
      return alerta('esquecido', 'Pedido esquecido',
        'Nenhuma alteração há ' + dias(parado) + ': o cliente não pagou e a empresa não cobrou. Os dois lados esqueceram.',
        acaoParaEsquecido(pedido, parado));
    }
    if (idade > REGRAS.lembrarPagamentoAposDias) {
      return alerta('cobrar', 'Pagamento pendente',
        'Criado há ' + dias(idade) + ' e ainda não foi pago.',
        'Lembrar o cliente do pagamento.');
    }
    return null;
  }

  if (pedido.status === 'pago') {
    const prazo = prazoDeEntrega(valor);
    const atraso = idade - prazo;
    if (atraso > REGRAS.toleranciaDevolucaoDias) {
      return alerta('devolver', 'Devolver o dinheiro',
        'Pago há ' + dias(idade) + ' e não entregue; o prazo era de ' + dias(prazo) + ' e a tolerância de ' + dias(REGRAS.toleranciaDevolucaoDias) + ' acabou.',
        'Devolver o valor ao cliente e explicar o que aconteceu.');
    }
    if (atraso > 0) {
      const restam = REGRAS.toleranciaDevolucaoDias - atraso;
      return alerta('atrasado', 'Entrega atrasada',
        'Atrasado ' + dias(atraso) + '; o prazo era de ' + dias(prazo) + '. ' +
          (restam === 0 ? 'Hoje é o último dia antes de ter de devolver o dinheiro.' : 'Faltam ' + dias(restam) + ' para ter de devolver o dinheiro.'),
        'Avisar o cliente com a justificativa do atraso e a nova data de entrega.');
    }
  }

  return null; // entregue, ou dentro do prazo
}

function acaoParaEsquecido(pedido, parado) {
  if (!pedido.cliente_telefone && !pedido.cliente_email) {
    return 'Não dá para resgatar ainda: o cliente está sem telefone e sem e-mail no Balcão. Cadastre um contato primeiro.';
  }
  if (parado <= REGRAS.resgatavelAteDias) {
    return 'Dá para resgatar: perguntar se o cliente ainda tem interesse e retomar de onde parou.';
  }
  return 'Provavelmente perdido: confirmar com o cliente e cancelar o pedido se ele não responder.';
}
