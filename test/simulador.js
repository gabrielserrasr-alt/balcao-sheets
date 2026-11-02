// Carrega os arquivos de src/ num contexto do Node com versões falsas dos serviços do Google
// (PropertiesService, UrlFetchApp, SpreadsheetApp...), para testar a lógica fora do Apps Script.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

/** Planilha falsa que confere o que o Sheets real conferiria: setValues precisa bater com o tamanho do intervalo. */
function planilhaFalsa() {
  const abas = {};
  const criarAba = (nome) => {
    const celulas = {};
    const intervalo = (linha, coluna, linhas = 1, colunas = 1) => {
      const r = {
        setValues(valores) {
          if (valores.length !== linhas || valores.some((v) => v.length !== colunas)) {
            throw new Error(`setValues ${valores.length}x${valores[0] && valores[0].length} num intervalo ${linhas}x${colunas} da aba ${nome}`);
          }
          valores.forEach((v, i) => v.forEach((c, j) => { celulas[`${linha + i},${coluna + j}`] = c; }));
          return r;
        },
        setBackgrounds(cores) {
          if (cores.length !== linhas) throw new Error(`setBackgrounds com ${cores.length} linhas num intervalo de ${linhas}`);
          return r;
        },
        setValue(valor) { celulas[`${linha},${coluna}`] = valor; return r; },
        setRichTextValues(valores) {
          if (valores.length !== linhas || valores.some((v) => v.length !== colunas)) {
            throw new Error(`setRichTextValues ${valores.length} linhas num intervalo de ${linhas} da aba ${nome}`);
          }
          valores.forEach((v, i) => { celulas[`${linha + i},${coluna}`] = v[0]; });
          return r;
        },
        setNumberFormat: () => r, setFontWeight: () => r, setFontSize: () => r,
      };
      return r;
    };
    const aba = {
      nome, celulas,
      getRange: intervalo,
      clear() { Object.keys(celulas).forEach((k) => delete celulas[k]); },
      setFrozenRows() {}, autoResizeColumns() {},
      valor: (linha, coluna) => celulas[`${linha},${coluna}`],
    };
    abas[nome] = aba;
    return aba;
  };
  return {
    abas,
    getSheetByName: (nome) => abas[nome] || null,
    insertSheet: criarAba,
    setActiveSheet() {},
    getUrl: () => 'https://docs.google.com/spreadsheets/d/exemplo',
    toast() {},
  };
}

/** Imita SpreadsheetApp.newRichTextValue(): guarda o texto e o link da célula. */
function textoComLink() {
  const valor = { texto: '', link: null };
  const construtor = {
    setText(t) { valor.texto = t; return construtor; },
    setLinkUrl(l) { valor.link = l; return construtor; },
    build: () => valor,
  };
  return construtor;
}

/** UrlFetchApp que faz a chamada de verdade, pelo curl (o UrlFetchApp do Google também é síncrono). */
function urlFetchReal() {
  const fetch = (url, opcoes = {}) => {
    const cabecalhos = Object.entries(opcoes.headers || {}).flatMap(([k, v]) => ['-H', `${k}: ${v}`]);
    const saida = execFileSync('curl', ['-s', '-w', '\n%{http_code}', ...cabecalhos, url], { encoding: 'utf8' });
    const quebra = saida.lastIndexOf('\n');
    const corpo = saida.slice(0, quebra);
    const codigo = Number(saida.slice(quebra + 1));
    return { getResponseCode: () => codigo, getContentText: () => corpo };
  };
  return { fetch, fetchAll: (lista) => lista.map((p) => fetch(p.url, p)) };
}

function carregar({ propriedades = {}, urlFetch = urlFetchReal(), planilha = planilhaFalsa(), emails = [] } = {}) {
  const contexto = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in propriedades ? propriedades[k] : null) }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.com' }) },
    UrlFetchApp: urlFetch,
    SpreadsheetApp: { getActive: () => planilha, newRichTextValue: textoComLink },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => emails.push(m) },
  });
  const pasta = path.join(__dirname, '..', 'src');
  fs.readdirSync(pasta).filter((f) => f.endsWith('.js')).sort().forEach((arquivo) => {
    vm.runInContext(fs.readFileSync(path.join(pasta, arquivo), 'utf8'), contexto, { filename: arquivo });
  });
  return { gs: contexto, planilha, emails };
}

module.exports = { carregar, planilhaFalsa };
