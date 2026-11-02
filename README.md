# Balcão Sheets

Automação em **Google Apps Script** que liga o [Balcão](https://github.com/gabrielserrasr-alt/balcao) ao Google Sheets: puxa os pedidos pela API, monta a planilha de faturamento, aponta os pedidos que precisam de atenção com a mensagem pronta para o cliente e manda um resumo por e-mail toda segunda.

## O que ele faz

- **Menu "Balcão"** na planilha: sincronizar agora, enviar resumo agora, ligar e desligar a automação
- **Aba Pedidos:** todos os pedidos, com status colorido, valor em reais, data de criação e da última alteração
- **Aba Atenção:** os pedidos que precisam de alguém, na ordem de chegada, com o motivo, o que fazer e um link que abre o WhatsApp do cliente com a mensagem já escrita
- **Aba Resumo:** faturamento do mês e totais por status, com a mesma regra do Balcão
- **Automação:** sincroniza de hora em hora e envia o resumo toda segunda às 8h
- **Modo demonstração:** sem configurar nada, a planilha abre com pedidos de exemplo

## Regra do faturamento

A mesma do Balcão, para os dois mostrarem o mesmo número:

| Status | Entra no faturamento? |
|---|---|
| Pago | Sim |
| Entregue | Sim |
| Pendente | Não; aparece separado |
| Cancelado | Nunca |

O mês conta pela data de criação do pedido.

## Pedidos que precisam de atenção

| Situação | Quando | O que fazer |
|---|---|---|
| Pagamento pendente | Pendente há mais de 3 dias | Lembrar o cliente do pagamento |
| Pedido esquecido | Pendente sem nenhuma alteração há mais de 30 dias: o cliente não pagou e a empresa não cobrou | Até 60 dias, tentar resgatar; depois, confirmar com o cliente ou cancelar. Sem telefone nem e-mail, cadastrar um contato primeiro |
| Entrega atrasada | Pago e passou do prazo de entrega | Avisar o cliente com a justificativa e a nova data |
| Devolver o dinheiro | Mais de 7 dias depois do prazo | Devolver o valor e explicar o que aconteceu |
| Cancelado recentemente | Cancelado nos últimos 7 dias | Perguntar o motivo e tentar não perder o cliente |

- **Prazo de entrega pelo valor:** pedido maior é mais complexo. Até R$ 1.000, 7 dias; até R$ 5.000, 15 dias; acima disso, 30 dias.
- **Ordem de atendimento:** quem pediu primeiro vem primeiro, seja qual for o valor.
- **Equipe sênior:** pedido a partir de R$ 5.000 é marcado para a equipe mais experiente.
- **Mensagens:** cada alerta tem um texto pronto que abre no WhatsApp do cliente (ou no e-mail, se ele não tiver telefone). Nada é enviado sozinho; quem atende completa o que estiver entre colchetes, como a justificativa do atraso, e manda.

Os prazos ficam em `REGRAS`, no começo de [`src/Resumo.js`](src/Resumo.js).

## Decisões técnicas

| O quê | Por quê |
|---|---|
| As regras de atenção não falam com o Google | Ficam testáveis no Node, e cada regra tem teste |
| A primeira página da API diz o total, e as outras vêm juntas com `UrlFetchApp.fetchAll` | Buscar página por página faria uma chamada de rede de cada vez |
| Cada aba é gravada com um único `setValues` | Cada chamada ao Sheets é uma ida e volta e conta na cota do Google |
| Valores somados em centavos | `0,1 + 0,2` em ponto flutuante não dá `0,3` |
| `LockService` na sincronização | O gatilho de hora em hora e um clique no menu não gravam a planilha ao mesmo tempo |
| Token nas Propriedades do script | Nada sensível fica no código |
| Nome do cliente e descrição escapados no e-mail | São textos digitados por usuário |

## Instalar

1. Crie uma planilha no Google Sheets e abra **Extensões > Apps Script**.
2. Crie um arquivo para cada `.js` de [`src/`](src) com o mesmo conteúdo, e troque o `appsscript.json` pelo daqui (em **Configurações do projeto**, marque "Mostrar o arquivo de manifesto").
3. Recarregue a planilha. O menu **Balcão** aparece; **Sincronizar agora** já funciona no modo demonstração.

Ou, com o [clasp](https://github.com/google/clasp): copie `.clasp.json.example` para `.clasp.json`, coloque o ID do script e rode `clasp push`.

### Ligar ao seu Balcão

Em **Configurações do projeto > Propriedades do script**:

| Propriedade | Valor |
|---|---|
| `BALCAO_URL` | Endereço público do Balcão, ex.: `https://balcao.suaempresa.com.br` |
| `BALCAO_TOKEN` | O mesmo `API_TOKEN` do `.env` do Balcão |
| `EMAIL_RESUMO` | Quem recebe o resumo (opcional; padrão: a sua conta) |

O Apps Script roda nos servidores do Google, então o Balcão precisa estar num endereço público: `localhost` não funciona. O script usa o fuso `America/Sao_Paulo`; o banco do Balcão deve usar o mesmo, senão a virada do mês fica deslocada.

## Testes

A lógica roda no Node com versões falsas dos serviços do Google. A planilha falsa recusa um `setValues` com tamanho errado, como o Sheets faria.

```bash
npm test
```

Para testar contra um Balcão rodando (`docker compose up` no repositório dele):

```bash
BALCAO_URL=http://localhost:8080 BALCAO_TOKEN=seu_token npm test
```

## Estrutura

```
src/
  Config.js     propriedades do script e a regra de venda realizada
  Api.js        leitura paginada da API do Balcão
  Resumo.js     regras do resumo (faturamento, pedidos que precisam de atenção)
  Mensagens.js  mensagens prontas e links do WhatsApp e do e-mail
  Planilha.js   abas Pedidos, Atenção e Resumo
  Email.js      resumo semanal
  Menu.js       menu e gatilhos
  Exemplo.js    pedidos do modo demonstração
test/           testes no Node
```

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE).

© Gabriel Serra da Rosa
