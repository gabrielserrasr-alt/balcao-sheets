// Leitura da API JSON do Balcão (GET /api/pedidos, 10 pedidos por página).

const LIMITE_PAGINAS = 200;

/** Busca todos os pedidos. A primeira página diz o total; as outras vêm de uma vez, em paralelo. */
function buscarPedidos(config) {
  if (!config.token) {
    throw new Error('Falta o BALCAO_TOKEN nas propriedades do script.');
  }
  const primeira = lerResposta(UrlFetchApp.fetch(enderecoDaPagina(config, 1), opcoesDaChamada(config)), 1);
  const porPagina = primeira.pedidos.length;
  if (porPagina === 0 || primeira.total <= porPagina) {
    return primeira.pedidos;
  }

  const paginas = Math.ceil(primeira.total / porPagina);
  if (paginas > LIMITE_PAGINAS) {
    throw new Error('São ' + paginas + ' páginas de pedidos; o limite é ' + LIMITE_PAGINAS + '.');
  }
  const pedidosPorPagina = [];
  for (let pagina = 2; pagina <= paginas; pagina++) {
    pedidosPorPagina.push(Object.assign({ url: enderecoDaPagina(config, pagina) }, opcoesDaChamada(config)));
  }
  const respostas = UrlFetchApp.fetchAll(pedidosPorPagina);
  return respostas.reduce(
    (todos, resposta, i) => todos.concat(lerResposta(resposta, i + 2).pedidos),
    primeira.pedidos
  );
}

function enderecoDaPagina(config, pagina) {
  return config.url + '/api/pedidos?pagina=' + pagina;
}

function opcoesDaChamada(config) {
  return { headers: { Authorization: 'Bearer ' + config.token }, muteHttpExceptions: true };
}

function lerResposta(resposta, pagina) {
  const codigo = resposta.getResponseCode();
  if (codigo === 401) {
    throw new Error('O Balcão recusou o token. Confira o BALCAO_TOKEN nas propriedades do script.');
  }
  if (codigo !== 200) {
    throw new Error('O Balcão respondeu ' + codigo + ' na página ' + pagina + ' de pedidos.');
  }
  const corpo = JSON.parse(resposta.getContentText());
  if (!Array.isArray(corpo.pedidos)) {
    throw new Error('A resposta do Balcão veio sem a lista de pedidos.');
  }
  return corpo;
}
