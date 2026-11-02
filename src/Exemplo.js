// Pedidos fictícios para o modo demonstração (sem BALCAO_URL). São os mesmos do Balcão,
// com datas relativas a hoje, para a planilha nunca abrir vazia.

function pedidosDeExemplo(hoje) {
  const ha = (horas) => paraTextoMysql(new Date(hoje.getTime() - horas * 3600 * 1000));
  const contatos = {
    'Padaria Pão Quente': ['(11) 90000-0001', 'contato@paoquente.exemplo'],
    'Oficina do Zé': ['(21) 90000-0002', 'ze@oficina.exemplo'],
    'Studio Bela': ['(31) 90000-0003', 'agenda@studiobela.exemplo'],
    'Mercadinho Central': ['(51) 90000-0004', null],
  };
  const pedido = (id, cliente, descricao, valor, status, horas) => ({
    id: id, cliente: cliente, cliente_telefone: contatos[cliente][0], cliente_email: contatos[cliente][1],
    descricao: descricao, valor: valor, status: status, criado_em: ha(horas), atualizado_em: ha(horas),
  });

  return [
    pedido(4, 'Studio Bela', 'Agenda online', 2600, 'pago', 2),
    pedido(3, 'Oficina do Zé', 'Sistema de ordens de serviço', 4200, 'entregue', 5),
    pedido(6, 'Mercadinho Central', 'Controle de estoque', 3100, 'pendente', 24),
    pedido(2, 'Padaria Pão Quente', 'Manutenção mensal', 250, 'pendente', 96),
    pedido(5, 'Studio Bela', 'Integração com WhatsApp', 900, 'cancelado', 120),
    pedido(1, 'Padaria Pão Quente', 'Site institucional', 1800, 'pago', 480),
    pedido(7, 'Oficina do Zé', 'Relatórios em PDF', 700, 'pago', 960),
    pedido(8, 'Mercadinho Central', 'Cardápio digital', 6500, 'pendente', 1080),
  ];
}

function paraTextoMysql(data) {
  const dois = (n) => String(n).padStart(2, '0');
  return data.getFullYear() + '-' + dois(data.getMonth() + 1) + '-' + dois(data.getDate()) + ' ' +
    dois(data.getHours()) + ':' + dois(data.getMinutes()) + ':' + dois(data.getSeconds());
}
