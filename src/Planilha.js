// Escreve as abas "Pedidos", "Atenção" e "Resumo". Cada aba é gravada com uma chamada só (setValues),
// porque cada ida e volta ao Sheets custa tempo e conta na cota.

const CABECALHO = ['#', 'Cliente', 'Descrição', 'Status', 'Valor', 'Venda realizada?', 'Criado em', 'Atualizado em', 'Atenção'];
const COR_STATUS = { pendente: '#fff4d6', pago: '#dff7ec', entregue: '#d9f0ff', cancelado: '#fde2e2' };
const CABECALHO_ATENCAO = ['#', 'Cliente', 'Valor', 'Alerta', 'Equipe', 'Por quê', 'O que fazer', 'Falar com o cliente'];

/** Puxa os pedidos e atualiza a planilha. Também é o que o gatilho de hora em hora chama. */
function sincronizar() {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(30 * 1000)) {
    throw new Error('Já existe uma sincronização rodando. Tente de novo em instantes.');
  }
  try {
    const config = lerConfig();
    const hoje = new Date();
    const pedidos = config.url ? buscarPedidos(config) : pedidosDeExemplo(hoje);
    const resumo = calcularResumo(pedidos, hoje);
    const planilha = SpreadsheetApp.getActive();
    escreverPedidos(planilha, pedidos, hoje);
    escreverAtencao(planilha, resumo.atencao);
    escreverResumo(planilha, resumo, config.url ? config.url : 'dados de exemplo (configure BALCAO_URL)');
    return resumo;
  } finally {
    trava.releaseLock();
  }
}

/** Linhas da aba "Pedidos", na ordem do CABECALHO. */
function montarLinhas(pedidos, hoje) {
  return pedidos.map((p) => {
    const alerta = avaliarPedido(p, hoje);
    return [
      p.id,
      textoSeguro(p.cliente),
      textoSeguro(p.descricao),
      STATUS[p.status] || textoSeguro(p.status),
      Number(p.valor),
      VENDA_REALIZADA.indexOf(p.status) >= 0 ? 'Sim' : 'Não',
      lerData(p.criado_em),
      lerData(p.atualizado_em),
      alerta ? alerta.titulo : '',
    ];
  });
}

/** Linhas da aba "Atenção", já na ordem de atendimento (quem pediu primeiro vem primeiro). */
function montarAtencao(atencao) {
  return atencao.map(({ pedido, alerta }) => [
    pedido.id,
    textoSeguro(pedido.cliente),
    Number(pedido.valor),
    alerta.titulo,
    alerta.equipeSenior ? 'Sênior' : '',
    alerta.motivo,
    alerta.acao,
    '',
  ]);
}

/** Linhas da aba "Resumo", sempre com 3 colunas (setValues exige um retângulo). */
function montarResumo(resumo, fonte, agora) {
  const linhas = [
    ['Resumo de ' + resumo.mes, '', ''],
    ['Faturamento do mês', resumo.faturamento, ''],
    ['Regra', 'Pago e entregue entram; pendente fica separado; cancelado nunca entra.', ''],
    ['', '', ''],
    ['Status', 'Pedidos', 'Valor'],
  ];
  Object.keys(STATUS).forEach((s) => {
    linhas.push([STATUS[s], resumo.porStatus[s].quantidade, resumo.porStatus[s].valor]);
  });
  linhas.push(['', '', '']);
  linhas.push(['Precisam de atenção', resumo.atencao.length, '']);
  linhas.push(['Atualizado em', agora, '']);
  linhas.push(['Fonte', fonte, '']);
  return linhas;
}

function escreverPedidos(planilha, pedidos, hoje) {
  const aba = obterAba(planilha, 'Pedidos');
  const linhas = montarLinhas(pedidos, hoje);
  aba.clear();
  aba.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]).setFontWeight('bold');
  aba.setFrozenRows(1);
  if (linhas.length === 0) {
    return;
  }
  aba.getRange(2, 1, linhas.length, CABECALHO.length).setValues(linhas);
  aba.getRange(2, 5, linhas.length, 1).setNumberFormat('R$ #,##0.00');
  aba.getRange(2, 7, linhas.length, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  aba.getRange(2, 4, linhas.length, 1).setBackgrounds(pedidos.map((p) => [COR_STATUS[p.status] || null]));
  aba.autoResizeColumns(1, CABECALHO.length);
}

function escreverResumo(planilha, resumo, fonte) {
  const aba = obterAba(planilha, 'Resumo');
  const linhas = montarResumo(resumo, fonte, new Date());
  aba.clear();
  aba.getRange(1, 1, linhas.length, 3).setValues(linhas);
  aba.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  aba.getRange(2, 2).setNumberFormat('R$ #,##0.00').setFontWeight('bold').setFontSize(14);
  aba.getRange(5, 1, 1, 3).setFontWeight('bold');
  aba.getRange(6, 3, Object.keys(STATUS).length, 1).setNumberFormat('R$ #,##0.00');
  aba.getRange(linhas.length - 1, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  aba.autoResizeColumns(1, 3);
  planilha.setActiveSheet(aba);
}

function escreverAtencao(planilha, atencao) {
  const aba = obterAba(planilha, 'Atenção');
  const linhas = montarAtencao(atencao);
  aba.clear();
  aba.getRange(1, 1, 1, CABECALHO_ATENCAO.length).setValues([CABECALHO_ATENCAO]).setFontWeight('bold');
  aba.setFrozenRows(1);
  if (linhas.length === 0) {
    aba.getRange(2, 1).setValue('Nenhum pedido precisa de atenção.');
    return;
  }
  aba.getRange(2, 1, linhas.length, CABECALHO_ATENCAO.length).setValues(linhas);
  aba.getRange(2, 3, linhas.length, 1).setNumberFormat('R$ #,##0.00');
  // A última coluna vira um link clicável com a mensagem pronta
  aba.getRange(2, CABECALHO_ATENCAO.length, linhas.length, 1).setRichTextValues(atencao.map(({ pedido, alerta }) => {
    const contato = contatoDoCliente(pedido, alerta);
    const texto = SpreadsheetApp.newRichTextValue().setText(contato ? contato.rotulo : 'Sem contato cadastrado');
    return [(contato ? texto.setLinkUrl(contato.link) : texto).build()];
  }));
  aba.autoResizeColumns(1, CABECALHO_ATENCAO.length);
}

/**
 * Nome de cliente e descrição vêm de quem digitou no Balcão. Um texto que começa com "=" viraria fórmula
 * no Sheets (e uma fórmula como IMPORTXML pode mandar dados da planilha para fora). O apóstrofo faz o
 * Sheets guardar como texto puro, e ele não aparece na célula.
 */
function textoSeguro(texto) {
  const valor = String(texto == null ? '' : texto);
  return /^[=+\-@	]/.test(valor) ? "'" + valor : valor;
}

function obterAba(planilha, nome) {
  return planilha.getSheetByName(nome) || planilha.insertSheet(nome);
}
