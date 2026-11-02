// Configuração lida das Propriedades do script (Configurações do projeto > Propriedades do script).
// O token da API mora só ali, nunca no código.
//   BALCAO_URL     endereço público do Balcão, ex.: https://balcao.suaempresa.com.br
//   BALCAO_TOKEN   o mesmo API_TOKEN do .env do Balcão
//   EMAIL_RESUMO   quem recebe o resumo (opcional; padrão: a conta dona do script)
// Sem BALCAO_URL, o script roda em modo demonstração, com pedidos de exemplo.

const STATUS = { pendente: 'Pendente', pago: 'Pago', entregue: 'Entregue', cancelado: 'Cancelado' };

// A mesma regra do Balcão: só venda realizada entra no faturamento.
const VENDA_REALIZADA = ['pago', 'entregue'];

function lerConfig() {
  const propriedades = PropertiesService.getScriptProperties();
  return {
    url: (propriedades.getProperty('BALCAO_URL') || '').trim().replace(/\/+$/, ''),
    token: (propriedades.getProperty('BALCAO_TOKEN') || '').trim(),
    email: (propriedades.getProperty('EMAIL_RESUMO') || '').trim() || Session.getEffectiveUser().getEmail(),
  };
}
