// Mensagens prontas para cada alerta, abertas no WhatsApp ou no e-mail com um clique.
// Nada é enviado sozinho: quem atende lê, completa o que estiver entre colchetes e manda.

function mensagemParaCliente(pedido, alerta) {
  const ola = 'Olá, ' + pedido.cliente + '! ';
  const qual = 'pedido #' + pedido.id + ' (' + pedido.descricao + ')';
  const valor = dinheiro(Number(pedido.valor));
  switch (alerta.tipo) {
    case 'cobrar':
      return ola + 'Passando para lembrar do pagamento do ' + qual + ', no valor de ' + valor + '. Se tiver alguma dúvida, é só responder esta mensagem.';
    case 'atrasado':
      return ola + 'Queremos avisar que o ' + qual + ' atrasou. [Explique o motivo do atraso]. A nova data de entrega é [data]. Pedimos desculpas pelo transtorno.';
    case 'devolver':
      return ola + 'Infelizmente não conseguimos entregar o ' + qual + ' no prazo. [Explique o que aconteceu]. Vamos devolver o valor de ' + valor + '. Como você prefere receber?';
    case 'recuperar':
      return ola + 'Vimos que o ' + qual + ' foi cancelado. Pode contar o que aconteceu? Se for algo que a gente consiga resolver, queremos resolver.';
    case 'esquecido':
      return ola + 'O ' + qual + ' ficou parado com a gente. Você ainda tem interesse? Podemos retomar de onde paramos.';
    default:
      return '';
  }
}

/** Link do WhatsApp com a mensagem já escrita. Telefone brasileiro sem DDI ganha o 55. */
function linkWhatsApp(telefone, texto) {
  let numero = String(telefone || '').replace(/\D/g, '');
  if (numero.length === 10 || numero.length === 11) {
    numero = '55' + numero;
  }
  if (numero.length < 12) {
    return '';
  }
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
}

function linkEmail(email, assunto, texto) {
  if (!email) {
    return '';
  }
  return 'mailto:' + email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(texto);
}

/** O melhor jeito de falar com o cliente: WhatsApp primeiro, e-mail se não tiver telefone. */
function contatoDoCliente(pedido, alerta) {
  const texto = mensagemParaCliente(pedido, alerta);
  const whatsapp = linkWhatsApp(pedido.cliente_telefone, texto);
  if (whatsapp) {
    return { rotulo: 'Mandar no WhatsApp', link: whatsapp };
  }
  const email = linkEmail(pedido.cliente_email, 'Pedido #' + pedido.id, texto);
  return email ? { rotulo: 'Mandar por e-mail', link: email } : null;
}
