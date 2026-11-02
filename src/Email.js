// Resumo semanal por e-mail. Sincroniza antes, para o e-mail e a planilha mostrarem os mesmos números.

function enviarResumo() {
  const config = lerConfig();
  const resumo = sincronizar();
  MailApp.sendEmail({
    to: config.email,
    subject: 'Balcão: ' + dinheiro(resumo.faturamento) + ' faturados em ' + resumo.mes,
    htmlBody: montarEmail(resumo, SpreadsheetApp.getActive().getUrl()),
  });
}

function montarEmail(resumo, linkDaPlanilha) {
  const linhasStatus = Object.keys(STATUS).map((s) =>
    '<tr><td>' + STATUS[s] + '</td><td align="right">' + resumo.porStatus[s].quantidade +
    '</td><td align="right">' + dinheiro(resumo.porStatus[s].valor) + '</td></tr>'
  ).join('');

  const atencao = resumo.atencao.length === 0
    ? '<p>Nenhum pedido precisa de atenção.</p>'
    : '<p><b>Precisam de atenção (' + resumo.atencao.length + '), na ordem em que foram pedidos:</b></p>' +
      resumo.atencao.map(montarItemDeAtencao).join('');

  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<p>Resumo de ' + resumo.mes + '</p>' +
    '<p style="font-size:24px;margin:4px 0"><b>' + dinheiro(resumo.faturamento) + '</b></p>' +
    '<p style="color:#666;margin-top:0">Faturamento: pedidos pagos e entregues criados no mês.</p>' +
    '<table cellpadding="6" style="border-collapse:collapse"><tr><th align="left">Status</th>' +
    '<th align="right">Pedidos</th><th align="right">Valor</th></tr>' + linhasStatus + '</table>' +
    atencao +
    '<p><a href="' + escapar(linkDaPlanilha) + '">Abrir a planilha</a></p></div>';
}

function montarItemDeAtencao({ pedido, alerta }) {
  const contato = contatoDoCliente(pedido, alerta);
  return '<div style="border-left:3px solid #3ee6a8;padding:4px 12px;margin:12px 0">' +
    '<b>' + escapar(alerta.titulo) + '</b>' + (alerta.equipeSenior ? ' · <b>equipe sênior</b>' : '') + '<br>' +
    '#' + pedido.id + ' ' + escapar(pedido.cliente) + ': ' + escapar(pedido.descricao) + ' (' + dinheiro(Number(pedido.valor)) + ')<br>' +
    '<span style="color:#666">' + escapar(alerta.motivo) + '</span><br>' +
    escapar(alerta.acao) +
    (contato ? '<br><a href="' + escapar(contato.link) + '">' + contato.rotulo + '</a>' : '<br><i>Cliente sem contato cadastrado.</i>') +
    '</div>';
}

/** Nome de cliente e descrição vêm do usuário: escapa antes de pôr no HTML. */
function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
