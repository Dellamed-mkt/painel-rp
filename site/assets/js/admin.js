/* Painel RP Dellamed · Administração: usuários, registro de alterações e dados. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const P = Nuvem.PAPEIS;
  const ACOES = { criou: 'Criou', alterou: 'Alterou', excluiu: 'Excluiu', restaurou: 'Restaurou', importou: 'Importou' };
  const COLS = { eventos: 'Evento', patrocinios: 'Patrocínio', usuarios: 'Usuário', geral: 'Lista geral' };
  let fs, EU = '', aba = 'usuarios';
  let USU = [], DOCS = { eventos: {}, patrocinios: {} };
  let LOGS = [], ultimoLog = null, fimLogs = false, carregandoLogs = false;
  const F = { doc: '', pessoa: '', acao: '', de: '', ate: '', texto: '' };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800); }
  const dt = v => { const d = v && v.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d) ? d : null; };
  const fmtDT = d => d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtH = d => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  function lerHash() {
    const m = location.hash.match(/^#logs(?:=(.+))?$/);
    if (m) { aba = 'logs'; if (m[1]) F.doc = decodeURIComponent(m[1]); }
    else if (location.hash === '#dados') aba = 'dados';
    else if (location.hash === '#usuarios') aba = 'usuarios';
  }

  function moldura() {
    document.getElementById('app').innerHTML = `
    <header class="top"><div class="wrap">
      <div class="toprow"><span class="brand" style="display:flex;align-items:center;gap:14px"><img src="assets/img/logo.png" alt="Dellamed" class="logo" style="height:32px">
        <span style="border-left:1px solid rgba(255,255,255,.3);padding-left:14px">RELAÇÕES PÚBLICAS</span></span>${Nuvem.chip({ admin: true, painel: true })}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%"><a class="back" href="./" style="text-decoration:none"><svg class="ico" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> Voltar ao painel</a></div>
      <h1><b>Administração</b> · Painel RP</h1>
      <p>Quem acessa o painel, o que mudou e quando, e cópia dos dados.</p>
    </div></header>
    <main class="wrap">
      <div class="tabs adm-tabs" role="tablist">
        ${[['usuarios', 'Usuários'], ['logs', 'Registro de alterações'], ['dados', 'Dados']].map(([k, v]) => `<button class="tab" role="tab" id="t-${k}" aria-selected="${k === aba}" aria-controls="painel" data-aba="${k}">${v}</button>`).join('')}
      </div>
      <section id="painel" role="tabpanel" aria-labelledby="t-${aba}"></section>
      <footer>Saúde e bem-estar para todos.</footer>
    </main>`;
    document.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; history.replaceState(null, '', '#' + aba); moldura(); });
    ({ usuarios: telaUsuarios, logs: telaLogs, dados: telaDados })[aba]();
  }

  // ---------------- Usuários ----------------
  function telaUsuarios() {
    const lista = USU.slice().sort((a, b) => (a.ativo === false) - (b.ativo === false) || (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'));
    $('#painel').innerHTML = `
    <div class="panel">
      <h3>Cadastrar pessoa</h3>
      <p class="note" style="margin-top:0">A pessoa entra com a conta Google deste e-mail. <b>Leitura</b> vê tudo e baixa Excel; <b>Editor</b> também altera eventos e patrocínios; <b>Administrador</b> também exclui eventos, cadastra pessoas e vê o registro de alterações.</p>
      <form class="form" id="fUsu" novalidate>
        <label class="f" style="flex:2 1 220px">Nome<input name="nome" autocomplete="off" placeholder="Ex.: Eloysa Finger Marques"></label>
        <label class="f" style="flex:2 1 240px">E-mail Google<input name="email" type="email" autocomplete="off" placeholder="nome@dellamed.com.br"></label>
        <label class="f">Papel<select name="papel">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === 'leitor' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <button class="btn btn-primary">Cadastrar</button>
      </form>
      <p class="note" id="usuErr" role="alert" style="color:var(--red)"></p>
    </div>
    <div class="panel">
      <h3>Pessoas com acesso <span class="who" style="font-family:var(--font-body);font-weight:400">· ${lista.filter(u => u.ativo !== false).length} liberadas</span></h3>
      ${lista.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Acesso</th><th>Último acesso</th><th></th></tr></thead><tbody>
      ${lista.map(u => { const eu = u.email === EU; return `<tr>
        <td><input data-u="${esc(u.email)}" data-k="nome" value="${esc(u.nome || '')}" aria-label="Nome de ${esc(u.email)}" style="min-width:180px"></td>
        <td style="word-break:break-all">${esc(u.email)}${eu ? ' <span class="pill admin">você</span>' : ''}</td>
        <td><select data-u="${esc(u.email)}" data-k="papel" aria-label="Papel de ${esc(u.email)}" ${eu ? 'disabled title="Você não pode mudar o próprio papel"' : ''}>${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === u.papel ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td>${u.ativo === false ? '<span class="pill off">Bloqueado</span>' : '<span class="pill editor">Liberado</span>'}</td>
        <td class="num" style="white-space:nowrap">${fmtDT(dt(u.ultimoAcesso))}</td>
        <td style="white-space:nowrap">${eu ? '' : `<button class="link" style="color:var(--navy)" data-bloq="${esc(u.email)}">${u.ativo === false ? 'Liberar' : 'Bloquear'}</button><button class="link" data-del="${esc(u.email)}">Excluir</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="note">Ninguém cadastrado ainda.</p>'}
    </div>`;
    const f = $('#fUsu');
    f.onsubmit = async ev => {
      ev.preventDefault();
      const em = f.email.value.trim().toLowerCase(), nome = f.nome.value.trim(), err = $('#usuErr');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { err.textContent = 'Confira o e-mail: ele precisa ser a conta Google que a pessoa usa para entrar.'; f.email.focus(); return; }
      if (USU.some(u => u.email === em)) { err.textContent = 'Esse e-mail já está cadastrado. Ajuste o papel na lista abaixo.'; return; }
      err.textContent = '';
      try { await Nuvem.gravar('usuarios', em, { email: em, nome: nome || em.split('@')[0], papel: f.papel.value, ativo: true, criadoEm: new Date().toISOString(), criadoPor: EU }); toast('Pessoa cadastrada. Ela já pode entrar com o Google.'); }
      catch (e) { err.textContent = e.code === 'permission-denied' ? 'Sem permissão para cadastrar. Só administradores cadastram pessoas.' : 'Não deu para salvar. Confira a conexão.'; }
    };
    const atual = em => USU.find(u => u.email === em);
    const salvarU = async (em, mud, msg) => {
      const u = atual(em); if (!u) return;
      const novo = Object.assign({}, u, mud); delete novo._id;
      try { await Nuvem.gravar('usuarios', em, novo); toast(msg); } catch (e) { toast('Não deu para salvar. Confira a conexão.'); }
    };
    document.querySelectorAll('[data-u]').forEach(el => el.onchange = () => {
      const v = el.value.trim(); if (el.dataset.k === 'nome' && !v) { el.value = atual(el.dataset.u).nome || ''; return; }
      salvarU(el.dataset.u, { [el.dataset.k]: v }, el.dataset.k === 'papel' ? 'Papel alterado para ' + P[v] + '.' : 'Nome salvo.');
    });
    document.querySelectorAll('[data-bloq]').forEach(b => b.onclick = () => { const u = atual(b.dataset.bloq); salvarU(u.email, { ativo: u.ativo === false }, u.ativo === false ? 'Acesso liberado.' : 'Acesso bloqueado.'); });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Clique de novo para excluir'; return; }
      try { await Nuvem.apagar('usuarios', b.dataset.del); toast('Cadastro excluído.'); } catch (e) { toast('Não deu para excluir. Confira a conexão.'); }
    });
  }

  // ---------------- Registro de alterações ----------------
  async function carregarLogs() {
    if (carregandoLogs || fimLogs) return; carregandoLogs = true;
    try {
      let q = fs.collection('logs').orderBy('quando', 'desc').limit(200);
      if (ultimoLog) q = q.startAfter(ultimoLog);
      const s = await q.get();
      s.docs.forEach(d => LOGS.push(Object.assign({ _id: d.id }, d.data({ serverTimestamps: 'estimate' }))));
      ultimoLog = s.docs[s.docs.length - 1] || ultimoLog; if (s.docs.length < 200) fimLogs = true;
    } catch (e) { toast('Não deu para carregar o registro. Confira a conexão.'); }
    carregandoLogs = false;
  }
  function filtrados() {
    const de = F.de ? new Date(F.de + 'T00:00:00') : null, ate = F.ate ? new Date(F.ate + 'T23:59:59') : null, tx = norm(F.texto);
    return LOGS.filter(l => {
      if (F.doc && l.col + '/' + l.docId !== F.doc) return false;
      if (F.pessoa && l.email !== F.pessoa) return false;
      if (F.acao && l.acao !== F.acao) return false;
      const q = dt(l.quando); if (de && q && q < de) return false; if (ate && q && q > ate) return false;
      if (tx && !norm([l.nomeDoc, l.nome, l.email, ...(l.mudancas || [])].join(' ')).includes(tx)) return false;
      return true;
    });
  }
  function opcoesDoc() {
    const docs = [];
    Object.entries(DOCS).forEach(([c, m]) => Object.entries(m).forEach(([id, d]) => docs.push([c + '/' + id, (COLS[c] || c) + ' · ' + (d.nome || id) + (d.ano ? ' (' + d.ano + ')' : '')])));
    LOGS.forEach(l => { const k = l.col + '/' + l.docId; if (!docs.some(x => x[0] === k)) docs.push([k, (COLS[l.col] || l.col) + ' · ' + (l.nomeDoc || l.docId) + (l.acao === 'excluiu' ? ' (excluído)' : '')]); });
    if (F.doc && !docs.some(x => x[0] === F.doc)) docs.push([F.doc, F.doc]);
    return docs.sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }
  function linkDoc(l) {
    if ((l.col === 'eventos' || l.col === 'patrocinios') && DOCS[l.col][l.docId]) return `<a href="./#${encodeURIComponent(l.docId)}">${esc(l.nomeDoc || l.docId)}</a>`;
    return esc(l.nomeDoc || l.docId);
  }
  async function telaLogs() {
    const P_ = $('#painel');
    if (!LOGS.length && !fimLogs) { P_.innerHTML = '<p class="empty" role="status">Carregando o registro…</p>'; await carregarLogs(); if (aba !== 'logs') return; }
    const L = filtrados();
    const pessoas = [...new Set([...USU.map(u => u.email), ...LOGS.map(l => l.email)])].filter(Boolean).sort();
    P_.innerHTML = `
    <div class="panel">
      <div class="filtros">
        <label class="f" style="flex:2 1 260px">Evento ou cadastro<select id="fDoc"><option value="">Todos</option>${opcoesDoc().map(([k, v]) => `<option value="${esc(k)}" ${k === F.doc ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="f">Pessoa<select id="fPes"><option value="">Todas</option>${pessoas.map(e => `<option value="${esc(e)}" ${e === F.pessoa ? 'selected' : ''}>${esc(Nuvem.nomeDe(e) || e)}</option>`).join('')}</select></label>
        <label class="f">Ação<select id="fAc"><option value="">Todas</option>${Object.entries(ACOES).map(([k, v]) => `<option value="${k}" ${k === F.acao ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f" style="flex:0 1 160px">De<input id="fDe" type="date" value="${F.de}"></label>
        <label class="f" style="flex:0 1 160px">Até<input id="fAte" type="date" value="${F.ate}"></label>
        <label class="f" style="flex:2 1 220px">Contém<input id="fTx" type="search" value="${esc(F.texto)}" placeholder="Ex.: verba, buffet, Kimberly"></label>
      </div>
      <p class="note" style="margin:0">${L.length} ${L.length === 1 ? 'registro' : 'registros'}${fimLogs ? '' : ' entre os mais recentes'}. Alterações seguidas da mesma pessoa no mesmo evento, em até 10 minutos, ficam num registro só.
        ${F.doc || F.pessoa || F.acao || F.de || F.ate || F.texto ? ' <button class="link" id="fLimpa" style="color:var(--navy)">Limpar filtros</button>' : ''}</p>
    </div>
    <div class="panel" id="logLista">
      ${L.length ? L.map(l => {
        const q = dt(l.quando), fi = dt(l.fim), m = l.mudancas || [];
        return `<article class="log">
          <time datetime="${q ? q.toISOString() : ''}">${fmtDT(q)}${fi && q && fi - q > 60000 ? '<br>até ' + fmtH(fi) : ''}</time>
          <div><span class="acao ${esc(l.acao)}">${esc((ACOES[l.acao] || l.acao || '').toUpperCase())} · ${esc(COLS[l.col] || l.col)}</span>
            <h4>${linkDoc(l)}</h4>
            <span class="who">${esc(l.nome || Nuvem.nomeDe(l.email))} · ${esc(l.email)}${l.vezes > 1 ? ' · ' + l.vezes + ' gravações' : ''}</span>
            ${l.obs ? `<p class="note" style="margin:4px 0 0">${esc(l.obs)}</p>` : ''}
            ${m.length ? `<ul>${m.slice(0, 6).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${m.length > 6 ? `<details><summary class="link" style="color:var(--navy);display:inline-block">Ver as ${m.length} mudanças</summary><ul>${m.slice(6).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}` : ''}
            <div id="v-${l._id}"></div>
          </div>
          <div>${l.temVersao ? `<button class="btn btn-sec" style="min-height:38px;padding:6px 12px;font-size:14px" data-ver="${l._id}">Versão anterior</button>` : ''}</div>
        </article>`; }).join('') : '<p class="empty" style="padding:16px 0">Nenhum registro com esses filtros.</p>'}
      ${fimLogs ? '' : '<div class="form"><button class="btn btn-sec" id="maisLogs">Carregar registros mais antigos</button></div>'}
    </div>`;
    const set = (id, k, ev) => { const el = $(id); el[ev || 'onchange'] = () => { F[k] = el.value; telaLogs().then(() => { if (ev) { const n = $(id); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }; };
    set('#fDoc', 'doc'); set('#fPes', 'pessoa'); set('#fAc', 'acao'); set('#fDe', 'de'); set('#fAte', 'ate'); set('#fTx', 'texto', 'oninput');
    const lp = $('#fLimpa'); if (lp) lp.onclick = () => { Object.keys(F).forEach(k => F[k] = ''); history.replaceState(null, '', '#logs'); telaLogs(); };
    const mais = $('#maisLogs'); if (mais) mais.onclick = async () => { mais.disabled = true; mais.textContent = 'Carregando…'; await carregarLogs(); telaLogs(); };
    document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => verVersao(b.dataset.ver, b));
  }
  async function verVersao(id, btn) {
    const box = document.getElementById('v-' + id); if (!box) return;
    if (box.innerHTML) { box.innerHTML = ''; btn.textContent = 'Versão anterior'; return; }
    btn.disabled = true;
    try {
      const s = await fs.collection('versoes').doc(id).get();
      if (!s.exists) { box.innerHTML = '<p class="note">A versão anterior não foi encontrada.</p>'; return; }
      const v = s.data(), d = v.dados || {}, l = LOGS.find(x => x._id === id) || {};
      const atual = (DOCS[v.col] || {})[v.docId];
      const dif = atual ? Nuvem.descrever(v.col, atual, d) : ['O registro foi excluído; restaurar traz de volta exatamente esta versão.'];
      box.innerHTML = `<div class="flag info" style="flex-direction:column;gap:6px;margin-top:10px">
        <b>Como estava antes de ${fmtDT(dt(l.quando))}</b>
        ${dif.length ? `<span>Se restaurar, em relação ao que está hoje:</span><ul style="margin:0;padding-left:18px">${dif.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}${dif.length > 12 ? `<li>e mais ${dif.length - 12}</li>` : ''}</ul>` : '<span>É igual ao que está hoje.</span>'}
        <details><summary class="link" style="color:var(--navy);display:inline-block">Ver dados completos</summary><pre class="versao">${esc(JSON.stringify(d, null, 2))}</pre></details>
        ${dif.length ? `<div><button class="btn btn-primary" data-rest="${id}">Restaurar esta versão</button></div>` : ''}</div>`;
      btn.textContent = 'Fechar versão';
      const r = box.querySelector('[data-rest]');
      if (r) r.onclick = async () => {
        if (r.dataset.ok !== '1') { r.dataset.ok = '1'; r.textContent = 'Clique de novo para restaurar'; return; }
        r.disabled = true; r.textContent = 'Restaurando…';
        try {
          await Nuvem.gravar(v.col, v.docId, d, { acao: 'restaurou', extra: { obs: 'Restaurado para a versão anterior ao registro de ' + fmtDT(dt(l.quando)) } });
          toast('Versão restaurada.'); LOGS = []; ultimoLog = null; fimLogs = false; telaLogs();
        } catch (e) { r.disabled = false; r.textContent = 'Restaurar esta versão'; toast(e.code === 'permission-denied' ? 'Sem permissão para restaurar.' : 'Não deu para restaurar. Confira a conexão.'); }
      };
    } catch (e) { box.innerHTML = '<p class="note">Não deu para abrir a versão. Confira a conexão.</p>'; }
    finally { btn.disabled = false; }
  }

  // ---------------- Dados ----------------
  let IMPORT = null;
  function telaDados() {
    const nEv = Object.keys(DOCS.eventos).length, nPt = Object.keys(DOCS.patrocinios).length;
    $('#painel').innerHTML = `
    <div class="panel">
      <h3>Cópia completa</h3>
      <p class="note" style="margin-top:0">Baixa todos os eventos (${nEv}) e patrocínios (${nPt}) num arquivo JSON. O mesmo arquivo pode ser importado aqui para recuperar tudo.</p>
      <div class="form"><button class="btn btn-primary" id="baixaJson">Baixar cópia (JSON)</button></div>
    </div>
    <div class="panel">
      <h3>Importar dados</h3>
      <p class="note" style="margin-top:0">Use para trazer os dados do dash antigo do claude.ai (arquivo <b>migracao-dash-eventos.json</b>) ou para recuperar uma cópia. Registros com o mesmo código são substituídos, e cada importação fica no registro de alterações com a versão anterior guardada.</p>
      <div class="form"><label class="f" style="flex:2">Arquivo JSON<input type="file" id="arq" accept="application/json,.json"></label></div>
      <div id="impPrev"></div>
    </div>`;
    $('#baixaJson').onclick = () => {
      const d = new Date(), nome = `painel-rp-copia-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      const corpo = JSON.stringify({ exportadoEm: d.toISOString(), exportadoPor: EU, eventos: DOCS.eventos, patrocinios: DOCS.patrocinios }, null, 1);
      const url = URL.createObjectURL(new Blob([corpo], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500); toast('Cópia baixada.');
    };
    $('#arq').onchange = async ev => {
      const file = ev.target.files[0], pv = $('#impPrev'); IMPORT = null; pv.innerHTML = '';
      if (!file) return;
      try {
        const j = JSON.parse(await file.text());
        const ev_ = j.eventos && typeof j.eventos === 'object' ? j.eventos : {}, pt = j.patrocinios && typeof j.patrocinios === 'object' ? j.patrocinios : {};
        const ok = id => /^[A-Za-z0-9_.~:@+-]{1,200}$/.test(id);
        const lista = [...Object.entries(ev_).map(([id, d]) => ['eventos', id, d]), ...Object.entries(pt).map(([id, d]) => ['patrocinios', id, d])].filter(([, id, d]) => ok(id) && d && typeof d === 'object' && !Array.isArray(d));
        if (!lista.length) { pv.innerHTML = '<p class="flag">O arquivo não tem eventos nem patrocínios no formato esperado.</p>'; return; }
        IMPORT = lista;
        const sub = lista.filter(([c, id]) => DOCS[c][id]).length;
        pv.innerHTML = `<div class="flag info" style="flex-direction:column;gap:6px">
          <b>${lista.filter(x => x[0] === 'eventos').length} eventos e ${lista.filter(x => x[0] === 'patrocinios').length} patrocínios no arquivo</b>
          <span>${sub ? sub + ' já existem no painel e serão substituídos.' : 'Nenhum deles existe no painel ainda.'}</span>
          <ul style="margin:0;padding-left:18px;max-height:180px;overflow:auto">${lista.map(([c, id, d]) => `<li>${esc(COLS[c])} · ${esc(d.nome || id)}${DOCS[c][id] ? ' <i>(substitui)</i>' : ''}</li>`).join('')}</ul>
          <div><button class="btn btn-primary" id="impOk">Importar ${lista.length} registros</button></div></div>`;
        $('#impOk').onclick = importar;
      } catch (e) { pv.innerHTML = '<p class="flag">Não deu para ler o arquivo. Confira se é o JSON exportado do painel.</p>'; }
    };
  }
  async function importar() {
    const b = $('#impOk'); if (!IMPORT) return; b.disabled = true;
    let feitos = 0, erros = 0;
    for (const [c, id, d] of IMPORT) {
      b.textContent = `Importando ${feitos + erros + 1} de ${IMPORT.length}…`;
      try { await Nuvem.gravar(c, id, d, { acao: 'importou', extra: { obs: 'Importado de arquivo JSON' } }); feitos++; } catch (e) { erros++; }
    }
    IMPORT = null; LOGS = []; ultimoLog = null; fimLogs = false;
    $('#impPrev').innerHTML = `<p class="flag ${erros ? '' : 'info'}">${feitos} registros importados${erros ? ', ' + erros + ' não foram salvos (confira a conexão e importe de novo)' : ''}.</p>`;
    toast('Importação concluída.');
  }

  // ---------------- início ----------------
  async function iniciar() {
    lerHash();
    await Nuvem.sessao();
    fs = Nuvem.fs(); EU = (Nuvem.usuario.email || '').toLowerCase();
    if (!Nuvem.pode('admin')) {
      document.getElementById('app').innerHTML = `<header class="top"><div class="wrap"><div class="toprow"><img src="assets/img/logo.png" alt="Dellamed" class="logo" style="height:32px">${Nuvem.chip({ admin: true, painel: true })}</div>
        <h1><b>Administração</b></h1><p>Esta área é só para administradores do painel.</p><a class="back" href="./" style="text-decoration:none">Voltar ao painel</a></div></header>`;
      return;
    }
    const redesenhar = () => { const a = document.activeElement; if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.closest('#painel')) return; if (aba !== 'logs') moldura(); };
    fs.collection('usuarios').onSnapshot(s => { USU = s.docs.map(d => Object.assign({ email: d.id }, d.data({ serverTimestamps: 'estimate' }))); redesenhar(); }, () => toast('Não deu para carregar os usuários.'));
    ['eventos', 'patrocinios'].forEach(c => fs.collection(c).onSnapshot(s => { const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); DOCS[c] = m; redesenhar(); }, () => {}));
    moldura();
    addEventListener('hashchange', () => { lerHash(); moldura(); });
  }
  iniciar();
})();
