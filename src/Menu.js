// Menu "Balcão" na planilha e os gatilhos da automação.

const FUNCOES_AUTOMATICAS = ['sincronizar', 'enviarResumo'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Balcão')
    .addItem('Sincronizar agora', 'sincronizarPeloMenu')
    .addItem('Enviar resumo agora', 'enviarResumoPeloMenu')
    .addSeparator()
    .addItem('Ligar automação', 'ligarAutomacao')
    .addItem('Desligar automação', 'desligarAutomacao')
    .addToUi();
}

function sincronizarPeloMenu() {
  const resumo = sincronizar();
  avisar('Pedidos atualizados. Faturamento de ' + resumo.mes + ': ' + dinheiro(resumo.faturamento) + '.');
}

function enviarResumoPeloMenu() {
  enviarResumo();
  avisar('Resumo enviado para ' + lerConfig().email + '.');
}

/** Sincroniza de hora em hora e manda o resumo toda segunda às 8h. Chamar de novo não duplica. */
function ligarAutomacao() {
  desligarAutomacao();
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('enviarResumo').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  avisar('Automação ligada: sincroniza de hora em hora e envia o resumo toda segunda às 8h.');
}

function desligarAutomacao() {
  ScriptApp.getProjectTriggers()
    .filter((gatilho) => FUNCOES_AUTOMATICAS.indexOf(gatilho.getHandlerFunction()) >= 0)
    .forEach((gatilho) => ScriptApp.deleteTrigger(gatilho));
}

function avisar(mensagem) {
  SpreadsheetApp.getActive().toast(mensagem, 'Balcão', 6);
}
