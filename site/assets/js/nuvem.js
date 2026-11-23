/* Painel RP Dellamed · camada de nuvem
   Login com Google, banco Firestore, perfis de acesso e registro de alterações (logs).
   Expõe window.Nuvem. O app.js conversa com o banco pelo objeto Nuvem.DB, que tem a mesma
   forma do banco usado na versão claude.ai: collection(c).doc(id).set/delete, doc(path), onSnapshot. */
(function () {
  'use strict';
  const CFG = window.PAINEL_CONFIG || {};
  const PAPEIS = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitura' };
  const JANELA_LOG = 10 * 60 * 1000; // alterações seguidas da mesma pessoa no mesmo item viram um registro só
  const N = { PAPEIS, usuario: null, perfil: null, USUARIOS: {}, configurado: false, DB: null };
  window.Nuvem = N;

  const fb = window.firebase;
  N.configurado = !!(fb && CFG.firebase && CFG.firebase.apiKey && !/COLE/i.test(CFG.firebase.apiKey));
  let auth = null, fs = null;
  if (N.configurado) {
    fb.initializeApp(CFG.firebase);
    auth = fb.auth();
    fs = fb.firestore();
    try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (_) {}
    if (CFG.emulador) { auth.useEmulator(CFG.emulador.auth); fs.useEmulator(CFG.emulador.host, CFG.emulador.porta); } // só para testes locais
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }
  const ts = () => fb.firestore.FieldValue.serverTimestamp();
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- erros em português, no formato que o app já entende ----------
  function mapErr(e) {
    const c = (e && e.code) || '';
    const out = new Error(e && e.message);
    out.code = c === 'permission-denied' ? 'permission-denied'
      : c === 'resource-exhausted' ? 'quota_exceeded'
      : c === 'unauthenticated' ? 'revoked' : (c || 'erro');
    if (c === 'permission-denied' && e && e.__leitura) out.code = 'revoked';
    return out;
  }

  // ---------- descrição das alterações (o que aparece no log) ----------
  const ROT = { nome: 'Nome', sub: 'Complemento', tipo: 'Tipo', fase: 'Fase', inicio: 'Início', fim: 'Fim', local: 'Local',
    verba: 'Verba', ata: 'Ata no Canva', credLimite: 'Credenciais incluídas', ano: 'Ano', notas: 'Anotações', valor: 'Valor',
    status: 'Status', resp: 'Responsável', evId: 'Evento ligado', evIni: 'Data do evento', evFim: 'Fim do evento',
    evLocal: 'Local do evento', evDesc: 'Informações do evento', hotel: 'Hotel', res: 'Resultados', abas: 'Abas',
    mesPrev: 'Mês previsto', contra: 'Contrapartidas', papel: 'Papel', ativo: 'Acesso' };
  const LISTAS = {
    itens: ['Orçamento', x => x.item || x.t || ''], tarefas: ['Checklist', x => x.t || ''], cot: ['Cotações', x => x.seg || ''],
    equipe: ['Equipe', x => x.nome || ''], trechos: ['Voos', x => [x.nome, x.dir === 'ida' ? 'ida' : x.dir ? 'volta' : ''].filter(Boolean).join(' · ')],
    quartos: ['Hospedagem', x => (x.ocup || []).filter(Boolean).join(' e ') || 'quarto'], avisos: ['Avisos', x => x.t || ''],
    contraItens: ['Contrapartidas', x => x.t || ''], hoteis: ['Hotéis', x => x.nome || 'hotel']
  };
  const IGNORA = new Set(['atualizadoEm', 'atualizadoPor', 'ultimoAcesso', 'nomeGoogle', 'foto']);
  const TEXTO_LONGO = new Set(['notas', 'evDesc', 'contra']);
  const VAL = {
    fase: { plan: 'Em planejamento', draft: 'Rascunho', done: 'Realizado' },
    tipo: { feira: 'Feira', interno: 'Evento interno', aberto: 'Evento aberto', canal: 'Ação de canal', corrida: 'Corrida', valor: 'Só valor', acao: 'Valor + ação' },
    papel: PAPEIS, ativo: { true: 'liberado', false: 'bloqueado' }
  };
  function fmtVal(k, v) {
    if (v == null || v === '') return 'vazio';
    if (VAL[k] && VAL[k][v] != null) return VAL[k][v];
    if ((k === 'verba' || k === 'valor') && !isNaN(v)) return (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4);
    if (typeof v === 'object') return 'alterado';
    const s = String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s;
  }
  // JSON com chaves em ordem: a mesma informação gravada em outra ordem não conta como mudança.
  const est = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => { o[c] = x[c]; return o; }, {}) : x));
  function listaDiff(rotulo, nomeDe, a, b) {
    a = Array.isArray(a) ? a : []; b = Array.isArray(b) ? b : [];
    const conta = new Map(); a.forEach(x => { const j = est(x); conta.set(j, (conta.get(j) || 0) + 1); });
    const novos = []; b.forEach(x => { const j = est(x); if (conta.get(j)) conta.set(j, conta.get(j) - 1); else novos.push(x); });
    const saiu = []; a.forEach(x => { const j = est(x); if (conta.get(j)) { conta.set(j, conta.get(j) - 1); saiu.push(x); } });
    const nm = x => (nomeDe(x) || '').trim() || 'sem nome';
    const alt = [], inc = [], rem = saiu.map(nm);
    novos.forEach(x => { const n = nm(x), i = rem.indexOf(n); if (i >= 0) { rem.splice(i, 1); alt.push(n); } else inc.push(n); });
    if (!alt.length && !inc.length && !rem.length) return null;
    const lim = l => l.slice(0, 4).map(n => '“' + n + '”').join(', ') + (l.length > 4 ? ' e mais ' + (l.length - 4) : '');
    const p = [];
    if (inc.length) p.push('incluiu ' + lim(inc));
    if (alt.length) p.push('alterou ' + lim(alt));
    if (rem.length) p.push('removeu ' + lim(rem));
    return rotulo + ': ' + p.join('; ');
  }
  function descrever(col, antes, depois) {
    // O app informa como ele normaliza cada documento; assim a primeira gravação depois de uma
    // importação não aparece como "alterou tudo" só porque o formato foi completado.
    if (antes && depois && typeof N.normalizar === 'function') { try { antes = N.normalizar(col, antes); depois = N.normalizar(col, depois); } catch (_) {} }
    if (!antes) return ['Criou “' + ((depois && (depois.nome || depois.email)) || 'registro') + '”'];
    if (!depois) return ['Excluiu “' + (antes.nome || antes.email || 'registro') + '”'];
    const out = [];
    const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
    chaves.forEach(k => {
      if (IGNORA.has(k)) return;
      const a = antes[k], b = depois[k];
      if (est(a ?? null) === est(b ?? null)) return;
      if (col === 'geral' && k === 'itens') { const d = listaDiff('Lista geral', x => x.t, a, b); if (d) out.push(d); return; }
      if (LISTAS[k]) { const d = listaDiff(LISTAS[k][0], LISTAS[k][1], a, b); if (d) out.push(d); return; }
      const r = ROT[k] || k;
      if (TEXTO_LONGO.has(k)) { out.push(r + ' alteradas'); return; }
      if ((a && typeof a === 'object') || (b && typeof b === 'object')) { out.push(r + ' alterado'); return; }
      out.push(r + ': ' + fmtVal(k, a) + ' → ' + fmtVal(k, b));
    });
    return out;
  }
  N.descrever = descrever;

  // ---------- gravação com registro ----------
  const CACHE = {};   // última versão conhecida de cada documento, para comparar
  const ABERTOS = {}; // registro de log em aberto por documento
  function eu() { const p = N.perfil || {}; return { email: (N.usuario && N.usuario.email || '').toLowerCase(), nome: p.nome || (N.usuario && N.usuario.displayName) || '' }; }
  function nomeDoc(d) { return (d && (d.nome || d.email)) || ''; }
  function logar(batch, col, docId, acao, antes, depois, extra) {
    const mud = descrever(col, antes, depois);
    if (acao === 'alterou' && !mud.length) return;
    const key = col + '/' + docId, ab = ABERTOS[key], agora = Date.now(), me = eu();
    const nome = nomeDoc(depois) || nomeDoc(antes) || docId;
    if (acao === 'alterou' && ab && agora - ab.t < JANELA_LOG && ab.n + mud.length < 250) {
      batch.update(fs.collection('logs').doc(ab.id), { fim: ts(), mudancas: fb.firestore.FieldValue.arrayUnion(...mud), vezes: fb.firestore.FieldValue.increment(1), nomeDoc: nome });
      ab.n += mud.length; return;
    }
    const ref = fs.collection('logs').doc();
    batch.set(ref, Object.assign({ email: me.email, nome: me.nome, quando: ts(), fim: ts(), col, docId, nomeDoc: nome, acao, mudancas: mud, vezes: 1, temVersao: !!antes }, extra || {}));
    if (antes) batch.set(fs.collection('versoes').doc(ref.id), { col, docId, dados: antes, quando: ts(), email: me.email });
    ABERTOS[key] = acao === 'alterou' ? { id: ref.id, t: agora, n: mud.length } : null;
  }
  async function gravar(col, id, dados, opt) {
    opt = opt || {};
    const key = col + '/' + id;
    let antes = key in CACHE ? CACHE[key] : undefined;
    if (antes === undefined) { try { const s = await fs.collection(col).doc(id).get(); antes = s.exists ? s.data() : null; } catch (_) { antes = null; } }
    const b = fs.batch();
    b.set(fs.collection(col).doc(id), dados);
    logar(b, col, id, opt.acao || (antes ? 'alterou' : 'criou'), antes, dados, opt.extra);
    try { await b.commit(); } catch (e) { throw mapErr(e); }
    CACHE[key] = clone(dados);
  }
  async function apagar(col, id) {
    const key = col + '/' + id;
    let antes = CACHE[key];
    if (!antes) { try { const s = await fs.collection(col).doc(id).get(); antes = s.exists ? s.data() : null; } catch (_) { antes = null; } }
    const b = fs.batch();
    b.delete(fs.collection(col).doc(id));
    logar(b, col, id, 'excluiu', antes, null);
    try { await b.commit(); } catch (e) { throw mapErr(e); }
    delete CACHE[key];
  }
  N.gravar = gravar; N.apagar = apagar;
  N.fs = () => fs;

  // Mesmo formato do banco da versão claude.ai, para o app.js mudar o mínimo.
  function docSnap(d) { return { id: d.id, exists: d.exists, data: () => d.data() }; }
  N.DB = {
    collection(c) {
      return {
        doc(id) { return { set: d => gravar(c, id, d), delete: () => apagar(c, id), get: () => fs.collection(c).doc(id).get() }; },
        onSnapshot(ok, err) {
          return fs.collection(c).onSnapshot(snap => {
            snap.docs.forEach(d => { if (!d.metadata.hasPendingWrites) CACHE[c + '/' + d.id] = d.data(); });
            ok({ docs: snap.docs.map(docSnap), metadata: { fromCache: snap.metadata.fromCache } });
          }, e => { e.__leitura = true; err && err(mapErr(e)); });
        }
      };
    },
    doc(path) {
      const [c, id] = path.split('/');
      return {
        set: d => gravar(c, id, d),
        onSnapshot(ok, err) {
          return fs.doc(path).onSnapshot(d => { if (d.exists && !d.metadata.hasPendingWrites) CACHE[path] = d.data(); ok(docSnap(d)); },
            e => { e.__leitura = true; err && err(mapErr(e)); });
        }
      };
    }
  };

  // ---------- pessoas ----------
  N.nomeDe = em => { if (!em) return ''; const u = N.USUARIOS[String(em).toLowerCase()]; return (u && u.nome) || (String(em).includes('@') ? String(em).split('@')[0] : ''); };
  N.pode = acao => {
    const p = N.perfil && N.perfil.papel;
    if (acao === 'editar') return p === 'admin' || p === 'editor';
    if (acao === 'admin') return p === 'admin';
    return !!p;
  };
  function ouvirUsuarios() {
    fs.collection('usuarios').onSnapshot(s => {
      const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); N.USUARIOS = m;
      document.dispatchEvent(new CustomEvent('nuvem:usuarios'));
    }, () => {});
  }

  // ---------- tela de entrada ----------
  const LOGO = 'assets/img/logo.png';
  function porta(html) {
    let el = document.getElementById('porta');
    if (!el) { el = document.createElement('div'); el.id = 'porta'; document.body.appendChild(el); }
    el.innerHTML = `<div class="porta-in">
      <img src="${LOGO}" alt="Dellamed" class="porta-logo" width="221" height="48">
      <h1><b>Painel RP</b> ${new Date().getFullYear() < 2027 ? 2027 : new Date().getFullYear()}</h1>
      ${html}
      <p class="porta-rodape">Saúde e bem-estar para todos.</p></div>`;
    el.hidden = false;
    return el;
  }
  function fecharPorta() { const el = document.getElementById('porta'); if (el) el.hidden = true; }
  const G_ICO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M16.5 12H12M16.3 9.2A5 5 0 1 0 17 12"/></svg>';
  function telaEntrar(msg, tipo) {
    const el = porta(`<p>Entre com a sua conta Google da Dellamed para ver e editar os eventos.</p>
      ${msg ? `<p class="porta-msg ${tipo || ''}" role="alert">${msg}</p>` : ''}
      <button class="btn btn-primary porta-btn" id="entrarG">${G_ICO} Entrar com Google</button>`);
    el.querySelector('#entrarG').onclick = entrar;
    el.querySelector('#entrarG').focus();
  }
  function msgErroAuth(e) {
    const c = e && e.code;
    if (c === 'auth/unauthorized-domain') return 'Este endereço ainda não está autorizado no Firebase. Em Authentication › Configurações › Domínios autorizados, adicione ' + escH(location.hostname) + '.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/network-request-failed') return 'Sem conexão com a internet. Confira a rede e tente de novo.';
    return 'Não deu para entrar agora (' + escH(c || 'erro') + '). Tente de novo em instantes.';
  }
  async function entrar() {
    const prov = new fb.auth.GoogleAuthProvider();
    const par = { prompt: 'select_account' }; if (CFG.dominio) par.hd = CFG.dominio;
    prov.setCustomParameters(par);
    const b = document.getElementById('entrarG'); if (b) { b.disabled = true; b.textContent = 'Abrindo o Google…'; }
    try { await auth.signInWithPopup(prov); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { try { await auth.signInWithRedirect(prov); return; } catch (e2) { e = e2; } }
      telaEntrar(msgErroAuth(e), 'erro');
    }
  }
  N.sair = async () => { try { await auth.signOut(); } catch (_) {} location.href = location.pathname.replace(/[^/]*$/, '') || './'; };

  async function carregarPerfil(user) {
    const em = (user.email || '').toLowerCase();
    const ref = fs.collection('usuarios').doc(em);
    let s;
    try { s = await ref.get(); } catch (e) { return { erro: 'leitura', e }; }
    if (!s.exists) {
      // Só funciona para o e-mail cadastrado como administrador inicial nas regras do Firestore.
      try {
        const novo = { email: em, nome: user.displayName || em, papel: 'admin', ativo: true, criadoEm: ts(), criadoPor: em };
        const b = fs.batch(); b.set(ref, novo);
        N.usuario = user; N.perfil = novo;
        logar(b, 'usuarios', em, 'criou', null, novo, { obs: 'Primeiro acesso do administrador inicial' });
        await b.commit(); s = await ref.get();
      } catch (_) { N.perfil = null; return { erro: 'sem-cadastro' }; }
    }
    const p = s.data();
    if (!p || p.ativo === false) return { erro: 'bloqueado' };
    ref.update({ ultimoAcesso: ts(), nomeGoogle: user.displayName || '', foto: user.photoURL || '' }).catch(() => {});
    return { perfil: p };
  }

  // Resolve quando a pessoa está logada e liberada. Até lá, mostra a tela de entrada.
  N.sessao = function () {
    return new Promise(resolve => {
      if (!N.configurado) {
        porta(`<p class="porta-msg erro" role="alert">O painel ainda não foi ligado ao Firebase.</p>
          <p>Preencha o arquivo <code>assets/js/config.js</code> com a configuração do projeto Firebase (passo a passo no README do repositório).</p>`);
        return;
      }
      porta('<p role="status">Conferindo o seu acesso…</p>');
      auth.getRedirectResult().catch(e => telaEntrar(msgErroAuth(e), 'erro'));
      let resolvido = false;
      auth.onAuthStateChanged(async user => {
        if (!user) { if (resolvido) location.reload(); else telaEntrar(); return; }
        if (resolvido) return;
        porta('<p role="status">Conferindo o seu acesso…</p>');
        N.usuario = user;
        const r = await carregarPerfil(user);
        if (r.erro) {
          const em = escH(user.email);
          const el = porta(`<p class="porta-msg erro" role="alert">${r.erro === 'bloqueado' ? 'O acesso de <b>' + em + '</b> está bloqueado.' : 'A conta <b>' + em + '</b> ainda não tem acesso ao painel.'}</p>
            <p>Peça a um administrador para liberar o seu e-mail em <b>Administração › Usuários</b>.</p>
            <button class="btn btn-primary porta-btn" id="outra">Entrar com outra conta</button>`);
          el.querySelector('#outra').onclick = async () => { await auth.signOut(); };
          return;
        }
        resolvido = true;
        N.perfil = r.perfil;
        ouvirUsuarios();
        fecharPorta();
        resolve({ usuario: user, perfil: r.perfil });
      });
    });
  };

  // ---------- botão da pessoa no topo ----------
  N.chip = function (opts) {
    opts = opts || {};
    if (!N.perfil) return '';
    const nome = N.perfil.nome || N.usuario.displayName || N.usuario.email;
    const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    const foto = N.usuario.photoURL;
    return `<details class="uchip">
      <summary aria-label="Conta de ${escH(nome)}">${foto ? `<img src="${escH(foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="uini">${escH(ini)}</span>`}
        <span class="unome">${escH(nome.split(' ')[0])}</span><span class="upapel">${PAPEIS[N.perfil.papel] || ''}</span></summary>
      <div class="umenu" role="menu">
        <p><b>${escH(nome)}</b><br>${escH(N.usuario.email)}</p>
        ${opts.painel ? '<a role="menuitem" href="./">Voltar ao painel</a>' : ''}
        ${N.pode('admin') && !opts.admin ? '<a role="menuitem" href="admin.html">Administração</a>' : ''}
        <button role="menuitem" type="button" data-sair>Sair</button>
      </div></details>`;
  };
  document.addEventListener('click', ev => {
    if (ev.target.closest && ev.target.closest('[data-sair]')) { N.sair(); return; }
    document.querySelectorAll('details.uchip[open]').forEach(d => { if (!d.contains(ev.target)) d.removeAttribute('open'); });
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') document.querySelectorAll('details.uchip[open]').forEach(d => { d.removeAttribute('open'); d.querySelector('summary').focus(); }); });
})();
