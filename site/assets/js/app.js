/* Painel RP Dellamed · telas e regras do painel (mesma lógica da versão claude.ai). */
const LOGO='assets/img/logo.png';
const logoHTML=(h=32)=>`<img src="${LOGO}" alt="Dellamed" class="logo" style="height:${h}px">`;
// linha do topo: logo + conta da pessoa (nome, papel, Administração, Sair)
const topoLogo=h=>`<div class="toprow">${logoHTML(h)}${window.Nuvem?Nuvem.chip():''}</div>`;
const I={
  cal:'<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pin:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  plus:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  doc:'<svg class="ico" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
  check:'<svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  grid:'<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
  down:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  back:'<svg class="ico" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  coin:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11"/></svg>',
  warn:'<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
  search:'<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  hist:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 2"/></svg>'
};

// Dados vêm do Firestore (coleções "eventos" e "patrocinios"); nada fixo aqui.
let EVENTOS=[];
let DB=null, USER=null, MEU_ID=null, podeEditar=true, souDono=false, carregado=false, erroCarga='';
function prep(e){
  const d={abas:[],equipe:[],quartos:[],trechos:[],cot:[],res:{},notas:'',itens:[],tarefas:[],avisos:[],tipo:'feira',fase:'draft',
    nome:'',sub:'',local:'',inicio:'',fim:'',verba:null,ata:'',hotel:{nome:'',single:0,duplo:0}};
  for(const k in d) if(e[k]==null) e[k]=d[k];
  if(!e.ano) e.ano=e.inicio?+e.inicio.slice(0,4):new Date().getFullYear();
  e.segAtivo=e.segAtivo||0; return e;
}
// O banco não guarda listas dentro de listas: itens, tarefas e avisos viram objetos.
function toDb(e){const c=JSON.parse(JSON.stringify(e));delete c.segAtivo;delete c.id;delete c._col;
  c.itens=e.itens.map(i=>({cat:i[0],item:i[1],desc:i[2],forn:i[3],total:i[4],status:i[5],seg:i[6]||'',req:i[7]||'',real:i[8]??null}));
  c.tarefas=e.tarefas.map(t=>({t:t[0],w:t[1]||'',feito:!!t[2],resp:t[3]||'',prazo:t[4]||''}));c.avisos=e.avisos.map(a=>({k:a[0],t:a[1]}));return c}
function fromDb(id,d){const e=JSON.parse(JSON.stringify(d||{}));e.id=id;
  e.itens=(e.itens||[]).map(i=>[i.cat||'Outros',i.item||'',i.desc||'',i.forn||'',+i.total||0,i.status||'Estimativa',i.seg||'',i.req||'',i.real==null||i.real===''?null:+i.real]);
  (e.cot||[]).forEach(c=>{c.notas=c.notas||[];const velho=!c.forns;migrarCot(c);if(!velho)return;
    const marc=c.forns.flatMap(f=>f.ops.filter(o=>o.esc));
    if(e.itens.some(i=>i[6]===c.seg))return;
    const leg=c.item?e.itens.find(i=>i[1]===c.item&&!i[6]):null;
    if(marc.length===1&&leg&&Math.abs(leg[4]-opTotal(marc[0]))<0.01)leg[6]=c.seg;
    else marc.forEach(o=>o.esc=false)});e.tarefas=(e.tarefas||[]).map(t=>[t.t||'',t.w||'',!!t.feito,t.resp||'',t.prazo||'']);e.avisos=(e.avisos||[]).map(a=>[a.k||'warn',a.t||'']);return prep(e)}
const MESES=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const CATS=['Espaço','Montagem','Logística','Ativação e brindes','Material e divulgação','Serviços','Taxas da feira','Outros'];
const STATUS=['Estimativa','Orçado','Pendente','Contratado','Pago'];
function dataTxt(e){if(!e.inicio)return 'Data a definir';const [a,m,d]=e.inicio.split('-');
  if(!e.fim||e.fim===e.inicio)return `${d}/${m}/${a}`;const [a2,m2,d2]=e.fim.split('-');
  return m===m2&&a===a2?`${d} a ${d2}/${m}/${a}`:`${d}/${m} a ${d2}/${m2}/${a2}`}
function mesDe(e){if(e.inicio)return MESES[+e.inicio.split('-')[1]-1];return e.mesPrev?MESES[e.mesPrev-1]:null}
function ordemDe(e){if(e.inicio){const [,m,d]=e.inicio.split('-');return +m+ +d/100}return e.mesPrev||99}
const TIPOS={feira:'Feira',interno:'Evento interno',aberto:'Evento aberto',canal:'Ação de canal',corrida:'Corrida'};
const MODULOS={
  equipe:{nome:'Equipe',desc:'Quem vai, função e credencial'},
  voos:{nome:'Voos',desc:'Trechos de ida e volta, com localizador e valor'},
  hospedagem:{nome:'Hospedagem',desc:'Hotel, quartos, período e quem divide'},
  notas:{nome:'Anotações',desc:'Texto livre para o que não cabe nas outras'}
};
const FASES={all:'Todos',plan:'Em planejamento',draft:'Rascunho',done:'Realizados'};
const FASE_TAG={plan:'Em planejamento',draft:'Rascunho',done:'Realizado'};
const fmtBR=v=>v==null||v===''||isNaN(v)?'':(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const parseBR=s=>{const d=String(s??'').replace(/\D/g,'');return d?+d/100:null};
document.addEventListener('input',ev=>{const el=ev.target;if(!el.classList||!el.classList.contains('brl'))return;const v=parseBR(el.value);el.value=v==null?'':fmtBR(v)});
document.addEventListener('input',ev=>{const el=ev.target;if(!el.classList||!el.classList.contains('hora'))return;
  const d=el.value.replace(/\D/g,'').slice(0,4);el.value=d.length>2?d.slice(0,2)+':'+d.slice(2):d;
  const ok=!d||(d.length===4&&+d.slice(0,2)<24&&+d.slice(2)<60);el.setCustomValidity(ok||d.length<4?'':'Horário inválido');el.classList.toggle('erro',d.length===4&&!ok)});
const isoBR=iso=>iso&&/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'';
// '' = vazio; null = data inválida; senão ISO. Com só dia e mês, usa o ano padrão.
function brISO(txt,anoPadrao){const d=String(txt||'').replace(/\D/g,'');if(!d)return '';
  let dd,mm,aa;if(d.length===4&&anoPadrao){dd=d.slice(0,2);mm=d.slice(2,4);aa=String(anoPadrao)}else if(d.length===8){dd=d.slice(0,2);mm=d.slice(2,4);aa=d.slice(4)}else return null;
  const dt=new Date(+aa,+mm-1,+dd);if(dt.getFullYear()!==+aa||dt.getMonth()!==+mm-1||dt.getDate()!==+dd)return null;return `${aa}-${mm}-${dd}`}
document.addEventListener('input',ev=>{const el=ev.target;if(!el.classList||!el.classList.contains('data'))return;
  const d=el.value.replace(/\D/g,'').slice(0,8);el.value=d.length>4?d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4):d.length>2?d.slice(0,2)+'/'+d.slice(2):d;el.classList.remove('erro')});
document.addEventListener('focusin',ev=>{const el=ev.target;if(el.classList&&(el.classList.contains('brl')||el.classList.contains('hora')||el.classList.contains('data')))setTimeout(()=>{try{el.select()}catch(_){}},0)});
function dataInvalida(inp){inp.classList.add('erro');toast('Data inválida. Digite dia, mês e ano, por exemplo 15032027 para 15/03/2027.');inp.focus();inp.select()}
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const brl2=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const total=e=>e.itens.reduce((s,i)=>s+i[4],0);
const realizado=e=>e.itens.reduce((s,i)=>s+(i[8]??0),0);
// comprometido: o realizado de cada item, ou o previsto quando ainda não tem realizado
const comprometido=e=>e.itens.reduce((s,i)=>s+(i[8]!=null?i[8]:i[4]),0);
let PERG=null; // pergunta "lançar no orçamento?" depois de marcar uma cotação
let filtro='all', ano=2027, vista='cal', verEv=false, verPat=false, busca='';
const bate=x=>!busca||normS([x.nome,x.sub,x.local,x.evLocal].filter(Boolean).join(' ')).includes(normS(busca));
function anosLista(){const a=new Set([...EVENTOS.map(e=>e.ano),...PATROS.map(p=>p.ano)]);a.add(ano);a.add(new Date().getFullYear());return [...a].sort()}

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2600)}

// ---------- "Fazendo agora": lista geral da equipe na tela inicial ----------
let GERAL={tarefas:[]},GERAL_PEND=null,GERAL_ULT='';
function salvarGeral(){if(!DB||podeEditar===false)return;clearTimeout(GERAL_PEND);
  GERAL_PEND=setTimeout(async()=>{GERAL_PEND=null;const corpo={itens:GERAL.tarefas,atualizadoEm:new Date().toISOString()};if(MEU_ID)corpo.atualizadoPor=MEU_ID;
    const j=JSON.stringify(GERAL.tarefas);if(j===GERAL_ULT)return;setSync('Salvando…','on');
    try{await DB.doc('geral/tarefas').set(corpo);GERAL_ULT=j;setSync('Salvo','ok')}catch(err){setSync('Não salvo. Verifique a conexão','err')}},500)}
function fazHTML(){
  const T=GERAL.tarefas, abertas=T.map((t,i)=>[t,i]).filter(([t])=>!t.feito), feitas=T.map((t,i)=>[t,i]).filter(([t])=>t.feito);
  const evs=EVENTOS.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const sel=(i,v)=>`<select data-gf="${i}.ev" aria-label="Evento"><option value="">Geral</option>${evs.map(e=>`<option value="${e.id}" ${e.id===v?'selected':''}>${esc(e.nome)}</option>`).join('')}</select>`;
  const linha=([t,i])=>`<tr class="${t.feito?'feita':''}">
    <td><input type="checkbox" data-gk="${i}" ${t.feito?'checked':''} aria-label="Marcar como feito" style="width:22px;height:22px;min-height:22px"></td>
    <td><input data-gf="${i}.t" value="${esc(t.t)}" aria-label="O que está sendo feito" style="min-width:240px"></td>
    <td><input data-gf="${i}.resp" data-sug="resp" autocomplete="off" value="${esc(t.resp||'')}" placeholder="Quem" aria-label="Responsável" style="min-width:150px"></td>
    <td>${sel(i,t.ev)}</td>
    <td><button class="link" data-gdel="${i}" aria-label="Excluir">Excluir</button></td></tr>`;
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><h3>Fazendo agora <span class="who" style="font-family:var(--font-body);font-weight:400">· ${abertas.length} em andamento</span></h3>
    ${feitas.length?`<button class="link" id="gLimpar" style="color:var(--navy)">Limpar ${feitas.length} ${feitas.length===1?'feita':'feitas'}</button>`:''}</div>
    ${T.length?`<div class="tbl"><table class="quartos chk"><thead><tr><th style="width:44px">Feito</th><th>O que está sendo feito</th><th>Quem</th><th>Evento</th><th></th></tr></thead>
      <tbody>${abertas.map(linha).join('')}${feitas.map(linha).join('')}</tbody></table></div>`:'<p class="note" style="margin-top:0">Nada na lista. Anote abaixo o que cada um está tocando.</p>'}
    <form class="form" id="fFaz" novalidate>
      <label class="f" style="flex:2 1 260px">O que está sendo feito<input name="t" autocomplete="off" placeholder="Ex.: fechando cotação de buffet"></label>
      <label class="f">Quem<input name="resp" data-sug="resp" autocomplete="off"></label>
      <label class="f">Evento<select name="ev"><option value="">Geral</option>${evs.map(e=>`<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></label>
      <button class="btn btn-primary">${I.plus} Adicionar</button></form>`;
}
function renderFaz(){const F=document.getElementById('faz');if(!F)return;F.innerHTML=fazHTML();ligarFaz();aplicarRO(F);salvarGeral();restaurarFoco(F)}
function ligarFaz(){const F=document.getElementById('faz');if(!F)return;const T=GERAL.tarefas;
  F.querySelectorAll('[data-gk]').forEach(c=>c.onchange=()=>{T[+c.dataset.gk].feito=c.checked;renderFaz()});
  F.querySelectorAll('[data-gf]').forEach(inp=>inp.onchange=()=>{const [i,k]=inp.dataset.gf.split('.');
    if(k==='t'&&!inp.value.trim()){inp.value=T[+i].t;return}T[+i][k]=inp.value.trim();renderFaz()});
  F.querySelectorAll('[data-gdel]').forEach(b=>b.onclick=()=>{T.splice(+b.dataset.gdel,1);renderFaz()});
  const lp=F.querySelector('#gLimpar');if(lp)lp.onclick=()=>{GERAL.tarefas=T.filter(t=>!t.feito);renderFaz()};
  F.querySelector('#fFaz').onsubmit=ev=>{ev.preventDefault();const f=ev.target;const t=f.t.value.trim();if(!t){f.t.focus();toast('Escreva o que está sendo feito.');return}
    T.push({t,resp:f.resp.value.trim(),ev:f.ev.value,feito:false,criadoEm:new Date().toISOString()});renderFaz();document.querySelector('#fFaz [name=t]')?.focus()}}
function home(){
  const doAno=EVENTOS.filter(e=>e.ano===ano).sort((a,b)=>ordemDe(a)-ordemDe(b));
  const acaoIds=new Set(PATROS.filter(p=>p.tipo==='acao'&&p.evId).map(p=>p.evId));
  const cal=vista==='cal', vEv=cal||verEv, vPat=cal||verPat;
  const lista=vEv?doAno.filter(e=>(filtro==='all'||e.fase===filtro)&&((vPat&&!cal)||!acaoIds.has(e.id))&&bate(e)):[];
  const patLista=vPat?PATROS.filter(p=>p.ano===ano&&bate(p)).sort((a,b)=>ordemDe(pd(a))-ordemDe(pd(b))):[];
  const verbaAno=doAno.reduce((s,e)=>s+(e.verba||0),0), patAno=PATROS.filter(p=>p.ano===ano).reduce((s,p)=>s+(+p.valor||0),0);
  const ANOS=anosLista();const i=ANOS.indexOf(ano);
  document.getElementById('app').innerHTML=`
  <header class="top ${!cal&&verPat&&!verEv?'patro-on':''}"><div class="wrap">
    <div class="toprow"><span class="brand" style="display:flex;align-items:center;gap:14px">${logoHTML(38)}<span style="border-left:1px solid rgba(255,255,255,.3);padding-left:14px">RELAÇÕES PÚBLICAS</span></span>${window.Nuvem?Nuvem.chip():''}</div>
    <div class="yrow">
      <h1><b>Painel RP</b> ${ano}</h1>
      <div class="years" role="group" aria-label="Ano">
        <button class="yarrow" data-y="${ANOS[i-1]??''}" ${i<=0?'disabled':''} aria-label="Ano anterior">${I.back}</button>
        ${ANOS.map(a=>`<button class="ybtn" aria-pressed="${a===ano}" data-y="${a}">${a}</button>`).join('')}
        <button class="yarrow next" data-y="${ANOS[i+1]??''}" ${i>=ANOS.length-1?'disabled':''} aria-label="Próximo ano">${I.back}</button>
      </div>
    </div>
    <p class="num" style="line-height:1.7">${doAno.length} ${doAno.length===1?'evento':'eventos'} no ano${verbaAno?'<br>Verba dos eventos '+brl(verbaAno):''}${patAno?'<br>Patrocínios '+brl(patAno):''}</p>
  </div></header>
  <main class="wrap">
    <div class="bar">
      <div class="seg" role="group" aria-label="Modo de ver">
        <button aria-pressed="${vista==='cal'}" data-cal title="Ver em calendário">${I.cal} Calendário</button>
        <button aria-pressed="${!cal&&verEv}" data-ver="ev">${I.grid} Eventos</button>
        <button aria-pressed="${!cal&&verPat}" data-ver="pat">${I.coin} Patrocínios</button>
      </div>
      <div class="chips" role="group" aria-label="Filtrar por fase" ${vEv?'':'style="display:none"'}>
        ${Object.entries(FASES).map(([k,v])=>`<button class="chip" aria-pressed="${filtro===k}" data-f="${k}">${v}</button>`).join('')}
      </div>
      <span class="spacer"></span>
      <label class="busca">${I.search}<span class="sr">Buscar evento ou patrocínio</span><input id="busca" type="search" value="${esc(busca)}" placeholder="Buscar evento" autocomplete="off" data-livre></label>
      <span style="display:flex;gap:8px;flex-wrap:wrap">${vEv?`<button class="btn btn-primary" data-new>${I.plus} ${vPat?'Evento':'Novo evento'}</button>`:''}${vPat?`<button class="btn btn-primary" data-newp style="background:var(--patro)">${I.plus} ${vEv?'Patrocínio':'Novo patrocínio'}</button>`:''}</span>
    </div>
    ${!carregado?`<p class="empty" role="status">${erroCarga||'Carregando eventos…'}</p>`:cal?calendario(lista,patLista):!verEv?patroHTML(patLista):`${verPat?patKpis(patLista):''}<div class="grid">
      ${[...lista.map(e=>[ordemDe(e),card(e)]),...patLista.map(p=>[ordemDe(pd(p)),patCard(p)])].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join('')}
      ${filtro==='all'?`<button class="card new" data-new>${I.plus}<span><b>Cadastrar evento</b><br>Feira, evento interno ou aberto, ação de canal ou corrida</span></button>`:''}
      ${verPat?`<button class="card new" data-newp style="border-color:var(--patro);color:var(--patro)">${I.plus}<span><b>Cadastrar patrocínio</b><br>Só valor ou valor + ação</span></button>`:''}
    </div>
    ${lista.length||patLista.length?'':`<p class="empty">${busca?'Nada encontrado para “'+esc(busca)+'” em '+ano+'. Confira a grafia ou troque o ano.':doAno.length?'Nenhum evento nessa fase. Troque o filtro ou cadastre um novo.':'Nenhum evento em '+ano+'. Cadastre o primeiro em "Novo evento".'}</p>`}`}
    ${cal&&busca&&!lista.length&&!patLista.length?`<p class="empty">Nada encontrado para “${esc(busca)}” em ${ano}.</p>`:''}
  </main>`;
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filtro=b.dataset.f;home()});
  {const bu=document.getElementById('busca');if(bu){bu.oninput=()=>{busca=bu.value;home();const n=document.getElementById('busca');n.focus();n.setSelectionRange(n.value.length,n.value.length)};
    bu.onkeydown=ev=>{if(ev.key==='Escape'&&bu.value){ev.stopPropagation();bu.value='';bu.oninput()}}}}
  // Calendário é a tela inicial. Eventos e Patrocínios: vindo do calendário, o clique escolhe só aquele;
  // com um deles já escolhido, o clique no outro soma os dois; sem nenhum escolhido, volta ao calendário.
  document.querySelectorAll('[data-cal]').forEach(b=>b.onclick=()=>{vista='cal';verEv=verPat=false;home()});
  document.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>{const k=b.dataset.ver;
    if(vista==='cal'){vista='cards';verEv=k==='ev';verPat=k==='pat'}
    else{if(k==='ev')verEv=!verEv;else verPat=!verPat;if(!verEv&&!verPat)vista='cal'}home()});
  document.querySelectorAll('[data-y]').forEach(b=>b.onclick=()=>{if(b.dataset.y){ano=+b.dataset.y;filtro='all';home()}});
  document.querySelectorAll('[data-new]').forEach(b=>b.onclick=novoEvento);
  document.querySelectorAll('[data-newp]').forEach(b=>b.onclick=novoPatro);
  document.querySelectorAll('[data-pat]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.pat});
  document.querySelectorAll('[data-ct]').forEach(cb=>cb.onchange=()=>{const [id,i]=cb.dataset.ct.split('|');const e=EVENTOS.find(x=>x.id===id);if(!e)return;
    e.tarefas[+i][2]=cb.checked;salvar(e);toast('Feito: '+e.tarefas[+i][0]);setTimeout(()=>{cb.blur();home()},350)});
  document.querySelectorAll('[data-cta]').forEach(f=>f.onsubmit=ev=>{ev.preventDefault();const e=EVENTOS.find(x=>x.id===f.dataset.cta);const t=f.t.value.trim();
    if(!e||!t){f.t.focus();return}e.tarefas.push([t,'',false,'','']);salvar(e);home();document.querySelector(`[data-cta="${e.id}"] input`)?.focus()});
  aplicarRO();
  document.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.ev});
}

const MESES_N=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function iso(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function pascoa(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;
  return new Date(y,mes-1,dia)}
function feriados(y){const F={};const add=(dt,nome,tipo)=>{F[iso(dt.getFullYear(),dt.getMonth(),dt.getDate())]={nome,tipo}};
  const fx=(m,d,n)=>add(new Date(y,m-1,d),n,'nac');
  fx(1,1,'Confraternização Universal');fx(4,21,'Tiradentes');fx(5,1,'Dia do Trabalho');fx(9,7,'Independência');fx(10,12,'Nossa Senhora Aparecida');
  fx(11,2,'Finados');fx(11,15,'Proclamação da República');if(y>=2024)fx(11,20,'Consciência Negra');fx(12,25,'Natal');
  add(new Date(y,4,26),'Feriado municipal · Caxias do Sul','mun');
  const P=pascoa(y),off=n=>new Date(P.getFullYear(),P.getMonth(),P.getDate()+n);
  add(off(-2),'Sexta-feira Santa','nac');add(off(-48),'Carnaval (ponto facultativo)','fac');add(off(-47),'Carnaval (ponto facultativo)','fac');
  add(off(-46),'Quarta de Cinzas (ponto facultativo até 14h)','fac');add(off(60),'Corpus Christi (ponto facultativo)','fac');return F}
function calendario(lista,pats=[]){
  lista=[...lista,...pats.filter(p=>pd(p).inicio).map(p=>({id:p.id,nome:p.nome,...pd(p),fase:'patro',local:'Patrocínio',_pat:true}))];
  const FER=feriados(ano);
  const hoje=new Date(), hojeIso=iso(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());
  const comData=lista.filter(e=>e.inicio), semData=lista.filter(e=>!e.inicio);
  const naData=d=>comData.filter(e=>d>=e.inicio&&d<=(e.fim||e.inicio));
  const meses=MESES_N.map((nome,m)=>{
    const prim=new Date(ano,m,1).getDay(), dias=new Date(ano,m+1,0).getDate();
    const doMes=comData.filter(e=>{const a=e.inicio.slice(0,7),b=(e.fim||e.inicio).slice(0,7),k=iso(ano,m,1).slice(0,7);return a<=k&&k<=b});
    let cel='';for(let i=0;i<prim;i++)cel+='<span></span>';
    for(let d=1;d<=dias;d++){const di=iso(ano,m,d), evs=naData(di);
      const f=FER[di];
      const cls=['dia',di===hojeIso?'hoje':'',evs.length?'tem '+evs[0].fase:'',f?'fer '+f.tipo:''].join(' ');
      const tit=[...evs.map(e=>e.nome),f?f.nome:''].filter(Boolean).join(' · ');
      cel+=evs.length?`<button class="${cls}" ${evs[0]._pat?'data-pat':'data-ev'}="${evs[0].id}" title="${esc(tit)}" aria-label="${d} de ${nome}: ${esc(tit)}">${d}</button>`
        :`<span class="${cls}" ${f?`title="${esc(f.nome)}" aria-label="${d} de ${nome}: ${esc(f.nome)}"`:''}>${d}</span>`}
    const ferMes=Object.entries(FER).filter(([k])=>k.slice(0,7)===iso(ano,m,1).slice(0,7)).sort();
    return `<div class="mes-c ${doMes.length?'ativo':''}"><h3>${nome}</h3>
      <div class="sem">${['D','S','T','Q','Q','S','S'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="dias">${cel}</div>
      ${doMes.length?`<ul class="evm">${doMes.map(e=>`<li><button ${e._pat?'data-pat':'data-ev'}="${e.id}"><span class="pt ${e.fase}"></span>${esc(e.nome)}<small>${esc(dataTxt(e))}</small></button></li>`).join('')}</ul>`:''}
      ${ferMes.length?`<ul class="ferl">${ferMes.map(([k,f])=>`<li class="${f.tipo}"><b class="num">${k.slice(8)}</b> ${esc(f.nome)}</li>`).join('')}</ul>`:''}
    </div>`}).join('');
  return `<div class="cal-legenda"><span><i class="pt plan"></i>Em planejamento</span><span><i class="pt draft"></i>Rascunho</span><span><i class="pt done"></i>Realizado</span><span><i class="pt fn"></i>Feriado nacional</span><span><i class="pt fm"></i>Feriado municipal (Caxias do Sul)</span><span><i class="pt ff"></i>Ponto facultativo</span>${pats.length?'<span><i class="pt patro"></i>Patrocínio</span>':''}<span><i class="pt hj"></i>Hoje</span></div>
  <div class="cal">${meses}</div>
  ${semData.length?`<div class="panel" style="margin-top:18px"><h3>Sem data definida</h3><ul class="evm">${semData.map(e=>`<li><button ${e._pat?'data-pat':'data-ev'}="${e.id}"><span class="pt ${e.fase}"></span>${esc(e.nome)}<small>${esc(e.local||'')}</small></button></li>`).join('')}</ul>
    <p class="note">Defina a data em "Editar evento" para o evento entrar no calendário.</p></div>`:''}
  <div style="height:40px"></div>`;
}
function card(e){
  const t=comprometido(e);
  let orc='<div class="budget"><div class="row"><span>Orçamento</span><span>Sem itens ainda</span></div><div class="track"></div></div>';
  if(e.verba&&t){const p=t/e.verba*100;
    orc=`<div class="budget"><div class="row"><span>Comprometido <b class="num">${brl(t)}</b></span><span class="num">de ${brl(e.verba)}</span></div>
    <div class="track"><div class="fill ${p>100?'over':''}" style="width:${Math.min(p,100)}%"></div></div>
    <span class="num" style="color:${p>100?'var(--red)':'var(--muted)'}">${p>100?'Acima da verba em '+brl(t-e.verba):Math.round(p)+'% da verba · faltam '+brl(e.verba-t)}</span></div>`}
  const ab=e.tarefas.map((x,i)=>[x,i]).filter(([x])=>!x[2]).sort((a,b)=>(a[0][4]||'9')<(b[0][4]||'9')?-1:1);
  const hoje=new Date().toISOString().slice(0,10);
  return `<article class="card ev-card">
    <button class="card-link" data-ev="${e.id}" aria-label="Abrir ${esc(e.nome)}">
      <div class="chead"><span style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag ${e.fase}">${FASE_TAG[e.fase]}</span>${PATROS.some(x=>x.evId===e.id&&x.tipo==='acao')?'<span class="tag patro">Patrocínio</span>':''}</span><span class="mes">${mesDe(e)||'A definir'}</span></div>
      <h2>${esc(e.nome)}</h2>
      <div class="meta"><span>${I.cal}${esc(dataTxt(e))}</span><span>${I.pin}${esc(e.local)}</span></div>
      ${orc}
    </button>
    <div class="ctask">
      <div class="ctask-h"><b>Fazendo agora</b><span class="who">${ab.length} ${ab.length===1?'aberta':'abertas'}</span></div>
      ${ab.length?`<ul>${ab.slice(0,5).map(([x,i])=>`<li><label><input type="checkbox" data-ct="${e.id}|${i}" aria-label="Marcar como feito: ${esc(x[0])}">
        <span>${esc(x[0])}${x[3]||x[4]?`<small class="${x[4]&&x[4]<hoje?'atr':''}">${[x[3]?x[3].split(' ')[0]:'',x[4]?isoBR(x[4]).slice(0,5):''].filter(Boolean).join(' · ')}</small>`:''}</span></label></li>`).join('')}</ul>`
        :'<p class="who" style="margin:4px 0 8px">Nada em andamento.</p>'}
      ${ab.length>5?`<button class="link" style="color:var(--navy);padding:0 0 6px" data-ev="${e.id}--checklist">Ver as ${ab.length} no Checklist</button>`:''}
      <form class="ctask-add" data-cta="${e.id}" novalidate><input name="t" autocomplete="off" placeholder="Adicionar o que está fazendo…" aria-label="Nova tarefa em ${esc(e.nome)}"><button class="btn btn-sec" aria-label="Adicionar">${I.plus}</button></form>
    </div>
  </article>`;
}

const TABS=[['geral','Visão geral'],['orcamento','Geral'],['checklist','Checklist'],['cotacoes','Cotações']];
function evento(id,aba){
  const e=EVENTOS.find(x=>x.id===id); if(!e){if(!carregado){document.getElementById('app').innerHTML='<main class="wrap"><p class="empty" role="status">'+(erroCarga||'Carregando evento…')+'</p></main>';return}location.hash='';return}
  aba=(TABS.some(t=>t[0]===aba)||e.abas.includes(aba))?aba:'geral';
  document.getElementById('app').innerHTML=`
  <header class="top"><div class="wrap">
    ${topoLogo(26)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;justify-content:space-between"><button class="back" id="voltar">${I.back} Voltar</button>
    <span style="display:flex;gap:8px;flex-wrap:wrap">${window.Nuvem&&Nuvem.pode('admin')?`<a class="back" style="text-decoration:none" href="admin.html#logs=eventos/${encodeURIComponent(e.id)}">${I.hist} Histórico</a>`:''}<button class="back" id="xlsx" hidden>${I.down} Baixar Excel</button>${e.ata?`<a class="back" style="text-decoration:none" href="${esc(e.ata)}" target="_blank" rel="noopener">${I.doc} Ata no Canva</a>`:''}
    <button class="back" id="editEv">${I.edit} Editar evento</button></span></div>
    <h1><b>${esc(e.nome)}</b> ${esc(e.sub)}</h1>
    <p><span class="tipo">${TIPOS[e.tipo]}</span>${(()=>{const pt=PATROS.find(x=>x.evId===e.id&&x.tipo==='acao');return pt?`<span class="tipo patro">Patrocínio · ${esc(pt.nome)}</span>`:''})()}${esc(dataTxt(e))} · ${esc(e.local)}</p>
    <p class="quem" id="quem"></p>
  </div></header>
  <main class="wrap">
    <div class="tabs-wrap">
      <div class="tabs" role="tablist">
        ${TABS.map(([k,v])=>`<button class="tab" role="tab" aria-selected="${k===aba}" data-t="${k}">${v}</button>`).join('')}
        ${e.abas.map(k=>`<button class="tab" role="tab" aria-selected="${k===aba}" data-t="${k}">${MODULOS[k].nome}</button>`).join('')}
      </div>
      <div class="addtab">
        <button class="addbtn" id="addtab" aria-expanded="false" aria-haspopup="true">${I.plus} Adicionar aba</button>
      </div>
    </div>
    <section role="tabpanel" id="painel">${(VIEWS[aba])(e)}</section>
    <footer>Saúde e bem-estar para todos.</footer>
  </main>
  ${aba==='geral'?`<div class="resbar"><div class="wrap resbar-in">
    <div class="ressum" id="ressum">${resumoRes(e)}</div>
    <button class="btn btn-primary" id="abreRes" aria-expanded="false" aria-controls="sheet">Resultados do evento</button>
  </div></div>`:''}
`;
  document.getElementById('voltar').onclick=()=>{location.hash=''};
  document.querySelectorAll('.tab[data-t]').forEach(b=>b.onclick=()=>{location.hash=e.id+'--'+b.dataset.t});
  const add=document.getElementById('addtab');
  add.onclick=ev=>{ev.stopPropagation();abrirMenu(e,add)};
  ligar(e,aba);
  mostrarQuem(e);aplicarRO();ligarXlsx(e);
  const ar=document.getElementById('abreRes');if(ar)ar.onclick=()=>abrirRes(e);
  document.getElementById('editEv').onclick=()=>abrirEdicao(e);
  document.querySelectorAll('[data-editverba]').forEach(b=>b.onclick=()=>abrirEdicao(e,'[name=verba]'));
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{location.hash=e.id+'--'+b.dataset.goto});
}
function resumoRes(e){const r=e.res,t=total(e);
  if(e.tipo==='corrida') return r.inscritos?`<b class="num">${r.inscritos}</b> inscritos${r.concluintes!=null?` · <b class="num">${r.concluintes}</b> concluíram`:''}`:'<span>Resultados ainda não preenchidos</span>';
  if(e.tipo==='interno') return r.participantes?`<b class="num">${r.participantes}</b> participantes${r.nota!=null?` · nota <b class="num">${r.nota}</b>`:''}`:'<span>Resultados ainda não preenchidos</span>';
  const p=[];if(r.leads)p.push(`<b class="num">${r.leads}</b> leads`);if(r.pedidos)p.push(`<b class="num">${r.pedidos}</b> pedidos`);
  if(r.faturamento&&t)p.push(`retorno <b class="num">${(r.faturamento/t).toLocaleString('pt-BR',{maximumFractionDigits:1})}×</b>`);
  return p.length?p.join(' · '):'<span>Resultados ainda não preenchidos</span>'}
function renderRes(e){document.getElementById('sheetT').textContent='Resultados · '+e.nome;const b=document.getElementById('sheetBody');b.innerHTML=resultados(e);aplicarRO(b);
  b.querySelectorAll('[data-r]').forEach(inp=>inp.onchange=()=>{const v=inp.classList.contains('brl')?parseBR(inp.value):(inp.value===''?null:+inp.value);if(v==null)delete e.res[inp.dataset.r];else e.res[inp.dataset.r]=v;salvar(e);
    renderRes(e);const rs=document.getElementById('ressum');if(rs)rs.innerHTML=resumoRes(e);restaurarFoco(b)})}
function abrirRes(e){renderRes(e);mostrarSheet()}
function mostrarSheet(foco){const sh=document.getElementById('sheet');sh.hidden=false;document.getElementById('backdrop').hidden=false;
  document.body.style.overflow='hidden';document.getElementById('abreRes')?.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>{sh.classList.add('on');(foco?sh.querySelector(foco):sh.querySelector('input'))?.focus()})}
function abrirEdicao(e,foco,novo){
  document.getElementById('sheetT').textContent=novo?'Novo evento':'Editar evento';
  const opt=(o,v)=>Object.entries(o).map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t}</option>`).join('');
  document.getElementById('sheetBody').innerHTML=`<form class="panel" id="fEv" novalidate>
    <div class="form" style="margin-top:0"><label class="f" style="flex:2">Nome<input name="nome" value="${esc(e.nome)}" required></label>
      <label class="f" style="flex:2">Complemento<input name="sub" value="${esc(e.sub||'')}" placeholder="Ex.: estande F172 · 42 m²"></label></div>
    <div class="form"><label class="f">Tipo<select name="tipo">${opt(TIPOS,e.tipo)}</select></label>
      <label class="f">Fase<select name="fase">${opt(FASE_TAG,e.fase)}</select></label>
      <label class="f">Ano<input type="number" name="ano" value="${e.ano}" min="2020" max="2100"></label></div>
    <div class="form"><label class="f">Início<input type="text" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" name="inicio" value="${isoBR(e.inicio)}"></label>
      <label class="f">Fim<input type="text" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" name="fim" value="${isoBR(e.fim)}"></label>
      <label class="f" style="flex:2">Local<input name="local" value="${esc(e.local||'')}"></label></div>
    <div class="form"><label class="f">Verba aprovada (R$)<input type="text" class="brl" inputmode="numeric" autocomplete="off" name="verba" value="${fmtBR(e.verba)}" placeholder="0,00"></label>
      <label class="f">Credenciais incluídas<input type="number" min="0" name="credLimite" value="${e.credLimite??''}"></label></div>
    <div class="form"><label class="f">Link da ata no Canva<input type="url" name="ata" value="${esc(e.ata||'')}" placeholder="https://www.canva.com/design/..."></label></div>
    <p class="note">Previsto, realizado e o que ainda temos pra gastar não se digitam aqui: vêm dos itens da aba Geral. O que falta gastar é a verba menos o realizado de cada item (ou o previsto, quando o item ainda não tem realizado).</p>
    <p class="note" id="evErr" role="alert" style="color:var(--red)"></p>
    <div class="form"><button class="btn btn-primary" type="submit">${novo?'Criar evento':'Salvar alterações'}</button><button class="btn btn-sec" type="button" id="cancEv">Cancelar</button>
</div>
  </form>
  ${novo?'':`<div class="panel"><h3>Limpar ou excluir</h3>
    <p class="note" style="margin-top:0"><b>Limpar informações</b> mantém nome, tipo, fase, datas, local, verba e ata, e apaga orçamento, cotações, checklist, equipe, voos, hospedagem, resultados, anotações e avisos.${souDono?' <b>Excluir evento</b> apaga o evento inteiro do dash.':''} Nenhum dos dois tem volta: se quiser guardar, baixe o Excel antes.</p>
    <div class="form"><button class="btn btn-sec" type="button" id="limpaEv" style="border-color:var(--red);color:var(--red)">Limpar informações</button>
      ${souDono?'<button class="btn btn-sec" type="button" id="delEv" style="border-color:var(--red);color:var(--red)">Excluir evento</button>':''}</div></div>`}`;
  const f=document.getElementById('fEv');
  document.getElementById('cancEv').onclick=fecharRes;
  f.onsubmit=ev=>{ev.preventDefault();
    if(!f.nome.value.trim()){document.getElementById('evErr').textContent='O evento precisa de um nome.';f.nome.focus();return}
    if(f.ata.value.trim()&&!/^https:\/\/(www\.)?canva\.(com|link)\//.test(f.ata.value.trim())){document.getElementById('evErr').textContent='O link precisa ser do Canva (começa com https://www.canva.com/).';f.ata.focus();return}
    const anoP=+f.ano.value||e.ano, iniISO=brISO(f.inicio.value,anoP), fimISO=brISO(f.fim.value,anoP);
    if(iniISO===null){document.getElementById('evErr').textContent='A data de início não existe. Use dd/mm/aaaa.';f.inicio.focus();return}
    if(fimISO===null){document.getElementById('evErr').textContent='A data de fim não existe. Use dd/mm/aaaa.';f.fim.focus();return}
    if(iniISO&&fimISO&&fimISO<iniISO){document.getElementById('evErr').textContent='O fim está antes do início. Confira as datas.';f.fim.focus();return}
    Object.assign(e,{nome:f.nome.value.trim(),sub:f.sub.value.trim(),tipo:f.tipo.value,fase:f.fase.value,inicio:iniISO,fim:fimISO||iniISO,
      local:f.local.value.trim(),verba:parseBR(f.verba.value),credLimite:f.credLimite.value===''?null:+f.credLimite.value,ata:f.ata.value.trim(),
      ano:iniISO?+iniISO.slice(0,4):(+f.ano.value||e.ano)});
    if(novo){EVENTOS.push(e);ano=e.ano}
    salvar(e,true);fecharRes();if(novo){location.hash=e.id}else rota(true);toast(novo?'Evento criado.':'Evento atualizado.')};
  const limpa=document.getElementById('limpaEv');
  if(limpa)limpa.onclick=()=>{if(limpa.dataset.ok!=='1'){limpa.dataset.ok='1';limpa.textContent='Clique de novo para limpar de vez';return}
    Object.assign(e,{itens:[],tarefas:[],cot:[],equipe:[],quartos:[],trechos:[],res:{},notas:'',avisos:[],abas:[],hotel:{nome:'',single:0,duplo:0},segAtivo:0});
    EQ_EDIT=null;salvar(e,true);fecharRes();location.hash=e.id;rota(true);toast('Informações do evento apagadas.')};
  const del=document.getElementById('delEv');
  if(del)del.onclick=async()=>{if(del.dataset.ok!=='1'){del.dataset.ok='1';del.textContent='Clique de novo para excluir de vez';return}
    try{await DB.collection('eventos').doc(e.id).delete();EVENTOS=EVENTOS.filter(x=>x!==e);fecharRes();location.hash='';toast('Evento excluído.')}
    catch(err){toast('Não deu para excluir agora. Tente de novo.')}};
  mostrarSheet(foco);
}
function fecharRes(){const sh=document.getElementById('sheet');if(!sh||sh.hidden)return;sh.classList.remove('on');sh.hidden=true;
  document.getElementById('backdrop').hidden=true;document.body.style.overflow='';const b=document.getElementById('abreRes');if(b){b.setAttribute('aria-expanded','false');b.focus()}}
function abrirMenu(e,btn,MODS=MODULOS){
  fecharMenu();
  const livres=Object.keys(MODS).filter(k=>!e.abas.includes(k));
  const m=document.createElement('div');m.className='menu';m.id='menu';m.setAttribute('role','menu');
  m.innerHTML=livres.length?livres.map(k=>`<button role="menuitem" data-mod="${k}"><b>${MODS[k].nome}</b><span>${MODS[k].desc}</span></button>`).join('')
    :'<p>Todas as abas disponíveis já foram adicionadas.</p>';
  btn.parentNode.appendChild(m);btn.setAttribute('aria-expanded','true');
  m.querySelectorAll('[data-mod]').forEach(b=>b.onclick=()=>{e.abas.push(b.dataset.mod);salvar(e);fecharMenu();location.hash=e.id+'--'+b.dataset.mod;
    toast('Aba '+MODS[b.dataset.mod].nome+' adicionada a '+e.nome+'.')});
  const first=m.querySelector('button');first&&first.focus();
}
function fecharMenu(){const m=document.getElementById('menu');if(m){m.remove();const b=document.getElementById('addtab');b&&b.setAttribute('aria-expanded','false')}}
document.addEventListener('click',ev=>{if(!ev.target.closest('.menu'))fecharMenu()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){fecharRes();fecharMenu();document.getElementById('addtab')?.focus()}});
// ---------- Tab continua para o próximo campo depois de salvar ----------
const ATTRS=['data-co','data-cf','data-ce','data-ln','data-tf','data-o','data-v','data-q','data-fn','data-h','data-r','data-p','name','id'];
function chaveEl(el){if(!el||!el.getAttribute)return null;for(const a of ATTRS){const v=el.getAttribute(a);if(v!=null){const f=el.closest('form[id]');return (f?'#'+f.id+' ':'')+'['+a+'="'+CSS.escape(v)+'"]'}}return null}
function focaveis(root){return [...root.querySelectorAll('input,select,textarea,button,a[href]')].filter(x=>!x.disabled&&!x.hidden&&x.offsetParent!==null)}
let PROX=null;
document.addEventListener('keydown',ev=>{if(ev.key!=='Tab')return;const a=document.activeElement;const root=a&&a.closest('#painel,#sheetBody,#faz');if(!root){PROX=null;return}
  const l=focaveis(root),i=l.indexOf(a);const alvo=l[i+(ev.shiftKey?-1:1)];
  PROX=alvo?{root:root.id,chave:chaveEl(alvo),idx:i+(ev.shiftKey?-1:1),t:Date.now()}:null},true);
function restaurarFoco(root){if(!PROX||PROX.root!==root.id||Date.now()-PROX.t>800)return;const p=PROX;PROX=null;
  setTimeout(()=>{let el=p.chave&&root.querySelector(p.chave);if(!el){const l=focaveis(root);el=l[Math.min(p.idx,l.length-1)]}
    if(el){el.focus();if(el.select&&el.tagName==='INPUT')el.select()}},0)}
function rerender(e,aba){if(aba==='voos')syncLog(e,'voos');if(aba==='hospedagem')syncLog(e,'hosp');const P=document.getElementById('painel');P.innerHTML=VIEWS[aba](e)+(e._col&&aba!=='checklist'&&aba!=='evento'?rmBtn(aba):'');ligar(e,aba);aplicarRO();salvar(e);
  if(e._col){const k=document.getElementById('pkpis');if(k){k.innerHTML=patKpiInner(e);ligarPatKpi(e)}const h=document.getElementById('phead');if(h)h.innerHTML=patHead(e);const pv=document.getElementById('pprev');if(pv){pv.hidden=!(e.abas.includes('orcamento')&&e.itens.length);pv.innerHTML='<h3>Previsto x realizado por segmento</h3>'+prevReal(e)}}restaurarFoco(P)}
// Leva o total de voos/hospedagem para o REALIZADO de uma linha do orçamento (atualiza a mesma linha nas próximas vezes).
const LANC={hosp:{tag:'__hosp',palavra:'hospedagem',item:'Hospedagem',nome:'hospedagem'},voos:{tag:'__voos',palavra:'passage',item:'Passagens aéreas',nome:'voos'}};
function linhaLanc(e,k){const L=LANC[k];return e.itens.find(i=>i[6]===L.tag)||e.itens.find(i=>!i[6]&&normO(i[1])===L.palavra)||e.itens.find(i=>!i[6]&&normO(i[1]).startsWith(L.palavra))}
function lancarLogistica(e,k,total,desc,forn){const L=LANC[k];let it=linhaLanc(e,k);const v=Math.round(total*100)/100;
  if(it){it[6]=L.tag;it[8]=v;return `Realizado de "${it[1]}" no orçamento atualizado para ${brl2(v)}.`}
  e.itens.push(['Logística',L.item,desc,forn,0,'Orçado',L.tag,'',v]);return `Linha "${L.item}" criada no orçamento com ${brl2(v)} no realizado.`}
function botaoLanc(e,k,total){const it=linhaLanc(e,k);const ok=it&&it[6]===LANC[k].tag&&Math.abs((it[8]??-1)-total)<0.01;
  return `<div class="form" style="margin-top:12px;align-items:center">${ok?`<span class="who" style="color:var(--ok)">${I.check} No orçamento: ${brl2(total)} no realizado de "${esc(it[1])}"</span>`
    :`<button class="btn btn-primary" data-lanc="${k}">${it&&it[6]===LANC[k].tag?'Atualizar no orçamento':'Lançar no orçamento'}</button><span class="who">${it?`Vai para o realizado de "${esc(it[1])}"`:`Cria a linha "${LANC[k].item}" no orçamento`}, com ${brl2(total)}.</span>`}</div>`}
// Marcar voo/quarto leva o valor para uma linha só no Geral ("Passagens aéreas" / "Hospedagem"), no realizado, e ela se atualiza sozinha.
// Sem marcação salva, conta como marcado se o evento já tinha a linha lançada (o jeito antigo lançava tudo).
const linhasLog=(e,k)=>k==='voos'?e.trechos:e.quartos;
const valLog=(e,k,x)=>k==='voos'?(+x.valor||0):valQuarto(e,x);
function marcado(e,k,x){return x.esc!=null?!!x.esc:e.itens.some(i=>i[6]===LANC[k].tag)}
function fixarMarcas(e,k){linhasLog(e,k).forEach(x=>{x.esc=marcado(e,k,x)})}
function syncLog(e,k){if(podeEditar===false)return;const L=LANC[k],rows=linhasLog(e,k);
  if(!rows.some(x=>x.esc!=null)&&!e.itens.some(i=>i[6]===L.tag))return;
  const sel=rows.filter(x=>marcado(e,k,x)),v=Math.round(sel.reduce((s,x)=>s+valLog(e,k,x),0)*100)/100;
  let it=linhaLanc(e,k);
  if(!sel.length){if(it&&it[6]===L.tag)it[8]=null;return}
  const desc=k==='voos'?(sel.length===rows.length?`${rows.length} trechos`:`${sel.length} de ${rows.length} trechos`)
    :`${sel.length} ${sel.length===1?'quarto':'quartos'} · ${sel.reduce((s,q)=>s+noites(q),0)} diárias`;
  const forn=k==='voos'?[...new Set(sel.map(t=>t.cia).filter(Boolean))].join(', '):[...new Set(sel.map(q=>(hoteisDe(e)[q.hotel]||{}).nome).filter(Boolean))].join(', ');
  if(it){it[6]=L.tag;it[8]=v;it[2]=desc;if(forn)it[3]=forn}
  else e.itens.push(['Logística',L.item,desc,forn,0,'Orçado',L.tag,'',v])}
function statusLog(e,k){const rows=linhasLog(e,k);if(!rows.length)return '';const sel=rows.filter(x=>marcado(e,k,x));const it=e.itens.find(i=>i[6]===LANC[k].tag);
  const nome=k==='voos'?'trechos':'quartos';
  return `<div class="form" style="margin-top:12px;align-items:center">
    <span class="who" style="flex:1;min-width:220px;${sel.length?'color:var(--ok)':''}">${sel.length&&it?`${I.check} No Geral: <b class="num">${brl2(it[8]??0)}</b> no realizado de "${esc(it[1])}" (${sel.length} de ${rows.length} ${nome} marcados).`
      :`Marque na coluna "Geral" os ${nome} que entram no orçamento. A soma vai para o realizado de "${LANC[k].item}" e se atualiza sozinha.`}</span>
    ${sel.length<rows.length?`<button class="btn btn-sec" data-logall="${k}">Marcar todos</button>`:''}${sel.length?`<button class="btn btn-sec" data-lognone="${k}">Desmarcar todos</button>`:''}</div>`}
function orcadoPor(e,palavra){return e.itens.filter(i=>i[1].toLowerCase().startsWith(palavra)).reduce((s,i)=>s+i[4],0)}
function remover(e,k){e.abas=e.abas.filter(x=>x!==k);salvar(e);location.hash=e.id;toast(((MODULOS[k]||P_MODULOS[k]||{}).nome||'Aba')+' removida.')}

function ligar(e,aba){
  const P=document.getElementById('painel');
  P.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>remover(e,b.dataset.rm));
  if(aba==='equipe'){
    P.querySelector('#fEq').onsubmit=ev=>{ev.preventDefault();const f=ev.target;const nome=f.nome.value.trim();
      if(!nome){f.nome.focus();toast('Escreva o nome da pessoa.');return}
      e.equipe.push({nome,funcao:f.funcao.value.trim(),cred:credVal(f.cred.value),voo:{}});rerender(e,aba);document.querySelector('#fEq input[name=nome]').focus()};
    P.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{EQ_EDIT=null;e.equipe.splice(+b.dataset.del,1);rerender(e,aba)});
    const eqSalvar=i=>{const p=e.equipe[i],row=P.querySelector(`[data-eqrow="${i}"]`);if(!p||!row)return;
      const nmI=row.querySelector('[data-nm]'),velho=p.nome,novo=nmI.value.trim();
      if(!novo){nmI.classList.add('erro');nmI.focus();toast('O nome não pode ficar em branco.');return}
      if(e.equipe.some(x=>x!==p&&normN(x.nome)===normN(novo))){nmI.classList.add('erro');nmI.focus();toast('Já tem alguém com esse nome na equipe.');return}
      let msg='Pessoa atualizada.';
      if(novo!==velho){const igual=n=>n&&normN(n)===normN(velho);
        e.trechos.forEach(t=>{if(igual(t.nome))t.nome=novo});e.quartos.forEach(q=>q.ocup=q.ocup.map(n=>igual(n)?novo:n));e.tarefas.forEach(t=>{if(igual(t[3]))t[3]=novo});
        msg='Nome atualizado em todo o evento.'}
      p.nome=novo;p.funcao=row.querySelector('[data-fn]').value.trim();p.cred=credVal(row.querySelector('[data-cr]').value);
      EQ_EDIT=null;rerender(e,aba);toast(msg)};
    const eqCanc=()=>{EQ_EDIT=null;rerender(e,aba)};
    P.querySelectorAll('[data-eqed]').forEach(b=>b.onclick=()=>{EQ_EDIT=e.id+'|'+b.dataset.eqed;rerender(e,aba);const x=P.querySelector('[data-nm]');x?.focus();x?.select()});
    P.querySelectorAll('[data-eqok]').forEach(b=>b.onclick=()=>eqSalvar(+b.dataset.eqok));
    P.querySelectorAll('[data-eqcanc]').forEach(b=>b.onclick=eqCanc);
    P.querySelectorAll('[data-eqrow] input,[data-eqrow] select').forEach(el=>el.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'&&!ev.defaultPrevented){ev.preventDefault();eqSalvar(+el.closest('[data-eqrow]').dataset.eqrow)}
      else if(ev.key==='Escape'&&!SUG){ev.stopPropagation();eqCanc()}}));
  }
  P.querySelectorAll('[data-p]').forEach(inp=>inp.onchange=()=>{
    const [i,grp,campo]=inp.dataset.p.split('.');const pes=e.equipe[+i];
    pes[grp][campo]=inp.type==='number'?(+inp.value||0):inp.value;rerender(e,aba)});
  P.querySelectorAll('[data-h]').forEach(inp=>inp.onchange=()=>{const [hi,k]=inp.dataset.h.split('.');const h=hoteisDe(e)[+hi];
    h[k]=inp.classList.contains('brl')?(parseBR(inp.value)||0):inp.value.trim();e.hotel={...e.hoteis[0]};rerender(e,aba)});
  const ah=P.querySelector('#addHotel');if(ah)ah.onclick=()=>{hoteisDe(e).push({nome:'',single:0,duplo:0});rerender(e,aba);
    P.querySelector(`[data-h="${e.hoteis.length-1}.nome"]`)?.focus()};
  P.querySelectorAll('[data-hdel]').forEach(b=>b.onclick=()=>{const hi=+b.dataset.hdel,n=e.quartos.filter(q=>q.hotel===hi).length;
    if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent=n?`Clique de novo: apaga o hotel e ${n} ${n===1?'quarto':'quartos'}`:'Clique de novo para excluir';return}
    e.quartos=e.quartos.filter(q=>q.hotel!==hi);e.quartos.forEach(q=>{if(q.hotel>hi)q.hotel--});e.hoteis.splice(hi,1);e.hotel={...e.hoteis[0]};rerender(e,aba)});
  P.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const [i,k,j]=inp.dataset.q.split('.');const q=e.quartos[+i];
    if(inp.classList.contains('data')){const v=brISO(inp.value,e.ano);if(v===null){dataInvalida(inp);return}q[k]=v}else if(k==='ocup')q.ocup[+j]=inp.value.trim();else q[k]=inp.value;if(q.tipo==='single')q.ocup[1]='';rerender(e,aba)});
  P.querySelectorAll('[data-qdel]').forEach(b=>b.onclick=()=>{e.quartos.splice(+b.dataset.qdel,1);rerender(e,aba)});
  P.querySelectorAll('[data-addq]').forEach(b=>b.onclick=()=>{const hi=+b.dataset.addq;const u=[...e.quartos].reverse().find(q=>q.hotel===hi)||e.quartos[e.quartos.length-1];
    e.quartos.push({in:u?u.in:'',out:u?u.out:'',tipo:'duplo',ocup:['',''],hotel:hi});rerender(e,aba);
    const l=P.querySelectorAll(`[data-hotel="${hi}"] [data-q$="ocup.0"]`);l[l.length-1]?.focus()});
  P.querySelectorAll('[data-v]').forEach(inp=>inp.onchange=()=>{const [i,k]=inp.dataset.v.split('.');
    if(inp.classList.contains('hora')){const d=inp.value.replace(/\D/g,'');if(d&&(d.length!==4||+d.slice(0,2)>23||+d.slice(2)>59)){inp.classList.add('erro');toast('Horário inválido. Digite 4 números, por exemplo 1410 para 14:10.');inp.focus();return}}
    if(inp.classList.contains('data')){const v=brISO(inp.value,e.ano);if(v===null){dataInvalida(inp);return}e.trechos[+i][k]=v;rerender(e,aba);return}
    e.trechos[+i][k]=inp.classList.contains('brl')?(parseBR(inp.value)||0):inp.value.trim();rerender(e,aba)});
  P.querySelectorAll('[data-vdel]').forEach(b=>b.onclick=()=>{e.trechos.splice(+b.dataset.vdel,1);rerender(e,aba)});
  P.querySelectorAll('[data-vadd]').forEach(b=>b.onclick=()=>{const dir=b.dataset.vadd;const ult=[...e.trechos].reverse().find(t=>t.dir===dir);
    e.trechos.push(ult?{...ult,nome:'',loc:'',obs:''}:{dir,cidade:'',nome:'',data:'',saida:'',chegada:'',cia:'',voo:'',loc:'',valor:0});rerender(e,aba);
    const l=P.querySelectorAll(`[data-vdir="${dir}"] [data-v$=".nome"]`);l[l.length-1]?.focus()});
  P.querySelectorAll('[data-o]').forEach(inp=>inp.onchange=()=>{const [i,k]=inp.dataset.o.split('.').map(Number);
    const it=e.itens[i];
    if(k===4)it[4]=parseBR(inp.value)||0;
    else if(k===8)it[8]=parseBR(inp.value);
    else{it[k]=inp.value.trim();if(k===0&&!it[0])it[0]='Outros';
      if(k===5&&it[5]==='Pago'&&it[8]==null){it[8]=it[4];toast('Marcado como pago: o realizado ficou igual ao previsto. Ajuste se o valor da NF for outro.')}}
    rerender(e,aba)});
  P.querySelectorAll('[data-odel]').forEach(b=>b.onclick=()=>{e.itens.splice(+b.dataset.odel,1);rerender(e,aba)});
  ligarIA(e);
  const ai=P.querySelector('#addItem');if(ai)ai.onclick=()=>{e.itens.push([e.itens.length?e.itens[e.itens.length-1][0]:'Outros','Novo item','','',0,'Estimativa','','',null]);rerender(e,aba);
    const l=P.querySelectorAll('[data-o$=".1"]');const x=l[l.length-1];x?.focus();x?.select()};
  P.querySelectorAll('[data-adel]').forEach(b=>b.onclick=()=>{e.avisos.splice(+b.dataset.adel,1);rerender(e,aba)});
  if(aba==='cotacoes')ligarCot(e,P,aba);
  P.querySelectorAll('[data-vesc],[data-qesc]').forEach(cb=>cb.onchange=()=>{const k=cb.dataset.vesc!=null?'voos':'hosp';fixarMarcas(e,k);
    linhasLog(e,k)[+(cb.dataset.vesc??cb.dataset.qesc)].esc=cb.checked;rerender(e,aba)});
  P.querySelectorAll('[data-logall],[data-lognone]').forEach(b=>b.onclick=()=>{const k=b.dataset.logall||b.dataset.lognone;const v=!!b.dataset.logall;
    linhasLog(e,k).forEach(x=>x.esc=v);rerender(e,aba);toast(v?'Todos marcados: a soma foi para o Geral.':'Nada marcado: o realizado da linha no Geral ficou em branco.')});
  P.querySelectorAll('[data-lanc]').forEach(b=>b.onclick=()=>{const k=b.dataset.lanc;let msg;
    if(k==='voos'){const tot=e.trechos.reduce((s,t)=>s+(+t.valor||0),0);const cias=[...new Set(e.trechos.map(t=>t.cia).filter(Boolean))].join(', ');
      msg=lancarLogistica(e,'voos',tot,`${e.trechos.length} trechos`,cias)}
    else{const H=hoteisDe(e);const tot=e.quartos.reduce((s,q)=>s+valQuarto(e,q),0);
      msg=lancarLogistica(e,'hosp',tot,`${e.quartos.length} quartos · ${e.quartos.reduce((s,q)=>s+noites(q),0)} diárias`,H.map(h=>h.nome).filter(Boolean).join(', '))}
    rerender(e,aba);toast(msg)});
  if(aba==='checklist'){
    P.querySelectorAll('[data-tk]').forEach(c=>c.onchange=()=>{e.tarefas[+c.dataset.tk][2]=c.checked;rerender(e,aba)});
    P.querySelectorAll('[data-tf]').forEach(inp=>inp.onchange=()=>{const [i,k]=inp.dataset.tf.split('.').map(Number);
      if(k===4){const v=brISO(inp.value,e.ano);if(v===null){dataInvalida(inp);return}e.tarefas[i][4]=v}
      else{if(k===0&&!inp.value.trim()){inp.value=e.tarefas[i][0];return}e.tarefas[i][k]=inp.value.trim()}rerender(e,aba)});
    P.querySelectorAll('[data-tdel]').forEach(b=>b.onclick=()=>{e.tarefas.splice(+b.dataset.tdel,1);rerender(e,aba)});
    P.querySelector('#fTk').onsubmit=ev=>{ev.preventDefault();const f=ev.target;const t=f.t.value.trim();
      if(!t){f.t.focus();toast('Escreva a tarefa.');return}
      const pz=brISO(f.prazo.value,e.ano);if(pz===null){dataInvalida(f.prazo);return}
      e.tarefas.push([t,'',false,f.resp.value.trim(),pz]);rerender(e,aba);salvar(e,true);P.querySelector('#fTk [name=t]').focus();toast('Tarefa adicionada: '+t)};
  }
  P.querySelectorAll('[data-r]').forEach(inp=>inp.onchange=()=>{e.res[inp.dataset.r]=inp.value===''?undefined:+inp.value;rerender(e,aba)});
  const n=P.querySelector('#notas');if(n)n.oninput=()=>{e.notas=n.value;salvar(e)};
  P.querySelectorAll('[data-pe]').forEach(inp=>inp.onchange=()=>{const k=inp.dataset.pe;
    if(inp.classList.contains('data')){const v=brISO(inp.value,e.ano);if(v===null){dataInvalida(inp);return}
      if(k==='evIni'){const antigo=e.evIni;e.evIni=v;if(!v)e.evFim='';else if(!e.evFim||e.evFim===antigo||e.evFim<v)e.evFim=v}
      else{if(v&&e.evIni&&v<e.evIni){toast('A data final está antes da data do evento.');inp.value=isoBR(e.evFim!==e.evIni?e.evFim:'');return}e.evFim=v||e.evIni}}
    else e[k]=inp.value.trim();rerender(e,aba)});
}

const SEG_PADRAO=['Espaço','Montadora','Buffet','Logística','Brindes','Material e divulgação','Serviços','Taxas','Outros'];
function segSugs(e){const m=new Map();const add=v=>{v=(v||'').trim();if(v&&!m.has(v.toLowerCase()))m.set(v.toLowerCase(),v)};
  e.itens.forEach(i=>add(i[0]));(e.cot||[]).forEach(c=>add(c.seg));[...EVENTOS,...PATROS].forEach(x=>(x.itens||[]).forEach(i=>add(i[0])));SEG_PADRAO.forEach(add);
  return [...m.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
function prevReal(e){
  const m={};e.itens.forEach(i=>{const k=i[0]||'Outros';const g=m[k]=m[k]||{prev:0,real:0,n:0,nr:0,prevPago:0,realCmp:0,nc:0};g.prev+=i[4];g.n++;if(i[8]!=null){g.real+=i[8];g.nr++;if(i[4]>0){g.prevPago+=i[4];g.realCmp+=i[8];g.nc++}}});
  const segs=Object.entries(m).sort((a,b)=>b[1].prev-a[1].prev);
  if(!segs.length)return '<p class="note" style="margin-top:0">Sem itens no orçamento ainda.</p>';
  const max=Math.max(...segs.map(([,g])=>Math.max(g.prev,g.real)),1);
  const T=segs.reduce((t,[,g])=>({prev:t.prev+g.prev,real:t.real+g.real,prevPago:t.prevPago+g.prevPago,realCmp:t.realCmp+g.realCmp,nc:t.nc+g.nc,nr:t.nr+g.nr,n:t.n+g.n}),{prev:0,real:0,prevPago:0,realCmp:0,nc:0,nr:0,n:0});
  const dif=(r,p)=>{if(!p)return '';const d=r-p;return d===0?'<small class="who">igual</small>':`<small class="${d>0?'pr-mais':'pr-menos'}">${d>0?'+':'−'}${brl(Math.abs(d))}</small>`};
  return `<div class="pr-leg" aria-hidden="true"><span><i class="prev"></i>Previsto</span><span><i class="real"></i>Realizado</span></div>
  ${segs.map(([k,g])=>`<div class="pr-row" title="${esc(k)} · previsto ${brl2(g.prev)} · realizado ${brl2(g.real)} (${g.nr} de ${g.n} ${g.n===1?'item pago':'itens pagos'})">
    <div class="pr-nome">${esc(k)}<small class="who">${g.n} ${g.n===1?'item':'itens'}</small></div>
    <div class="pr-bars">
      <div class="pr-bar"><span class="pr-track"><span class="pr-fill prev" style="width:${g.prev/max*100}%"></span></span><b>${brl(g.prev)}</b><span></span></div>
      <div class="pr-bar"><span class="pr-track"><span class="pr-fill real" style="width:${g.real/max*100}%"></span></span><b>${g.nr?brl(g.real):'—'}</b>${g.nc?dif(g.realCmp,g.prevPago):'<span></span>'}</div>
    </div></div>`).join('')}
  <div class="cmp"><span>Previsto <b class="num">${brl2(T.prev)}</b></span><span>Realizado <b class="num">${brl2(T.real)}</b></span>
    ${T.nc?`<span class="${T.realCmp>T.prevPago?'bad':''}">Nos itens com previsto e realizado: ${T.realCmp>T.prevPago?'acima':T.realCmp<T.prevPago?'abaixo':'igual'} do previsto ${T.realCmp!==T.prevPago?`em <b class="num">${brl2(Math.abs(T.realCmp-T.prevPago))}</b>`:''}</span>`:''}</div>
  <p class="note">A diferença compara só os itens que têm previsto e realizado. ${T.n-T.nr} de ${T.n} itens ainda sem realizado${T.nr-T.nc?`; ${T.nr-T.nc} com realizado mas sem previsto ficam fora da comparação`:''}.</p>`}
function porCat(e){const m={};e.itens.forEach(i=>m[i[0]]=(m[i[0]]||0)+i[4]);return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function avisos(e){return e.avisos.map(([k,t],i)=>`<div class="flag ${k==='info'?'info':''}">${I.warn}<span style="flex:1">${esc(t)}</span><button class="link" style="color:inherit;text-decoration:underline" data-adel="${i}">Dispensar</button></div>`).join('')}

function geral(e){
  const t=total(e), v=e.verba||0, cats=porCat(e), max=cats.length?cats[0][1]:1;
  const rl=realizado(e), cp=comprometido(e), saldo=v-cp, nr=e.itens.filter(i=>i[8]!=null).length, falta=cp-rl;
  const pend=e.itens.filter(i=>['Estimativa','Pendente'].includes(i[5]));
  const verbaCard=e.verba!=null?`<strong class="num">${brl(e.verba)}</strong><div class="sub"><button class="link" style="color:var(--navy);padding:0" data-editverba>Editar verba</button></div>`
    :`<strong style="color:var(--silver)">—</strong><div class="sub"><button class="link" style="color:var(--navy);padding:0" data-editverba>Definir verba</button></div>`;
  return `${avisos(e)}
  <div class="kpis">
    <div class="kpi"><small>Verba</small>${verbaCard}</div>
    <div class="kpi"><small>Previsto</small><strong class="num">${brl(t)}</strong><div class="sub">${e.itens.length} ${e.itens.length===1?'item':'itens'} · <button class="link" style="color:var(--navy);padding:0" data-goto="orcamento">editar na aba Geral</button></div></div>
    <div class="kpi"><small>Realizado</small><strong class="num">${brl(rl)}</strong><div class="sub">${nr} de ${e.itens.length} ${e.itens.length===1?'item':'itens'} com realizado</div></div>
    <div class="kpi ${e.verba!=null&&saldo<0?'alert':''}"><small>${e.verba!=null&&saldo<0?'Acima da verba':'Ainda temos pra gastar'}</small><strong class="num">${e.verba!=null?brl(Math.abs(saldo)):'—'}</strong><div class="sub">${e.verba==null?'defina a verba':falta>0?`verba − realizado − ${brl(falta)} previstos ainda sem realizado`:'verba − realizado'}</div></div>
    <div class="kpi"><small>Itens sem valor fechado</small><strong class="num">${pend.length}</strong><div class="sub num">${brl(pend.reduce((s,i)=>s+i[4],0))} em estimativa ou pendente</div></div>
  </div>
  <div class="two">
    <div class="panel"><h3>Previsto x realizado por segmento</h3>${prevReal(e)}</div>
    <div class="panel"><h3>Próximas pendências</h3>
      ${(()=>{const ab=e.tarefas.filter(x=>!x[2]).sort((a,b)=>(a[4]||'9')<(b[4]||'9')?-1:1);return ab.length?`<ul class="list">${ab.slice(0,4).map(x=>`<li><span class="box"></span><div>${esc(x[0])}<div class="who">${[x[4]?'Prazo '+isoBR(x[4]):'',x[3],x[1]].filter(Boolean).map(esc).join(' · ')}</div></div></li>`).join('')}</ul>${ab.length>4?`<p class="note"><button class="link" style="color:var(--navy);padding:0" data-goto="checklist">Ver as ${ab.length} pendências</button></p>`:''}`:'<p class="note">Nenhuma pendência aberta.</p>'})()}
    </div>
  </div>`;
}

// Ordem alfabética por segmento (e por item dentro do segmento); guarda o índice original para a edição continuar certa.
const porSeg=its=>its.map((it,i)=>[it,i]).sort((a,b)=>(a[0][0]||'').localeCompare(b[0][0]||'','pt-BR',{sensitivity:'base'})||(a[0][1]||'').localeCompare(b[0][1]||'','pt-BR',{sensitivity:'base'})||a[1]-b[1]);
function orcamento(e){
  const sel=(i,k,arr,v)=>`<select data-o="${i}.${k}" aria-label="Status">${arr.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}</select>`;
  const inp=(i,k,v,extra='')=>`<input data-o="${i}.${k}" value="${esc(v)}" ${extra}>`;
  return `<div class="panel"><h3>Itens do orçamento</h3>
  ${e.itens.length?`<div class="tbl"><table class="quartos"><thead><tr><th>Segmento</th><th>Item</th><th>Descrição</th><th>Fornecedor</th><th>Requisição</th><th>Status</th><th class="v">Previsto (R$)</th><th class="v">Realizado (R$)</th><th></th></tr></thead>
    <tbody>${porSeg(e.itens).map(([it,i])=>`<tr>
      <td>${inp(i,0,it[0],'data-sug="seg" autocomplete="off" aria-label="Segmento" title="Clique para escolher ou digite um segmento novo" style="min-width:140px;cursor:pointer"')}</td>
      <td>${inp(i,1,it[1],'aria-label="Item" style="min-width:140px;font-weight:600"')}</td>
      <td>${inp(i,2,it[2]==='—'?'':it[2],'aria-label="Descrição" placeholder="—" style="min-width:160px"')}</td>
      <td>${inp(i,3,it[3]==='—'?'':it[3],'aria-label="Fornecedor" placeholder="—" style="min-width:110px"')}</td>
      <td>${inp(i,7,it[7]||'','aria-label="Requisição" placeholder="Nº" autocomplete="off" style="min-width:90px"')}</td>
      <td>${sel(i,5,STATUS,it[5])}</td>
      <td class="v"><input data-o="${i}.4" type="text" class="brl" inputmode="numeric" autocomplete="off" value="${fmtBR(it[4])}" aria-label="Previsto" style="min-width:110px;text-align:right"></td>
      <td class="v"><input data-o="${i}.8" type="text" class="brl" inputmode="numeric" autocomplete="off" value="${fmtBR(it[8])}" placeholder="—" aria-label="Realizado" style="min-width:110px;text-align:right"></td>
      <td><button class="link" data-odel="${i}" aria-label="Excluir ${esc(it[1])}">Excluir</button></td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="6">Total</td><td class="v">${brl2(total(e))}</td><td class="v">${brl2(e.itens.reduce((s,i)=>s+(i[8]??0),0))}</td><td></td></tr></tfoot>
  </table></div>`:'<p class="note" style="margin-top:0">Nenhum item ainda. Adicione à medida que chegarem os orçamentos.</p>'}
  <div class="form"><button class="btn btn-sec" id="addItem">${I.plus} Adicionar item</button></div>
  <datalist id="segsugs">${segSugs(e).map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
  <p class="note">Detalhe por item aqui (copo, bolinho, café); a visão geral soma tudo por segmento (Buffet, Logística, Montadora). Realizado é o valor pago de verdade, pela NF: fica em branco até pagar.</p></div>${iaPanel(e)}`;
}
// ---------- sugestões do Claude para reduzir o orçamento ----------
let SAMPLE=null;const IA={};
// Rascunho e conversa ficam guardados neste navegador, por evento: trocar de aba, sair do campo ou recarregar não perde o texto.
const IA_KEY=id=>'dash-ia-'+id;
function iaEstado(id){if(!IA[id]){let g=null;try{g=JSON.parse(localStorage.getItem(IA_KEY(id))||'null')}catch(_){}
  IA[id]={msgs:(g&&Array.isArray(g.msgs)?g.msgs:[]).filter(m=>m&&m.content&&!m.erro),rascunho:(g&&g.rascunho)||''}}return IA[id]}
function iaGuardar(id){const st=IA[id];try{if(!st||(!st.msgs.length&&!st.rascunho))localStorage.removeItem(IA_KEY(id));
  else localStorage.setItem(IA_KEY(id),JSON.stringify({msgs:st.msgs.filter(m=>!m.erro&&m.content).slice(-20),rascunho:st.rascunho}))}catch(_){}}
const IA_PERG=['Onde dá pra cortar 10% sem mexer no estande?','Tem cotação mais barata que não escolhemos?','O que está mais caro que na edição anterior?','Como gastar menos com voos, hotel e Uber?'];
function mdIA(t){const linhas=esc(t||'').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split('\n');let h='',ul=false;
  linhas.forEach(l=>{const m=l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if(m){if(!ul){h+='<ul>';ul=true}h+='<li>'+m[1]+'</li>'}
    else{if(ul){h+='</ul>';ul=false}const x=l.replace(/^#+\s*/,'');if(x.trim())h+='<p>'+(x!==l?'<b>'+x+'</b>':x)+'</p>'}});
  return h+(ul?'</ul>':'')}
function iaPanel(e){if(!SAMPLE||e._col)return '';const st=iaEstado(e.id);
  return `<div class="panel ia" id="iaBox"><h3>Pedir sugestões ao Claude</h3>
  <p class="note" style="margin-top:0">O Claude lê os itens do Geral, as cotações, voos, hospedagem e a edição anterior deste evento, e sugere onde reduzir. Ele não muda nada no dash: vocês decidem e editam.</p>
  ${st.msgs.length?'':`<div class="ia-chips">${IA_PERG.map(q=>`<button type="button" class="chip" data-iaq="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
  <div class="ia-log" id="iaLog" aria-live="polite">${st.msgs.map(m=>`<div class="ia-msg ${m.role}${m.erro?' erro':''}">${m.role==='user'?esc(m.texto):mdIA(m.content)||'Pensando…'}</div>`).join('')}</div>
  <form id="iaForm" class="ia-form" novalidate><textarea data-livre name="q" rows="2" aria-label="Pergunta para o Claude" placeholder="Ex.: precisamos cortar R$ 20 mil. O que você sugere?" ${st.busy?'disabled':''}>${esc(st.rascunho||'')}</textarea>
  <div class="form"><button class="btn btn-primary" data-livre ${st.busy?'disabled':''}>${st.busy?'Pensando…':'Pedir sugestão'}</button>${st.msgs.length&&!st.busy?'<button type="button" class="btn btn-sec" data-livre id="iaNova">Nova conversa</button>':''}</div></form></div>`}
function iaContexto(e){const L=[],v=x=>brl2(+x||0);
  L.push(`Evento: ${e.nome}${e.sub?' ('+e.sub+')':''} · ${TIPOS[e.tipo]||''} · ${dataTxt(e)} · ${e.local||'local a definir'} · fase: ${FASE_TAG[e.fase]||''}`);
  L.push(`Verba: ${e.verba!=null?v(e.verba):'não definida'} · Previsto: ${v(total(e))} · Realizado: ${v(realizado(e))} · Comprometido (realizado ou, sem ele, previsto): ${v(comprometido(e))}${e.verba!=null?' · Ainda pra gastar: '+v(e.verba-comprometido(e)):''}`);
  L.push(`Equipe cadastrada: ${e.equipe.length} pessoas.`);
  L.push('\nITENS DO GERAL (segmento | item | descrição | fornecedor | status | previsto | realizado):');
  e.itens.forEach(i=>L.push(`- ${i[0]} | ${i[1]} | ${i[2]||''} | ${i[3]||''} | ${i[5]} | ${v(i[4])} | ${i[8]!=null?v(i[8]):'—'}`));
  if(e.cot.length){L.push('\nCOTAÇÕES (segmento | fornecedor | opção | qtd/dia × dias × unitário = total | escolhida):');
    e.cot.forEach(c=>{migrarCot(c);c.forns.forEach(f=>f.ops.forEach(o=>L.push(`- ${c.seg} | ${f.nome} | ${o.desc||''} | ${+o.qtd||0} × ${+o.dias||0} × ${v(o.unit)} = ${v(opTotal(o))} | ${o.esc?'sim':'não'}`)))})}
  if(e.quartos.length){const H=hoteisDe(e);L.push('\nHOSPEDAGEM:');H.forEach((h,k)=>L.push(`- Hotel ${h.nome||'sem nome'}: single ${v(h.single)}, duplo ${v(h.duplo)} por diária`));
    e.quartos.forEach(q=>L.push(`- ${q.tipo} ${(H[q.hotel]||{}).nome||''}: ${q.ocup.filter(Boolean).join(' e ')||'sem nome'} · ${isoBR(q.in)} a ${isoBR(q.out)} (${noites(q)} noites) = ${v(valQuarto(e,q))}`))}
  if(e.trechos.length){L.push('\nVOOS (direção | nome | data | cia | valor):');e.trechos.forEach(t=>L.push(`- ${t.dir} | ${t.nome||''} | ${isoBR(t.data)} | ${t.cia||''} | ${v(t.valor)}`))}
  const base=n=>normN(n).replace(/\b(19|20)\d{2}\b/g,'').trim();
  const ant=EVENTOS.filter(x=>x.id!==e.id&&x.ano<e.ano&&base(x.nome)===base(e.nome)).sort((a,b)=>b.ano-a.ano)[0];
  if(ant){L.push(`\nEDIÇÃO ANTERIOR: ${ant.nome} (${dataTxt(ant)}), verba ${ant.verba!=null?v(ant.verba):'—'}, total ${v(comprometido(ant))}. Itens (segmento | item | descrição | fornecedor | valor):`);
    ant.itens.forEach(i=>L.push(`- ${i[0]} | ${i[1]} | ${i[2]||''} | ${i[3]||''} | ${v(i[8]!=null?i[8]:i[4])}`))}
  return L.join('\n')}
function iaPrompt(e,q){return `Você ajuda o time de marketing da Dellamed (fabricante brasileira de equipamentos médicos, sede em Caxias do Sul) a reduzir o orçamento de um evento.
Regras:
- Português do Brasil, direto, sem introdução nem elogio. No máximo 250 palavras.
- Baseie-se nos dados abaixo. Não invente preços de mercado nem fornecedores. Ideia sem valor nos dados pode entrar, marcada "(sem valor nos dados)".
- Para cada sugestão: o item, quanto economiza em R$ e o impacto ou risco no evento.
- Procure: cotação mais barata não escolhida, item mais caro que na edição anterior, quantidade ou dias que parecem errados, item duplicado, item que pode ser cortado ou reduzido.
- Não sugira cortar o espaço do estande nem taxas obrigatórias da feira.
- Formato: lista com "- " e **negrito** só no nome do item. Feche com uma linha "Economia possível: R$ X".

DADOS DO EVENTO
${iaContexto(e)}

PERGUNTA
${q}`}
async function iaPerguntar(e,q){q=(q||'').trim();if(!q||!SAMPLE)return;const st=iaEstado(e.id);if(st.busy)return;st.rascunho='';
  const primeira=!st.msgs.length;
  st.msgs.push({role:'user',texto:q,content:primeira?iaPrompt(e,q):q});const resp={role:'assistant',content:''};st.msgs.push(resp);st.busy=true;iaRedesenhar(e);
  const hist=st.msgs.filter(m=>m!==resp&&!m.erro).map(m=>({role:m.role,content:m.content}));
  try{const r=await SAMPLE(hist,{cache:false,onText:({text})=>{resp.content=text;const el=document.querySelector('#iaLog .ia-msg.assistant:last-child');if(el)el.innerHTML=mdIA(text)||'Pensando…'}});
    resp.content=r.text||resp.content;if(r.truncated)resp.content+='\n\n(A resposta foi cortada. Peça "continue".)'}
  catch(err){resp.erro=true;const c=err&&err.code;
    resp.content=c==='not_granted'?'O Claude não está liberado nesta visualização.':c==='rate_limited'?'Muitas perguntas seguidas. Espere um minuto e tente de novo.':'Não consegui responder agora. Tente de novo em instantes.';
    if(c==='not_granted')SAMPLE=null}
  st.busy=false;iaGuardar(e.id);iaRedesenhar(e)}
function iaRedesenhar(e){const b=document.getElementById('iaBox');if(!b)return;b.outerHTML=iaPanel(e);ligarIA(e);const l=document.getElementById('iaLog');if(l&&l.lastElementChild)l.lastElementChild.scrollIntoView({block:'nearest'})}
function ligarIA(e){const b=document.getElementById('iaBox');if(!b)return;
  b.querySelectorAll('[data-iaq]').forEach(x=>x.onclick=()=>iaPerguntar(e,x.dataset.iaq));
  const f=b.querySelector('#iaForm');f.onsubmit=ev=>{ev.preventDefault();const q=f.q.value;if(!q.trim()){f.q.focus();return}f.q.value='';iaPerguntar(e,q)};
  f.q.oninput=()=>{const st=iaEstado(e.id);st.rascunho=f.q.value;clearTimeout(st.t);st.t=setTimeout(()=>iaGuardar(e.id),400)};
  f.q.onblur=()=>{const st=iaEstado(e.id);st.rascunho=f.q.value;iaGuardar(e.id)};
  f.q.onkeydown=ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();f.requestSubmit()}};
  const n=b.querySelector('#iaNova');if(n)n.onclick=()=>{IA[e.id]={msgs:[],rascunho:''};iaGuardar(e.id);iaRedesenhar(e)}}
function checklist(e){
  const hoje=new Date().toISOString().slice(0,10);
  const lista=e.tarefas.map((x,i)=>[x,i]).sort((a,b)=>(a[0][2]-b[0][2])||((a[0][4]||'9')<(b[0][4]||'9')?-1:(a[0][4]||'9')>(b[0][4]||'9')?1:0));
  const feitas=e.tarefas.filter(x=>x[2]).length;
  return `<div class="panel"><h3>Checklist <span class="who" style="font-family:var(--font-body);font-weight:400">· ${feitas} de ${e.tarefas.length} feitas</span></h3>
    ${e.tarefas.length?`<div class="tbl"><table class="quartos chk"><thead><tr><th style="width:44px">Feito</th><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Observação</th><th></th></tr></thead><tbody>
    ${lista.map(([x,i])=>{const atrasada=!x[2]&&x[4]&&x[4]<hoje;return `<tr class="${x[2]?'feita':''}">
      <td><input type="checkbox" data-tk="${i}" ${x[2]?'checked':''} aria-label="Marcar ${esc(x[0])} como feita" style="width:22px;height:22px;min-height:22px"></td>
      <td><input data-tf="${i}.0" value="${esc(x[0])}" aria-label="Tarefa" style="min-width:220px"></td>
      <td><input data-tf="${i}.3" data-sug="resp" autocomplete="off" value="${esc(x[3])}" placeholder="Quem faz" aria-label="Responsável" style="min-width:140px"></td>
      <td><input data-tf="${i}.4" class="data${atrasada?' erro':''}" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" value="${isoBR(x[4])}" aria-label="Prazo" style="min-width:110px">${atrasada?'<div class="who" style="color:var(--red)">atrasada</div>':''}</td>
      <td><input data-tf="${i}.1" value="${esc(x[1])}" placeholder="—" aria-label="Observação" style="min-width:160px"></td>
      <td><button class="link" data-tdel="${i}" aria-label="Excluir tarefa">Excluir</button></td></tr>`}).join('')}
    </tbody></table></div>`:'<p class="note" style="margin-top:0">Nenhuma tarefa ainda. Adicione a primeira abaixo.</p>'}
    <form class="form" id="fTk" novalidate>
      <label class="f" style="flex:2 1 240px">Nova tarefa<input name="t" autocomplete="off" placeholder="Ex.: enviar logo para a montadora"></label>
      <label class="f">Responsável<input name="resp" data-sug="resp" autocomplete="off"></label>
      <label class="f" style="flex:0 1 140px">Prazo<input name="prazo" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa"></label>
      <button class="btn btn-primary">${I.plus} Adicionar tarefa</button></form>
    <p class="note">Tarefas feitas vão para o fim da lista. As abertas aparecem por prazo, e as atrasadas ficam em vermelho.</p>
  </div>`;
}

function resultados(e){
  const t=total(e), r=e.res;
  const inp=(k,lbl)=>k==='faturamento'?`<label class="f">${lbl}<input type="text" class="brl" inputmode="numeric" autocomplete="off" data-r="${k}" value="${fmtBR(r[k])}" placeholder="0,00"></label>`
    :`<label class="f">${lbl}<input type="number" min="0" inputmode="decimal" data-r="${k}" value="${r[k]??''}" placeholder="—"></label>`;
  if(e.tipo==='corrida'){
    return `<div class="panel"><h3>Resultados da corrida</h3>
      <div class="form">${inp('inscritos','Inscritos')}${inp('concluintes','Concluintes')}${inp('nota','Nota média da avaliação (0 a 10)')}</div>
      <div class="cmp" style="margin-top:18px">${r.inscritos&&t?`<span>Custo por inscrito <b class="num">${brl(t/r.inscritos)}</b></span>`:''}
      ${r.inscritos&&r.concluintes?`<span>Taxa de conclusão <b class="num">${Math.round(r.concluintes/r.inscritos*100)}%</b></span>`:''}</div>
      <p class="note">Custo por inscrito usa o total do orçamento (${brl(t)}).</p></div>`;
  }
  if(e.tipo==='interno'){
    return `<div class="panel"><h3>Resultados do evento interno</h3>
      <div class="form">${inp('participantes','Participantes')}${inp('nota','Nota média da avaliação (0 a 10)')}${inp('respostas','Respostas da avaliação')}</div>
      <div class="cmp" style="margin-top:18px">${r.participantes&&t?`<span>Custo por participante <b class="num">${brl(t/r.participantes)}</b></span>`:''}
      ${r.participantes&&r.respostas?`<span>Taxa de resposta <b class="num">${Math.round(r.respostas/r.participantes*100)}%</b></span>`:''}</div>
      <p class="note">Evento interno não tem lead nem pedido. A nota pode vir do formulário de avaliação.</p></div>`;
  }
  const cpl=r.leads&&t?t/r.leads:null, roi=r.faturamento&&t?r.faturamento/t:null;
  return `<div class="panel"><h3>Resultados da feira</h3>
    <div class="form">${inp('visitantes','Visitantes no estande')}${inp('leads','Leads captados')}${inp('qualificados','Leads qualificados')}</div>
    <div class="form">${inp('pedidos','Pedidos fechados')}${inp('faturamento','Valor fechado (R$)')}</div>
    <div class="fields" style="margin-top:18px">
      <div class="calc"><small>Custo por lead</small><div class="num">${cpl?brl(cpl):'—'}</div></div>
      <div class="calc"><small>Retorno sobre o investido</small><div class="num">${roi?roi.toLocaleString('pt-BR',{maximumFractionDigits:1})+'×':'—'}</div></div>
      <div class="calc"><small>Ticket médio por pedido</small><div class="num">${r.pedidos&&r.faturamento?brl(r.faturamento/r.pedidos):'—'}</div></div>
    </div>
    <p class="note">Você digita os números; custo por lead, retorno e ticket médio são calculados com o total do orçamento (${brl(t)}).</p></div>`;
}

const rmBtn=k=>`<button class="link" data-rm="${k}">Remover aba</button>`;
function sugestoes(campo){const m=new Map();EVENTOS.forEach(ev=>(ev.equipe||[]).forEach(p=>{const v=(p[campo]||'').trim();if(v&&!m.has(v.toLowerCase()))m.set(v.toLowerCase(),v)}));
  return [...m.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
// ---------- sugestões em ordem alfabética ----------
let SUG=null;
function normS(t){return (t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
function fecharSug(){if(SUG){SUG.el.remove();SUG.inp.setAttribute('aria-expanded','false');SUG.inp.removeAttribute('aria-activedescendant');SUG=null}}
function abrirSug(inp){
  const campo=inp.dataset.sug, q=normS(inp.value.trim());
  const hid=location.hash.slice(1).split('--')[0];
  const ev=EVENTOS.find(x=>x.id===hid)||PATROS.find(x=>x.id===hid);
  let lista=campo==='seg'?(ev?segSugs(ev):SEG_PADRAO.slice()):campo==='resp'?[...new Set([...(ev?ev.equipe.map(p=>p.nome):sugestoes('nome')),...(GERAL.tarefas||[]).map(t=>t.resp).filter(Boolean),...EVENTOS.flatMap(x=>(x.tarefas||[]).map(t=>t[3])).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR')):sugestoes(campo);
  if(campo==='nome'&&ev)lista=lista.filter(n=>!ev.equipe.some(p=>p.nome===n));
  // Segmento: se o campo já tem um segmento da lista, mostra todos os outros para trocar.
  if(campo==='seg'&&lista.some(v=>normS(v)===q))lista=lista.filter(v=>normS(v)!==q);
  else lista=lista.filter(v=>!q||normS(v).includes(q)&&normS(v)!==q);
  fecharSug();if(!lista.length)return;
  const el=document.createElement('ul');el.className='sug';el.id='sugList';el.setAttribute('role','listbox');
  el.innerHTML=lista.map((v,k)=>`<li role="option" id="sug${k}" data-v="${esc(v)}">${esc(v)}</li>`).join('');
  const r=inp.getBoundingClientRect();el.style.left=r.left+'px';el.style.top=(r.bottom+4)+'px';el.style.minWidth=r.width+'px';
  document.body.appendChild(el);inp.setAttribute('aria-expanded','true');inp.setAttribute('aria-controls','sugList');
  SUG={el,inp,ativo:-1,lista};
  el.addEventListener('mousedown',e=>{const li=e.target.closest('li');if(!li)return;e.preventDefault();escolherSug(li.dataset.v)});
}
function escolherSug(v){const inp=SUG.inp;inp.value=v;fecharSug();inp.dispatchEvent(new Event('change',{bubbles:true}))}
function moverSug(d){if(!SUG)return;const n=SUG.lista.length;SUG.ativo=(SUG.ativo+d+n)%n;
  SUG.el.querySelectorAll('li').forEach((li,k)=>li.classList.toggle('on',k===SUG.ativo));
  const li=SUG.el.children[SUG.ativo];li.scrollIntoView({block:'nearest'});SUG.inp.setAttribute('aria-activedescendant',li.id)}
document.addEventListener('focusin',e=>{const t=e.target;if(t.dataset&&t.dataset.sug){t.setAttribute('role','combobox');t.setAttribute('aria-autocomplete','list');abrirSug(t)}});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.sug)abrirSug(t)});
document.addEventListener('focusout',e=>{if(SUG&&e.target===SUG.inp)fecharSug()});
document.addEventListener('keydown',e=>{if(!SUG||e.target!==SUG.inp)return;
  if(e.key==='ArrowDown'){e.preventDefault();moverSug(1)}else if(e.key==='ArrowUp'){e.preventDefault();moverSug(-1)}
  else if(e.key==='Enter'&&SUG.ativo>=0){e.preventDefault();escolherSug(SUG.lista[SUG.ativo])}
  else if(e.key==='Escape'){e.stopPropagation();fecharSug()}},true);
addEventListener('scroll',()=>{if(!SUG)return;const r=SUG.inp.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){fecharSug();return}SUG.el.style.left=r.left+'px';SUG.el.style.top=(r.bottom+4)+'px'},true);
let EQ_EDIT=null;
const CRED={sim:'Sim',nao:'Não',na:'N/A'};
const credKey=p=>p.cred===true?'sim':p.cred==='na'?'na':'nao';
const credVal=k=>k==='sim'?true:k==='na'?'na':false;
const credSel=(attrs,v)=>`<select ${attrs}>${Object.entries(CRED).map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t}</option>`).join('')}</select>`;
function equipe(e){
  const cred=e.equipe.filter(p=>p.cred===true).length, credNA=e.equipe.filter(p=>p.cred==='na').length;
  return `<div class="panel"><h3>Equipe</h3>
    ${e.equipe.length?`<div class="tbl"><table><thead><tr><th>Nome</th><th>Função</th><th>Credencial</th><th></th></tr></thead><tbody>
      ${e.equipe.map((p,i)=>[p,i]).sort((x,y)=>x[0].nome.localeCompare(y[0].nome,'pt-BR')).map(([p,i])=>EQ_EDIT===e.id+'|'+i?`<tr class="usada" data-eqrow="${i}"><td><input data-nm="${i}" autocomplete="off" value="${esc(p.nome)}" aria-label="Nome" style="min-width:200px;font-weight:600"></td><td><input data-fn="${i}" data-sug="funcao" autocomplete="off" value="${esc(p.funcao||'')}" placeholder="Função" aria-label="Função" style="min-width:160px"></td><td>${credSel(`data-cr="${i}" aria-label="Credencial" style="min-width:90px"`,credKey(p))}</td><td style="white-space:nowrap"><button class="link" data-eqok="${i}" style="color:var(--navy);font-weight:600">Salvar</button><button class="link" data-eqcanc style="color:var(--muted)">Cancelar</button></td></tr>`
      :`<tr><td><b>${esc(p.nome)}</b></td><td>${p.funcao?esc(p.funcao):'<span class="who">—</span>'}</td><td>${CRED[credKey(p)]}</td><td style="white-space:nowrap"><button class="link" data-eqed="${i}" style="color:var(--navy)" aria-label="Editar ${esc(p.nome)}">Editar</button><button class="link" data-del="${i}" aria-label="Excluir ${esc(p.nome)}">Excluir</button></td></tr>`).join('')}
    </tbody></table></div>`:'<p class="note" style="margin-top:0">Ninguém na equipe ainda. Comece pelo nome de quem vai.</p>'}
    <form class="form" id="fEq" novalidate>
      <label class="f">Nome<input name="nome" data-sug="nome" autocomplete="off"></label>
      <label class="f">Função<input name="funcao" data-sug="funcao" placeholder="Ex.: vendas, promotora, marketing" autocomplete="off"></label>
      <label class="f" style="flex:0 1 120px;min-width:110px">Credencial${credSel('name="cred"','sim')}</label>
      <button class="btn btn-primary">${I.plus} Adicionar pessoa</button>
    </form>
    <div class="cmp"><span>Pessoas <b class="num">${e.equipe.length}</b></span>
      <span class="${e.credLimite&&cred>e.credLimite?'bad':''}">Credenciais <b class="num">${cred}${e.credLimite?' de '+e.credLimite+' incluídas':''}</b></span>${credNA?`<span>Não precisam <b class="num">${credNA}</b></span>`:''}</div>
    <p class="note">Clique em Editar para mudar nome, função ou credencial (Enter salva, Esc cancela). Ao trocar um nome, ele também muda nos voos, na hospedagem e no checklist deste evento.</p>
  </div>${rmBtn('equipe')}`;
}
function semEquipe(e,mod){return `<div class="panel"><h3>${MODULOS[mod].nome}</h3><p class="note" style="margin-top:0">Esta aba usa a lista de pessoas. ${e.abas.includes('equipe')?'Cadastre a equipe primeiro.':'Adicione a aba Equipe e cadastre quem vai.'}</p></div>${rmBtn(mod)}`}
const normN=n=>(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ']/g,'').replace(/\s+/g,' ').trim();
// Mesma pessoa mesmo com o nome escrito diferente: "Kimberly Nunes" = "Kimberly Pereira Nunes", "Carlos Dall'agno" = "Carlos Dall Agno".
function mesmaPessoa(a,b){a=normN(a);b=normN(b);if(!a||!b)return false;if(a===b||a.replace(/ /g,'')===b.replace(/ /g,''))return true;
  const x=a.split(' '),y=b.split(' ');if(x.length<2||y.length<2||x[0]!==y[0])return false;
  const ux=x.slice(1).join(''),uy=y.slice(1).join('');return x[x.length-1]===y[y.length-1]||ux.endsWith(y.slice(-1)[0])&&uy.endsWith(x.slice(-1)[0])||ux===uy}
function voos(e){
  const orc=orcadoPor(e,'passagens');
  const tot=e.trechos.reduce((s,t)=>s+(+t.valor||0),0);
  const dl=`<datalist id="pessoasV">${e.equipe.map(p=>`<option value="${esc(p.nome)}">`).join('')}</datalist>`;
  const alertas=[];
  if(orc&&tot>orc)alertas.push(`Os voos passam o orçado em ${brl2(tot-orc)}.`);
  ['ida','volta'].forEach(dir=>{
    const ts=e.trechos.filter(t=>t.dir===dir);
    const sem=ts.filter(t=>!t.nome).length; if(sem)alertas.push(`${sem} ${sem>1?'trechos':'trecho'} de ${dir} sem nome.`);
    const cont={};ts.forEach(t=>{if(t.nome)cont[normN(t.nome)]=(cont[normN(t.nome)]||0)+1});
    const dup=Object.entries(cont).filter(([,n])=>n>1).map(([k])=>(ts.find(t=>normN(t.nome)===k)||{}).nome);
    if(dup.length)alertas.push(`${dup.join(', ')} ${dup.length>1?'aparecem':'aparece'} duas vezes na ${dir}.`);
    const falta=e.equipe.filter(p=>!ts.some(t=>mesmaPessoa(t.nome,p.nome))).map(p=>p.nome);
    if(falta.length)alertas.push(`Sem voo de ${dir}: ${falta.join(', ')}.`);
  });
  const c=(i,k,ph,type='text',extra='')=>`<input data-v="${i}.${k}" type="${type}" value="${k==='valor'?fmtBR(e.trechos[i][k]):k==='data'?isoBR(e.trechos[i][k]):esc(e.trechos[i][k]??'')}" placeholder="${ph}" aria-label="${k}" ${extra}>`;
  const tabela=dir=>{
    const idx=e.trechos.map((t,i)=>[t,i]).filter(([t])=>t.dir===dir);
    const sub=idx.reduce((s,[t])=>s+(+t.valor||0),0);
    return `<h3 style="margin-top:8px">${dir==='ida'?'Ida':'Volta'} <span class="who" style="font-family:var(--font-body);font-weight:400">· ${idx.length} trechos</span></h3>
    <div class="tbl" data-vdir="${dir}"><table class="quartos"><thead><tr><th title="Marcado entra no Geral">Geral</th><th>${dir==='ida'?'Origem':'Destino'}</th><th>Nome</th><th>Data</th><th>Saída</th><th>Chegada</th><th>Cia</th><th>Voo</th><th>Localizador</th><th class="v">Valor</th><th></th></tr></thead><tbody>
    ${idx.map(([t,i])=>`<tr ${marcado(e,'voos',t)?'class="usada"':''}>
      <td><input type="checkbox" data-vesc="${i}" ${marcado(e,'voos',t)?'checked':''} aria-label="Levar trecho de ${esc(t.nome||'')} para o Geral" style="width:18px;height:18px;min-height:18px"></td>
      <td>${c(i,'cidade',dir==='ida'?'Origem':'Destino','text','style="min-width:110px"')}</td>
      <td>${c(i,'nome','Nome','text','list="pessoasV" style="min-width:160px"')}${t.obs?`<div class="who">${esc(t.obs)}</div>`:''}</td>
      <td>${c(i,'data','dd/mm/aaaa','text','class="data" inputmode="numeric" maxlength="10" autocomplete="off" style="min-width:110px"')}</td>
      <td>${c(i,'saida','00:00','text','class="hora" inputmode="numeric" maxlength="5" autocomplete="off" style="min-width:72px"')}</td>
      <td>${c(i,'chegada','00:00','text','class="hora" inputmode="numeric" maxlength="5" autocomplete="off" style="min-width:72px"')}</td>
      <td>${c(i,'cia','Cia','text','style="min-width:64px"')}</td>
      <td>${c(i,'voo','Nº','text','style="min-width:58px"')}</td>
      <td>${c(i,'loc','ABC123','text','style="min-width:84px;text-transform:uppercase"')}</td>
      <td class="v">${c(i,'valor','0,00','text','class="brl" inputmode="numeric" style="min-width:88px;text-align:right"')}</td>
      <td><button class="link" data-vdel="${i}" aria-label="Excluir trecho">Excluir</button></td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="9">Subtotal ${dir}</td><td class="v">${brl2(sub)}</td><td></td></tr></tfoot></table></div>
    <div class="form" style="margin-bottom:22px"><button class="btn btn-sec" data-vadd="${dir}">${I.plus} Adicionar trecho de ${dir}</button></div>`;
  };
  const semLoc=e.trechos.filter(t=>!t.loc).length;
  return `${alertas.map(t=>`<div class="flag">${I.warn}<span>${esc(t)}</span></div>`).join('')}
  <div class="panel">${dl}${tabela('ida')}${tabela('volta')}
    ${statusLog(e,'voos')}
    <div class="cmp"><span>Total dos voos <b class="num">${brl2(tot)}</b></span>${orc?`<span>Orçado em passagens <b class="num">${brl2(orc)}</b></span>
      <span class="${tot>orc?'bad':''}">${tot>orc?'Acima em':'Sobra'} <b class="num">${brl2(Math.abs(orc-tot))}</b></span>`:''}
      ${semLoc?`<span>Sem localizador <b class="num">${semLoc}</b></span>`:''}</div>
    <p class="note">Ao adicionar um trecho, ele copia cidade, data, horário e voo do anterior. Só troca o nome.</p>
  </div>${rmBtn('voos')}`;
}
const noites=q=>{if(!q.in||!q.out)return 0;const d=(new Date(q.out)-new Date(q.in))/864e5;return d>0?d:0};
const dataBR=d=>d?d.split('-').reverse().slice(0,2).join('/'):'';
// Vários hotéis: e.hoteis = [{nome,single,duplo}], cada quarto aponta o hotel em q.hotel. e.hotel fica igual ao 1º (compatibilidade).
function hoteisDe(e){if(!Array.isArray(e.hoteis)||!e.hoteis.length)e.hoteis=[{nome:'',single:0,duplo:0,...(e.hotel||{})}];
  e.quartos.forEach(q=>{if(q.hotel==null||q.hotel>=e.hoteis.length)q.hotel=0});e.hotel={...e.hoteis[0]};return e.hoteis}
const valQuarto=(e,q)=>((hoteisDe(e)[q.hotel]||{})[q.tipo]||0)*noites(q);
function hospedagem(e){
  const H=hoteisDe(e);
  const val=q=>valQuarto(e,q);
  const tot=e.quartos.reduce((s,q)=>s+val(q),0), orc=orcadoPor(e,'hospedagem');
  // alertas
  const nomes=e.quartos.flatMap(q=>q.ocup.filter(Boolean));
  const norm=n=>n.toLowerCase().normalize('NFD').replace(/[̀-ͯ']/g,'').replace(/\s+/g,' ').trim();
  const semQuarto=e.equipe.filter(p=>!nomes.some(n=>mesmaPessoa(n,p.nome)));
  const repetidos=e.equipe.filter(p=>nomes.filter(n=>mesmaPessoa(n,p.nome)).length>1);
  const duploUm=e.quartos.filter(q=>q.tipo==='duplo'&&q.ocup.filter(Boolean).length<2).length;
  const semData=e.quartos.filter(q=>!noites(q)).length;
  const dl=`<datalist id="pessoas">${e.equipe.map(p=>`<option value="${esc(p.nome)}">`).join('')}</datalist>`;
  const alertas=[
    tot>orc&&orc?['warn',`A hospedagem passa o orçado em ${brl2(tot-orc)} (${brl2(tot)} contra ${brl2(orc)}).`]:null,
    semQuarto.length?['warn',`Sem quarto: ${semQuarto.map(p=>p.nome).join(', ')}.`]:null,
    repetidos.length?['warn',`Em mais de um quarto: ${repetidos.map(p=>p.nome).join(', ')}.`]:null,
    duploUm?['warn',`${duploUm} ${duploUm>1?'quartos duplos':'quarto duplo'} com uma pessoa só.`]:null,
    semData?['warn',`${semData} ${semData>1?'quartos':'quarto'} sem período válido.`]:null
  ].filter(Boolean);
  const bloco=(h,hi)=>{const qs=e.quartos.map((q,i)=>[q,i]).filter(([q])=>q.hotel===hi);const sub=qs.reduce((s,[q])=>s+val(q),0);
    return `<div class="forn" data-hotel="${hi}">
    <div class="form" style="margin-top:0">
      <label class="f" style="flex:2">${H.length>1?`Hotel ${hi+1}`:'Hotel'}<input data-h="${hi}.nome" value="${esc(h.nome||'')}" placeholder="Nome do hotel"></label>
      <label class="f">Diária single (R$)<input type="text" class="brl" inputmode="numeric" autocomplete="off" data-h="${hi}.single" value="${fmtBR(h.single||'')}" placeholder="0,00"></label>
      <label class="f">Diária duplo (R$)<input type="text" class="brl" inputmode="numeric" autocomplete="off" data-h="${hi}.duplo" value="${fmtBR(h.duplo||'')}" placeholder="0,00"></label>
      ${H.length>1?`<button class="link" data-hdel="${hi}" style="align-self:center">Excluir hotel</button>`:''}</div>
    <p class="who" style="margin:6px 0 0;font-size:12px;color:var(--muted);text-align:right">* O valor das diárias já deve considerar a % do ISS.</p>
    ${qs.length?`<div class="tbl" style="margin-top:12px"><table class="quartos"><thead><tr><th title="Marcado entra no Geral">Geral</th><th>#</th><th>Entrada</th><th>Saída</th><th>Noites</th><th>Tipo</th><th>Hóspede 1</th><th>Hóspede 2</th><th class="v">Valor</th><th></th></tr></thead><tbody>
    ${qs.map(([q,i],n)=>`<tr ${marcado(e,'hosp',q)?'class="usada"':''}>
      <td><input type="checkbox" data-qesc="${i}" ${marcado(e,'hosp',q)?'checked':''} aria-label="Levar quarto ${n+1} para o Geral" style="width:18px;height:18px;min-height:18px"></td>
      <td class="num"><b>${n+1}</b></td>
      <td><input type="text" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" data-q="${i}.in" value="${isoBR(q.in)}" aria-label="Entrada do quarto ${n+1}"></td>
      <td><input type="text" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" data-q="${i}.out" value="${isoBR(q.out)}" aria-label="Saída do quarto ${n+1}"></td>
      <td class="num">${noites(q)}</td>
      <td><select data-q="${i}.tipo" aria-label="Tipo do quarto ${n+1}" style="min-width:96px"><option value="duplo" ${q.tipo==='duplo'?'selected':''}>Duplo</option><option value="single" ${q.tipo==='single'?'selected':''}>Single</option></select></td>
      <td><input list="pessoas" data-q="${i}.ocup.0" value="${esc(q.ocup[0])}" placeholder="Nome" aria-label="Hóspede 1 do quarto ${n+1}"></td>
      <td>${q.tipo==='duplo'?`<input list="pessoas" data-q="${i}.ocup.1" value="${esc(q.ocup[1])}" placeholder="Nome" aria-label="Hóspede 2 do quarto ${n+1}">`:'<span class="who">—</span>'}</td>
      <td class="v">${brl2(val(q))}</td>
      <td><button class="link" data-qdel="${i}" aria-label="Excluir quarto ${n+1}">Excluir</button></td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="8">${qs.length} ${qs.length===1?'quarto':'quartos'} · ${qs.reduce((s,[q])=>s+noites(q),0)} diárias</td><td class="v">${brl2(sub)}</td><td></td></tr></tfoot></table></div>`
    :'<p class="note">Nenhum quarto neste hotel ainda.</p>'}
    <div class="form" style="margin-top:10px"><button class="btn btn-sec" data-addq="${hi}">${I.plus} Adicionar quarto</button></div>
  </div>`};
  return `${alertas.map(([k,t])=>`<div class="flag">${I.warn}<span>${esc(t)}</span></div>`).join('')}
  <div class="panel"><h3>Hospedagem</h3>${dl}
   ${H.map(bloco).join('')}
   <div class="form" style="margin-top:0"><button class="btn btn-sec" id="addHotel">${I.plus} Adicionar outro hotel</button></div>
   ${statusLog(e,'hosp')}
   <div class="cmp"><span>Total${H.length>1?` dos ${H.length} hotéis`:''} <b class="num">${brl2(tot)}</b></span>${orc?`<span>Orçado <b class="num">${brl2(orc)}</b></span>
     <span class="${tot>orc?'bad':''}">${tot>orc?'Acima em':'Sobra'} <b class="num">${brl2(Math.abs(orc-tot))}</b></span>`:''}</div>
   <p class="note">Hóspede pode ser alguém da equipe ou um nome livre, como "Farma Interno". O valor é diária × noites, por quarto, com a diária do hotel daquele quarto.</p>
  </div>${rmBtn('hospedagem')}`;
}
function notas(e){return `<div class="panel"><h3>Anotações</h3><textarea id="notas" rows="10" placeholder="Contatos, combinados com fornecedor, lembretes...">${esc(e.notas)}</textarea></div>${rmBtn('notas')}`}
// ---------- Cotações: segmento → fornecedores → opções (qtd/dia × dias × unitário) ----------
const opTotal=o=>(+o.qtd||0)*(+o.dias||0)*(+o.unit||0);
const fornTotal=f=>(f.ops||[]).reduce((s,o)=>s+opTotal(o),0);
const normO=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
// Converte o formato antigo (lista de opções soltas) para fornecedores com opções.
function migrarCot(c){
  if(c.forns)return c;
  const fs=[];(c.opcoes||[]).forEach(o=>{let f=fs.find(x=>x.nome===o.forn);if(!f){f={nome:o.forn||'',ops:[]};fs.push(f)}
    const lv=(o.linhas||[]).filter(l=>(l.item||'').trim()||+l.valor);
    if(lv.length)lv.forEach(l=>f.ops.push({desc:l.item||'',qtd:1,dias:1,unit:+l.valor||0,esc:!!o.escolhida}));
    else if(o.unit&&o.total)f.ops.push({desc:o.desc||'',qtd:Math.round(o.total/o.unit),dias:1,unit:o.unit,esc:!!o.escolhida});
    else f.ops.push({desc:o.desc||'',qtd:1,dias:1,unit:o.total||0,esc:!!o.escolhida})});
  c.forns=fs;delete c.opcoes;return c}
function itemDe(e,c){return c.item?e.itens.find(i=>i[1]===c.item&&!i[6]):null}
// Leva as opções marcadas do segmento para o orçamento (uma linha por opção).
function lancarSeg(e,c){
  const marc=c.forns.flatMap(f=>f.ops.filter(o=>o.esc).map(o=>[f,o]));
  const antes=e.itens.findIndex(i=>i[6]===c.seg||(marc.length&&c.item&&i[1]===c.item&&!i[6]));
  const status=(e.itens.find(i=>i[6]===c.seg)||itemDe(e,c)||[])[5];
  const reqs={};e.itens.filter(i=>i[6]===c.seg||(marc.length&&c.item&&i[1]===c.item&&!i[6])).forEach(i=>{if(i[7])reqs[i[1]+'|'+i[3]]=i[7]});
  e.itens=e.itens.filter(i=>i[6]!==c.seg&&!(marc.length&&c.item&&i[1]===c.item&&!i[6]));
  const novas=marc.map(([f,o])=>[c.cat||'Outros',marc.length===1&&c.item?c.item:(o.desc||c.seg),
    [o.desc,`${o.qtd||0}/dia × ${o.dias||0} dia${(+o.dias||0)===1?'':'s'} × ${brl2(+o.unit||0)}`].filter(Boolean).join(' · '),f.nome,Math.round(opTotal(o)*100)/100,
    status&&status!=='Estimativa'?status:'Orçado',c.seg]);
  novas.forEach(n=>n[7]=reqs[n[1]+'|'+n[3]]||'');
  e.itens.splice(antes<0?e.itens.length:Math.min(antes,e.itens.length),0,...novas);
  return marc.length?`${marc.length} ${marc.length===1?'opção lançada':'opções lançadas'} no orçamento (${brl2(marc.reduce((s,[,o])=>s+opTotal(o),0))}).`:'Nenhuma opção marcada: o segmento saiu do orçamento.'}
function cotacoes(e){
  e.cot.forEach(migrarCot);
  const segs=e.cot;
  const chips=`<div class="chips" role="tablist" aria-label="Segmentos" style="margin-bottom:18px">
    ${segs.map((c,i)=>{const ok=c.forns.some(f=>f.ops.some(o=>o.esc));return `<button class="chip" role="tab" aria-pressed="${i===e.segAtivo}" data-seg="${i}">${esc(c.seg)}${ok?` <span aria-label="decidido" style="display:inline-flex">${I.check}</span>`:''}</button>`}).join('')}
    <button class="chip" id="addSeg" style="border-style:dashed">${I.plus} Segmento</button></div>`;
  if(!segs.length)return `<div class="panel"><h3>Cotações</h3>${chips}<p class="note">Crie o primeiro segmento, como Montadora, Buffet ou Brindes.</p></div>`;
  const c=segs[Math.min(e.segAtivo,segs.length-1)];
  // menor preço por opção com o mesmo nome em fornecedores diferentes
  const melhor={};c.forns.forEach(f=>f.ops.forEach(o=>{const k=normO(o.desc),t=opTotal(o);if(k&&t>0&&(melhor[k]==null||t<melhor[k].t))melhor[k]={t,n:(melhor[k]?melhor[k].n:0)}}));
  c.forns.forEach(f=>f.ops.forEach(o=>{const k=normO(o.desc);if(melhor[k])melhor[k].n++}));
  const totais=c.forns.map(fornTotal).filter(t=>t>0), menorF=totais.length>1?Math.min(...totais):null;
  const marcadas=c.forns.flatMap(f=>f.ops.filter(o=>o.esc)), somaMarc=marcadas.reduce((s,o)=>s+opTotal(o),0);
  const tagged=e.itens.filter(i=>i[6]===c.seg), it=itemDe(e,c);
  let aviso='';
  if(false)aviso=`O orçamento não bate com as opções marcadas de ${c.seg}. Marque ou desmarque uma opção para atualizar.`;
  else if(false)aviso=`O orçamento usa ${brl2(it[4])} em "${it[1]}" sem nenhuma opção marcada aqui. Marque a opção escolhida para ligar os dois.`;
  const inp=(fi,oi,k,v,extra='')=>`<input data-co="${fi}.${oi}.${k}" value="${esc(v??'')}" ${extra}>`;
  const blocos=c.forns.map((f,fi)=>{const tf=fornTotal(f);return `<div class="forn">
    <div class="forn-head">
      <label class="f" style="flex:1 1 220px">Fornecedor<input data-cf="${fi}" value="${esc(f.nome)}" style="font-weight:600"></label>
      <div class="forn-tot"><small>Total do fornecedor</small><b class="num">${brl2(tf)}</b>${menorF!=null&&tf===menorF?'<span class="st Contratado">menor total</span>':''}</div>
      <button class="link" data-cfall="${fi}" style="color:var(--navy);font-weight:600">Marcar todas</button>
      <button class="link" data-cfdel="${fi}" aria-label="Excluir fornecedor">Excluir fornecedor</button>
    </div>
    <div class="tbl"><table class="quartos"><thead><tr><th style="width:76px">Escolhida</th><th>Opção</th><th>Qtd. por dia</th><th>Dias</th><th class="v">Valor unitário</th><th class="v">Valor total</th><th></th></tr></thead><tbody>
    ${f.ops.map((o,oi)=>{const k=normO(o.desc),m=melhor[k],barato=m&&m.n>1&&opTotal(o)===m.t&&opTotal(o)>0;return `<tr ${o.esc?'class="usada"':''}>
      <td><input type="checkbox" data-cesc="${fi}.${oi}" ${o.esc?'checked':''} aria-label="Marcar ${esc(o.desc)} de ${esc(f.nome)} como escolhida" style="width:22px;height:22px;min-height:22px"></td>
      <td>${inp(fi,oi,'desc',o.desc,'placeholder="Ex.: bolinhos de arroz" aria-label="Opção" style="min-width:180px"')}</td>
      <td>${inp(fi,oi,'qtd',o.qtd,'inputmode="numeric" aria-label="Quantidade por dia" style="min-width:80px;max-width:110px"')}</td>
      <td>${inp(fi,oi,'dias',o.dias,'inputmode="numeric" aria-label="Dias" style="min-width:60px;max-width:80px"')}</td>
      <td class="v"><input data-co="${fi}.${oi}.unit" type="text" class="brl" inputmode="numeric" autocomplete="off" value="${+o.unit?fmtBR(o.unit):''}" placeholder="0,00" aria-label="Valor unitário" style="text-align:right;min-width:100px"></td>
      <td class="v"><b>${brl2(opTotal(o))}</b>${barato?'<div class="who" style="color:var(--ok)">menor preço</div>':''}</td>
      <td style="white-space:nowrap">${o.esc?(e.itens.some(i=>i[6]===c.seg&&i[3]===f.nome&&i[1]===(o.desc||c.seg))?'<span class="who" style="color:var(--ok)">No orçamento</span>':''):''}<button class="link" data-codel="${fi}.${oi}" aria-label="Excluir opção">Excluir</button></td></tr>
      ${PERG&&PERG.ev===e.id&&PERG.seg===c.seg&&PERG.fi===fi&&PERG.oi===oi?`<tr class="usada"><td colspan="7"><div class="flag info" role="alertdialog" aria-label="Lançar no orçamento" style="margin:0;align-items:center;flex-wrap:wrap">
        <span style="flex:1;min-width:220px">Criar uma linha no orçamento para <b>${esc(o.desc||c.seg)}</b> (${esc(f.nome)}), com ${brl2(opTotal(o))} no realizado? O previsto fica para você preencher.</span>
        <button class="btn btn-primary" data-pyes style="min-height:36px;padding:6px 14px">Lançar no orçamento</button><button class="btn btn-sec" data-pno style="min-height:36px;padding:6px 14px">Agora não</button></div></td></tr>`:''}`}).join('')}
    </tbody></table></div>
    <div class="form" style="margin-top:8px"><button class="btn btn-sec" data-coadd="${fi}">${I.plus} Adicionar opção</button></div>
  </div>`}).join('');
  return `${chips}
  ${aviso?`<div class="flag">${I.warn}<span>${esc(aviso)}</span></div>`:''}
  <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
    <h3 style="margin:0">Cotações · ${esc(c.seg)}</h3><button class="link" id="delSeg">Excluir segmento</button></div>
    ${c.forns.length?blocos:'<p class="note" style="margin-top:0">Nenhum fornecedor neste segmento ainda.</p>'}
    <form class="form" id="fForn" novalidate><label class="f" style="flex:1 1 260px">Novo fornecedor<input name="nome" autocomplete="off" placeholder="Ex.: DiCa Soluções"></label>
      <button class="btn btn-primary">${I.plus} Adicionar fornecedor</button></form>
    <p class="note">Valor total = quantidade por dia × dias × valor unitário. Marque "Escolhida" nas opções que vocês fecharam. A marcação não mexe no orçamento: os itens do orçamento são lançados à mão, na aba Geral.</p>
  </div>
  <div class="panel calc-box"><h3>Calculadora · ${esc(c.seg)}</h3>
    <div class="flag info" role="note">${I.warn}<span>Verifique se não há porcentagem extra referente à emissão da NF.</span></div>
    ${marcadas.length?`<div class="tbl"><table><thead><tr><th>Fornecedor</th><th>Opção</th><th class="v">Conta</th><th class="v">Valor</th></tr></thead><tbody>
      ${c.forns.filter(f=>f.ops.some(o=>o.esc)).map(f=>{const ms=f.ops.filter(o=>o.esc);return ms.map((o,k)=>`<tr>
        ${k===0?`<td rowspan="${ms.length}" style="vertical-align:top"><b>${esc(f.nome)}</b></td>`:''}
        <td>${esc(o.desc||'(sem nome)')}</td>
        <td class="v who">${+o.qtd||0} × ${+o.dias||0} × ${brl2(+o.unit||0)}</td>
        <td class="v">${brl2(opTotal(o))}</td></tr>`).join('')+(ms.length>1||c.forns.filter(x=>x.ops.some(o=>o.esc)).length>1?`<tr class="sub-t"><td colspan="3">Subtotal ${esc(f.nome)}</td><td class="v">${brl2(ms.reduce((s,o)=>s+opTotal(o),0))}</td></tr>`:'')}).join('')}
      </tbody><tfoot><tr><td colspan="3">Total selecionado (${marcadas.length} ${marcadas.length===1?'opção':'opções'})</td><td class="v">${brl2(somaMarc)}</td></tr></tfoot></table></div>`
    :'<p class="note" style="margin-top:0">Marque "Escolhida" nas opções acima e a soma aparece aqui, separada por fornecedor.</p>'}
  </div>
  `;
}
function ligarCot(e,P,aba){
  const c=e.cot[e.segAtivo];
  P.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{e.segAtivo=+b.dataset.seg;rerender(e,aba)});
  P.querySelector('#addSeg').onclick=()=>{
    P.querySelector('#addSeg').outerHTML=`<form id="fSeg" style="display:flex;gap:6px"><input name="seg" placeholder="Nome do segmento" style="min-height:44px;width:200px" aria-label="Nome do segmento"><button class="btn btn-primary">Criar</button></form>`;
    const f=P.querySelector('#fSeg');f.seg.focus();
    f.onsubmit=ev=>{ev.preventDefault();const n=f.seg.value.trim();if(!n)return;if(e.cot.some(x=>x.seg===n)){toast('Já existe um segmento com esse nome.');return}
      e.cot.push({seg:n,cat:'Outros',item:null,forns:[],notas:[]});e.segAtivo=e.cot.length-1;rerender(e,aba)}};
  if(!c)return;
  const ds=P.querySelector('#delSeg');if(ds)ds.onclick=()=>{
    if(ds.dataset.ok!=='1'){ds.dataset.ok='1';ds.textContent='Clique de novo para apagar (o orçamento não muda)';return}
    e.cot.splice(e.segAtivo,1);e.segAtivo=Math.max(0,e.segAtivo-1);toast(`Segmento ${c.seg} excluído.`);rerender(e,aba)};
  const sync=()=>{};
  const jaLancado=(f,o)=>e.itens.some(i=>i[6]===c.seg&&i[3]===f.nome&&i[1]===(o.desc||c.seg));
  const lancar=(fi,oi)=>{const f=c.forns[fi],o=f.ops[oi];
    e.itens.push([c.seg,o.desc||c.seg,`${+o.qtd||0}/dia × ${+o.dias||0} dia${(+o.dias||0)===1?'':'s'} × ${brl2(+o.unit||0)}`,f.nome,0,'Orçado',c.seg,'',Math.round(opTotal(o)*100)/100]);
    if(e._col&&!e.abas.includes('orcamento'))e.abas.push('orcamento');
    toast(`Lançado no orçamento: ${o.desc||c.seg}, com ${brl2(opTotal(o))} no realizado (segmento ${c.seg}).`)};
  P.querySelectorAll('[data-cesc]').forEach(cb=>cb.onchange=()=>{const [fi,oi]=cb.dataset.cesc.split('.').map(Number);const f=c.forns[fi],o=f.ops[oi];o.esc=cb.checked;
    PERG=cb.checked&&!jaLancado(f,o)?{ev:e.id,seg:c.seg,fi,oi}:null;rerender(e,aba);if(PERG)P.querySelector('[data-pyes]')?.focus()});
  const py=P.querySelector('[data-pyes]');if(py)py.onclick=()=>{const {fi,oi}=PERG;PERG=null;lancar(fi,oi);rerender(e,aba)};
  const pn=P.querySelector('[data-pno]');if(pn)pn.onclick=()=>{PERG=null;rerender(e,aba);toast('Tudo bem. Para lançar depois, desmarque e marque a opção de novo.')};
  P.querySelectorAll('[data-cfall]').forEach(b=>b.onclick=()=>{const fi=+b.dataset.cfall;c.forns.forEach((f,k)=>f.ops.forEach(o=>o.esc=k===fi));rerender(e,aba)});
  P.querySelectorAll('[data-co]').forEach(inp=>inp.onchange=()=>{const [fi,oi,k]=inp.dataset.co.split('.');const o=c.forns[+fi].ops[+oi];
    if(k==='desc')o.desc=inp.value.trim();else if(k==='unit')o.unit=parseBR(inp.value)||0;
    else{const n=parseFloat(inp.value.replace(/\./g,'').replace(',','.'));if(inp.value.trim()&&isNaN(n)){inp.classList.add('erro');toast('Use só números.');return}o[k]=isNaN(n)?0:n}
    sync();rerender(e,aba)});
  P.querySelectorAll('[data-cf]').forEach(inp=>inp.onchange=()=>{const f=c.forns[+inp.dataset.cf];if(!inp.value.trim()){inp.value=f.nome;toast('O fornecedor não pode ficar em branco.');return}f.nome=inp.value.trim();sync();rerender(e,aba)});
  P.querySelectorAll('[data-coadd]').forEach(b=>b.onclick=()=>{const f=c.forns[+b.dataset.coadd];const u=f.ops[f.ops.length-1];
    f.ops.push({desc:'',qtd:u?u.qtd:1,dias:u?u.dias:1,unit:0,esc:false});rerender(e,aba);
    const l=P.querySelectorAll(`[data-co^="${b.dataset.coadd}."][data-co$=".desc"]`);l[l.length-1]?.focus()});
  P.querySelectorAll('[data-clanc]').forEach(b=>b.onclick=()=>{const [fi,oi]=b.dataset.clanc.split('.').map(Number);PERG=null;lancar(fi,oi);rerender(e,aba)});
  P.querySelectorAll('[data-codel]').forEach(b=>b.onclick=()=>{const [fi,oi]=b.dataset.codel.split('.').map(Number);c.forns[fi].ops.splice(oi,1);sync();rerender(e,aba)});
  P.querySelectorAll('[data-cfdel]').forEach(b=>b.onclick=()=>{const fi=+b.dataset.cfdel;
    if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Clique de novo para excluir';return}c.forns.splice(fi,1);sync();rerender(e,aba)});
  P.querySelector('#fForn').onsubmit=ev=>{ev.preventDefault();const f=ev.target;const n=f.nome.value.trim();if(!n){f.nome.focus();toast('Escreva o nome do fornecedor.');return}
    const ref=c.forns[c.forns.length-1];
    c.forns.push({nome:n,ops:ref?ref.ops.map(o=>({desc:o.desc,qtd:o.qtd,dias:o.dias,unit:0,esc:false})):[{desc:'',qtd:1,dias:1,unit:0,esc:false}]});
    rerender(e,aba);const fi=c.forns.length-1;P.querySelector(`[data-co="${fi}.0.${ref?'unit':'desc'}"]`)?.focus();
    if(ref)toast('Copiei as opções do fornecedor anterior. Só preencha os valores.')};
}
const VIEWS={geral,orcamento,checklist,resultados,equipe,voos,hospedagem,notas,cotacoes,evento:patEvento};
function novoEvento(){const e=prep({id:'ev-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),ano,fase:'draft'});abrirEdicao(e,null,true)}

// ---------- Patrocínios (coleção "patrocinios"): mesma estrutura de um evento ----------
let PATROS=[], patCarregado=false;
const P_TIPOS={valor:'Só valor',acao:'Valor + ação'};
const P_STATUS={neg:'Negociando',fech:'Fechado',pago:'Pago'};
const P_MODULOS={orcamento:{nome:'Geral',desc:'Itens, fornecedor, requisição e valores'},cotacoes:{nome:'Cotações',desc:'Fornecedores e opções para comparar'},
  evento:{nome:'Evento',desc:'Data, local e informações do evento, quando houver'}};
function prepP(id,d){d={tipo:'valor',status:'neg',valor:0,notas:'',resp:'',evId:'',evIni:'',evFim:'',evLocal:'',evDesc:'',...(d||{})};
  delete d.inicio;delete d.fim; // período antigo do patrocínio não é mais usado
  const p=fromDb(id,d);if(p.temEv&&p.evIni&&!p.abas.includes('evento'))p.abas.push('evento');delete p.temEv;
  if(!Array.isArray(p.contraItens))p.contraItens=String(p.contra||'').split(/\n|;/).map(t=>t.trim()).filter(Boolean).map(t=>({t,feito:false}));delete p.contra;
  if(!d.ano)p.ano=p.evIni?+p.evIni.slice(0,4):new Date().getFullYear();p._col='patrocinios';return p}
// Data que vale para calendário e ordenação: só a da aba Evento, quando houver.
const pd=p=>p.abas&&p.abas.includes('evento')&&p.evIni?{inicio:p.evIni,fim:p.evFim||p.evIni}:{inicio:'',fim:''};
function patKpis(lista){
  const soma=f=>lista.filter(f).reduce((s,p)=>s+(+p.valor||0),0);
  return `<div class="kpis patro">
    <div class="kpi"><small>Total em patrocínios</small><strong class="num">${brl(soma(()=>true))}</strong><div class="sub">${lista.length} ${lista.length===1?'patrocínio':'patrocínios'} em ${ano} · fora da verba dos eventos</div></div>
    <div class="kpi"><small>Só valor</small><strong class="num">${brl(soma(p=>p.tipo!=='acao'))}</strong><div class="sub">${lista.filter(p=>p.tipo!=='acao').length} no ano</div></div>
    <div class="kpi"><small>Valor + ação</small><strong class="num">${brl(soma(p=>p.tipo==='acao'))}</strong><div class="sub">${lista.filter(p=>p.tipo==='acao').length} no ano</div></div>
    <div class="kpi"><small>Já pago</small><strong class="num">${brl(soma(p=>p.status==='pago'))}</strong><div class="sub">${brl(soma(p=>p.status!=='pago'))} fechado ou em negociação</div></div></div>`}
function patCard(p){const ev=p.evId&&EVENTOS.find(e=>e.id===p.evId);const ab=p.tarefas.filter(t=>!t[2]).length;
  return `<article class="card ev-card patro"><button class="card-link" data-pat="${p.id}" aria-label="Abrir ${esc(p.nome)}">
    <div class="chead"><span class="tag p-${p.status}">${P_STATUS[p.status]||''}</span><span class="mes">${mesDe(pd(p))||p.ano}</span></div>
    <h2>${esc(p.nome)}</h2>
    <div class="meta">${pd(p).inicio?`<span>${I.cal}Evento: ${esc(dataTxt(pd(p)))}</span>`:''}${p.resp?`<span>${I.edit}${esc(p.resp)}</span>`:''}</div>
    <div class="budget"><div class="row" style="align-items:baseline"><span>${P_TIPOS[p.tipo]||''}</span><b class="num" style="font-family:var(--font-title);font-size:20px;color:var(--patro)">${brl(+p.valor||0)}</b></div></div>
    ${p.contraItens.length?`<p class="note" style="margin:0">Contrapartidas: ${p.contraItens.filter(c=>c.feito).length} de ${p.contraItens.length} feitas</p>`:''}
    <div class="ctask-h" style="border-top:1px solid var(--light);padding-top:10px;margin:0"><b>Checklist</b><span class="who">${ab} ${ab===1?'aberta':'abertas'}</span></div>
  </button>
  ${ev?`<div class="ctask"><button class="link" style="color:var(--patro);padding:0;font-weight:600;text-align:left" data-ev="${ev.id}">Evento ligado: ${esc(ev.nome)}</button></div>`:''}
  </article>`}
function patroHTML(lista){
  return `${patKpis(lista)}<div class="grid">${lista.map(patCard).join('')}
    <button class="card new" data-newp style="border-color:var(--patro);color:var(--patro)">${I.plus}<span><b>Cadastrar patrocínio</b><br>Só valor ou valor + ação</span></button></div>
    ${lista.length?'':`<p class="empty">Nenhum patrocínio em ${ano}. Cadastre o primeiro em "Novo patrocínio".</p>`}`;
}
let CONTRA_EDIT=null;
function contraHTML(p){const C=p.contraItens,feitas=C.filter(c=>c.feito).length;
  const li=(c,i)=>CONTRA_EDIT===p.id+'|'+i
    ?`<li><input data-cin="${i}" value="${esc(c.t)}" aria-label="Contrapartida" style="flex:1"><span style="white-space:nowrap;align-self:center"><button class="link" data-cok="${i}" style="color:var(--patro);font-weight:600">Salvar</button><button class="link" data-ccanc style="color:var(--muted)">Cancelar</button></span></li>`
    :`<li><label style="display:flex;gap:10px;flex:1;cursor:pointer;align-items:flex-start"><input type="checkbox" data-cchk="${i}" ${c.feito?'checked':''} aria-label="Marcar como feita: ${esc(c.t)}" style="width:20px;height:20px;min-height:20px;flex:none;margin-top:2px;accent-color:var(--patro)"><span style="${c.feito?'text-decoration:line-through;color:var(--muted)':''}">${esc(c.t)}</span></label>
      <span style="white-space:nowrap"><button class="link" data-ced="${i}" style="color:var(--patro)" aria-label="Editar ${esc(c.t)}">Editar</button><button class="link" data-cdel="${i}" aria-label="Excluir ${esc(c.t)}">Excluir</button></span></li>`;
  return `<div class="panel" id="pcontra"><h3>Contrapartidas <span class="who" style="font-family:var(--font-body);font-weight:400">· ${feitas} de ${C.length} feitas</span></h3>
    ${C.length?`<ul class="list">${C.map(li).join('')}</ul>`:'<p class="note" style="margin-top:0">Nenhuma contrapartida ainda. Adicione o que a Dellamed recebe.</p>'}
    <form class="ctask-add" id="fContra" novalidate style="margin-top:12px"><input name="t" autocomplete="off" placeholder="Nova contrapartida, ex.: logo na camiseta" aria-label="Nova contrapartida"><button class="btn btn-sec" aria-label="Adicionar">${I.plus}</button></form></div>`}
function renderContra(p,foco){const el=document.getElementById('pcontra');if(!el)return;el.outerHTML=contraHTML(p);ligarContra(p);aplicarRO(document.getElementById('pcontra'));salvar(p);
  const k=document.getElementById('pcontra');if(foco)k.querySelector(foco)?.focus();
  const card=document.querySelector('#pcontra');if(card&&foco==='[data-cin]')card.querySelector('[data-cin]')?.select()}
function ligarContra(p){const P=document.getElementById('pcontra');if(!P)return;const C=p.contraItens;
  const salvarEd=i=>{const inp=P.querySelector(`[data-cin="${i}"]`),t=inp.value.trim();if(!t){inp.classList.add('erro');toast('Escreva a contrapartida ou use Excluir.');return}C[i].t=t;CONTRA_EDIT=null;renderContra(p)};
  P.querySelectorAll('[data-cchk]').forEach(c=>c.onchange=()=>{C[+c.dataset.cchk].feito=c.checked;renderContra(p)});
  P.querySelectorAll('[data-ced]').forEach(b=>b.onclick=()=>{CONTRA_EDIT=p.id+'|'+b.dataset.ced;renderContra(p,'[data-cin]')});
  P.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{C.splice(+b.dataset.cdel,1);CONTRA_EDIT=null;renderContra(p)});
  P.querySelectorAll('[data-cok]').forEach(b=>b.onclick=()=>salvarEd(+b.dataset.cok));
  P.querySelectorAll('[data-ccanc]').forEach(b=>b.onclick=()=>{CONTRA_EDIT=null;renderContra(p)});
  P.querySelectorAll('[data-cin]').forEach(inp=>inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();salvarEd(+inp.dataset.cin)}
    else if(ev.key==='Escape'){ev.stopPropagation();CONTRA_EDIT=null;renderContra(p)}}));
  P.querySelector('#fContra').onsubmit=ev=>{ev.preventDefault();const t=ev.target.t.value.trim();if(!t){ev.target.t.focus();return}C.push({t,feito:false});renderContra(p,'#fContra input')}}
function patHead(p){const ev=pd(p);return `<span class="tipo patro">Patrocínio · ${P_TIPOS[p.tipo]||''}</span>${p.ano}${p.resp?' · '+esc(p.resp):''}${ev.inicio?' · evento '+esc(dataTxt(ev)):''}${ev.inicio&&p.evLocal?' · '+esc(p.evLocal):''}`}
function patKpiInner(p){const t=total(p),v=+p.valor||0,saldo=v-t,temOrc=p.abas.includes('orcamento');
  return `<div class="kpi"><small>Verba</small><strong class="num">${brl(v)}</strong><div class="sub"><button class="link" style="color:var(--patro);padding:0" data-editpat>Editar verba</button></div></div>
  <div class="kpi"><small>Previsto</small><strong class="num">${temOrc?brl(t):'—'}</strong><div class="sub">${temOrc?`${p.itens.length} ${p.itens.length===1?'item':'itens'} · <button class="link" style="color:var(--patro);padding:0" data-gopat="orcamento">ver orçamento</button>`:'Adicione a aba Geral'}</div></div>
  <div class="kpi ${temOrc&&saldo<0?'alert':''}"><small>${temOrc&&saldo<0?'Acima da verba':'Saldo'}</small><strong class="num">${temOrc?brl(Math.abs(saldo)):'—'}</strong><div class="sub">verba − previsto</div></div>
  <div class="kpi"><small>Status</small><strong>${P_STATUS[p.status]||''}</strong><div class="sub">${P_TIPOS[p.tipo]||''}</div></div>`}
function ligarPatKpi(p){document.querySelectorAll('[data-editpat]').forEach(b=>b.onclick=()=>abrirPatro(p,false,'[name=valor]'));
  document.querySelectorAll('[data-gopat]').forEach(b=>b.onclick=()=>{location.hash=p.id+'--'+b.dataset.gopat})}
function patEvento(p){
  const dt=(k,v)=>`<input type="text" class="data" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="dd/mm/aaaa" data-pe="${k}" value="${isoBR(v)}">`;
  return `<div class="panel"><h3>Evento</h3>
    <div class="form" style="margin-top:0"><label class="f">Data${dt('evIni',p.evIni)}</label><label class="f">Até (se durar mais de um dia)${dt('evFim',p.evFim&&p.evFim!==p.evIni?p.evFim:'')}</label>
      <label class="f" style="flex:2">Local<input data-pe="evLocal" value="${esc(p.evLocal||'')}"></label></div>
    <div class="form"><label class="f">Informações do evento<textarea data-pe="evDesc" rows="5" placeholder="Programação, contato da organização, o que levar…">${esc(p.evDesc||'')}</textarea></label></div>
    <p class="note">Com a data preenchida, o patrocínio aparece no calendário nesse dia (ou nesses dias).</p></div>${rmBtn('evento')}`}
function patrocinio(id,aba){
  const p=PATROS.find(x=>x.id===id);
  if(!p){if(!carregado||!patCarregado){document.getElementById('app').innerHTML='<main class="wrap"><p class="empty" role="status">'+(erroCarga||'Carregando patrocínio…')+'</p></main>';return}location.hash='';return}
  aba=(aba==='checklist'||(p.abas.includes(aba)&&P_MODULOS[aba]))?aba:'checklist';
  const ev=pd(p);
  document.getElementById('app').innerHTML=`
  <header class="top patro-on"><div class="wrap">
    ${topoLogo(26)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;justify-content:space-between"><button class="back" id="voltar">${I.back} Voltar</button>
      <span style="display:flex;gap:8px;flex-wrap:wrap">${window.Nuvem&&Nuvem.pode('admin')?`<a class="back" style="text-decoration:none" href="admin.html#logs=patrocinios/${encodeURIComponent(p.id)}">${I.hist} Histórico</a>`:''}<button class="back" id="editPat">${I.edit} Editar patrocínio</button></span></div>
    <h1><b>${esc(p.nome)}</b></h1>
    <p id="phead">${patHead(p)}</p>
    <p class="quem" id="quem"></p>
  </div></header>
  <main class="wrap">
    <div class="kpis patro" id="pkpis" style="margin-top:24px">${patKpiInner(p)}</div>
    <div class="panel" id="pprev" ${p.abas.includes('orcamento')&&p.itens.length?'':'hidden'}><h3>Previsto x realizado por segmento</h3>${prevReal(p)}</div>
    ${contraHTML(p)}
    <div class="tabs-wrap">
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" aria-selected="${aba==='checklist'}" data-t="checklist">Checklist</button>
        ${p.abas.filter(k=>P_MODULOS[k]).map(k=>`<button class="tab" role="tab" aria-selected="${k===aba}" data-t="${k}">${P_MODULOS[k].nome}</button>`).join('')}
      </div>
      <div class="addtab"><button class="addbtn" id="addtab" aria-expanded="false" aria-haspopup="true">${I.plus} Adicionar aba</button></div>
    </div>
    <section role="tabpanel" id="painel">${VIEWS[aba](p)}${aba!=='checklist'&&aba!=='evento'?rmBtn(aba):''}</section>
    <footer>Saúde e bem-estar para todos.</footer>
  </main>`;
  document.getElementById('voltar').onclick=()=>{location.hash=''};
  document.querySelectorAll('.tab[data-t]').forEach(b=>b.onclick=()=>{location.hash=p.id+'--'+b.dataset.t});
  const add=document.getElementById('addtab');add.onclick=ev=>{ev.stopPropagation();abrirMenu(p,add,P_MODULOS)};
  document.getElementById('editPat').onclick=()=>abrirPatro(p);
  ligarPatKpi(p);ligarContra(p);ligar(p,aba);mostrarQuem(p);aplicarRO();
}
function novoPatro(){abrirPatro(prepP('pt-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),{ano}),true)}
function abrirPatro(p,novo,foco){
  document.getElementById('sheetT').textContent=novo?'Novo patrocínio':'Editar patrocínio';
  const opt=(o,v)=>Object.entries(o).map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t}</option>`).join('');
  document.getElementById('sheetBody').innerHTML=`<form class="panel" id="fPat" novalidate>
    <div class="form" style="margin-top:0"><label class="f" style="flex:2">Nome<input name="nome" value="${esc(p.nome)}" placeholder="Ex.: clube, corrida, congresso"></label>
      <label class="f">Responsável<input name="resp" data-sug="resp" autocomplete="off" value="${esc(p.resp||'')}"></label></div>
    <div class="form"><label class="f">Tipo<select name="tipo">${opt(P_TIPOS,p.tipo)}</select></label>
      <label class="f">Status<select name="status">${opt(P_STATUS,p.status)}</select></label>
      <label class="f">Verba (R$)<input type="text" class="brl" inputmode="numeric" autocomplete="off" name="valor" value="${fmtBR(p.valor)}" placeholder="0,00"></label>
      <label class="f" style="flex:0 1 120px">Ano<input type="number" name="ano" value="${p.ano}" min="2020" max="2100"></label></div>
    <div class="form"><label class="f">Anotações<textarea name="notas" rows="3">${esc(p.notas||'')}</textarea></label></div>
    <p class="note">A verba é o valor aprovado para o patrocínio. O previsto vem da aba Geral, e o saldo é verba menos previsto. Contrapartidas são marcadas na página do patrocínio, e data e local do evento ficam na aba Evento.</p>
    <p class="note" id="patErr" role="alert" style="color:var(--red)"></p>
    <div class="form"><button class="btn btn-primary" type="submit" style="background:var(--patro)">${novo?'Criar patrocínio':'Salvar alterações'}</button><button class="btn btn-sec" type="button" id="cancPat">Cancelar</button>
      ${novo?'':'<span class="spacer"></span><button class="btn btn-sec" type="button" id="delPat" style="border-color:var(--red);color:var(--red)">Excluir patrocínio</button>'}</div>
  </form>`;
  const f=document.getElementById('fPat');
  document.getElementById('cancPat').onclick=fecharRes;
  f.onsubmit=ev=>{ev.preventDefault();
    if(!f.nome.value.trim()){document.getElementById('patErr').textContent='O patrocínio precisa de um nome.';f.nome.focus();return}
    Object.assign(p,{nome:f.nome.value.trim(),resp:f.resp.value.trim(),tipo:f.tipo.value,status:f.status.value,valor:parseBR(f.valor.value)||0,
      ano:+f.ano.value||p.ano,notas:f.notas.value.trim()});
    if(novo)PATROS.push(p);ano=p.ano;salvar(p,true);fecharRes();
    if(novo)location.hash=p.id;else rota(true);toast(novo?'Patrocínio criado.':'Patrocínio atualizado.')};
  const del=document.getElementById('delPat');
  if(del)del.onclick=async()=>{if(del.dataset.ok!=='1'){del.dataset.ok='1';del.textContent='Clique de novo para excluir';return}
    try{await DB.collection('patrocinios').doc(p.id).delete();PATROS=PATROS.filter(x=>x.id!==p.id);fecharRes();location.hash='';toast('Patrocínio excluído.')}
    catch(_){toast('Não deu para excluir agora. Tente de novo.')}};
  mostrarSheet(foco);aplicarRO(document.getElementById('sheetBody'));
}

// ---------- salvamento ----------
const FILA={}, ULTIMO={}, ESCRITO={}; // ESCRITO: hora da última gravação feita por esta tela, por documento
function setSync(t,cls=''){const el=document.getElementById('sync');if(!el)return;el.textContent=t;el.className='sync '+cls;el.hidden=!t}
function pendente(id){const f=FILA[id];return !!(f&&(f.timer||f.writing))}
function salvar(e,ja){if(!DB||podeEditar===false||!(EVENTOS.includes(e)||PATROS.includes(e))&&!ja)return;
  const f=FILA[e.id]=FILA[e.id]||{};clearTimeout(f.timer);
  f.timer=setTimeout(()=>{f.timer=null;escrever(e)},ja?0:700);}
async function escrever(e){const f=FILA[e.id];if(f.writing){f.again=true;return}
  const corpo=toDb(e);const sem=JSON.stringify({...corpo,atualizadoEm:0,atualizadoPor:0});
  if(ULTIMO[e.id]===sem)return;
  corpo.atualizadoEm=new Date().toISOString();if(MEU_ID)corpo.atualizadoPor=MEU_ID;ESCRITO[e.id]=corpo.atualizadoEm;
  f.writing=true;setSync('Salvando…','on');
  try{await DB.collection(e._col||'eventos').doc(e.id).set(corpo);ULTIMO[e.id]=sem;e.atualizadoEm=corpo.atualizadoEm;e.atualizadoPor=corpo.atualizadoPor;setSync('Salvo','ok')}
  catch(err){
    if(err&&err.code==='permission-denied'){podeEditar=false;aplicarRO();setSync('Sem permissão para editar. Fale com um administrador.','ro')}
    else if(err&&err.code==='quota_exceeded')setSync('Limite diário do banco atingido: alteração não salva','err');
    else{setSync('Não salvo. Verifique a conexão','err');await new Promise(r=>setTimeout(r,1500+Math.random()*1000));f.again=true}}
  f.writing=false;if(f.again){f.again=false;escrever(e)}}
addEventListener('beforeunload',ev=>{if(Object.keys(FILA).some(pendente)){ev.preventDefault();ev.returnValue=''}});

// ---------- leitura em tempo real ----------
let precisaRender=false;
// apertando: botão do mouse ou dedo pressionado. Sem isso, um dado que chega enquanto a pessoa digita redesenha a tela
// no meio do clique em "Adicionar": o clique se perde e o texto some.
let apertando=false;
function emCampo(){const a=document.activeElement,sh=document.getElementById('sheet');return apertando||!!(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))||!!(sh&&!sh.hidden)||!!document.getElementById('menu')}
const renderAdiado=()=>setTimeout(()=>{if(precisaRender&&!emCampo()){precisaRender=false;rota(true)}},80);
document.addEventListener('focusout',renderAdiado);
document.addEventListener('pointerdown',()=>{apertando=true},true);
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>{apertando=false;renderAdiado()},true));
function velho(d){const w=ESCRITO[d.id];if(!w||Date.now()-Date.parse(w)>15000)return false;const a=(d.data()||{}).atualizadoEm||'';return a<w}
function aplicarSnapPat(snap){const ids=new Set();
  snap.docs.forEach(d=>{ids.add(d.id);if(pendente(d.id)||velho(d))return;const novo=prepP(d.id,d.data());
    const sem=JSON.stringify({...toDb(novo),atualizadoEm:0,atualizadoPor:0});const ex=PATROS.find(x=>x.id===d.id);
    if(ex){if(ULTIMO[d.id]===sem&&JSON.stringify({...toDb(ex),atualizadoEm:0,atualizadoPor:0})===sem)return;
      const seg=ex.segAtivo;Object.keys(ex).forEach(k=>delete ex[k]);Object.assign(ex,novo);ex.segAtivo=seg}
    else PATROS.push(novo);
    ULTIMO[d.id]=sem});
  PATROS=PATROS.filter(x=>ids.has(x.id)||pendente(x.id));patCarregado=true;
  if(emCampo())precisaRender=true;else rota(true)}
function aplicarSnapshot(snap){
  const ids=new Set();
  snap.docs.forEach(d=>{ids.add(d.id);if(pendente(d.id)||velho(d))return;const novo=fromDb(d.id,d.data());
    const sem=JSON.stringify({...toDb(novo),atualizadoEm:0,atualizadoPor:0});
    const ex=EVENTOS.find(x=>x.id===d.id);
    if(ex){if(ULTIMO[d.id]===sem&&JSON.stringify({...toDb(ex),atualizadoEm:0,atualizadoPor:0})===sem)return;
      const seg=ex.segAtivo;Object.keys(ex).forEach(k=>delete ex[k]);Object.assign(ex,novo);ex.segAtivo=seg}
    else EVENTOS.push(novo);
    ULTIMO[d.id]=sem});
  EVENTOS=EVENTOS.filter(x=>ids.has(x.id)||pendente(x.id));
  if(!snap.metadata.fromCache||snap.docs.length){carregado=true;erroCarga=''}
  if(emCampo())precisaRender=true;else rota(true);
}
Nuvem.normalizar=(col,d)=>{const sem=x=>{delete x.atualizadoEm;delete x.atualizadoPor;return x};
  if(col==='eventos')return sem(toDb(fromDb('x',d)));if(col==='patrocinios')return sem(toDb(prepP('x',JSON.parse(JSON.stringify(d)))));return d};
async function iniciar(){
  const ses=await Nuvem.sessao(); // tela de entrada até a pessoa entrar com Google e estar liberada
  DB=Nuvem.DB;USER=ses.usuario;MEU_ID=(ses.usuario.email||'').toLowerCase();
  souDono=Nuvem.pode('admin');podeEditar=Nuvem.pode('editar');
  rota();
  const t=setTimeout(()=>{if(!carregado){erroCarga='Os dados ainda não chegaram. Confira a conexão; a página continua tentando.';rota(true)}},10000);
  document.addEventListener('nuvem:usuarios',()=>mostrarQuemAtual());
  if(!DB){clearTimeout(t);carregado=true;patCarregado=true;erroCarga='';podeEditar=false;
    setSync('Sem banco: nada é salvo nesta visualização','err');rota(true);return}
  if(podeEditar===false)setSync('Somente leitura','ro');
  DB.doc('geral/tarefas').onSnapshot(d=>{if(GERAL_PEND)return;const it=(d.exists&&d.data().itens)||[];const j=JSON.stringify(it);if(j===JSON.stringify(GERAL.tarefas))return;
    if(!it.length||podeEditar===false)return;
    // A lista geral foi substituída pela lista dentro de cada card: move o que tinha evento para o checklist dele.
    const fica=[];it.forEach(t=>{const ev=EVENTOS.find(x=>x.id===t.ev);if(ev){if(!ev.tarefas.some(x=>x[0]===t.t)){ev.tarefas.push([t.t,'',!!t.feito,t.resp||'','']);salvar(ev)}}else fica.push(t)});
    GERAL.tarefas=fica;GERAL_ULT='';salvarGeral();if(!location.hash.slice(1)&&!emCampo())home()},()=>{});
  DB.collection('patrocinios').onSnapshot(aplicarSnapPat,()=>{patCarregado=true;rota(true)});
  DB.collection('eventos').onSnapshot(snap=>{if(!snap.metadata.fromCache)clearTimeout(t);aplicarSnapshot(snap)},
    err=>{clearTimeout(t);carregado=true;erroCarga=err&&err.code==='revoked'?'Sem acesso a estes dados. Peça a um administrador para conferir o seu cadastro.':'Não foi possível carregar os eventos agora. Recarregue a página em instantes.';rota(true)});
}

// ---------- backup em Excel ----------
let DL=null;
function carregarXLSX(){return window.XLSX?Promise.resolve():new Promise((ok,err)=>{const sc=document.createElement('script');
  sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';sc.onload=ok;sc.onerror=err;document.head.appendChild(sc)})}
function ligarXlsx(e){const b=document.getElementById('xlsx');if(!b)return;b.hidden=false;b.onclick=()=>baixarExcel(e,b)}
function salvarArquivo(nome,buf,tipo){const url=URL.createObjectURL(new Blob([buf],{type:tipo}));const a=document.createElement('a');a.href=url;a.download=nome;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500)}
function planilha(e){
  const t=total(e),hoje=new Date();const wb=XLSX.utils.book_new();
  const add=(nome,linhas,larg)=>{const ws=XLSX.utils.aoa_to_sheet(linhas);if(larg)ws['!cols']=larg.map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws,nome)};
  add('Resumo',[['Evento',e.nome],['Complemento',e.sub||''],['Tipo',TIPOS[e.tipo]||''],['Fase',FASE_TAG[e.fase]||''],['Data',dataTxt(e)],['Local',e.local||''],
    ['Verba',e.verba??''],['Previsto (soma do orçamento)',t],['Realizado',realizado(e)],['Comprometido (realizado ou previsto)',comprometido(e)],['Ainda temos pra gastar',e.verba!=null?e.verba-comprometido(e):''],['Ata no Canva',e.ata||''],
    ['Última alteração',e.atualizadoEm?new Date(e.atualizadoEm).toLocaleString('pt-BR'):''],['Backup gerado em',hoje.toLocaleString('pt-BR')]],[30,60]);
  {const m={};e.itens.forEach(i=>{const g=m[i[0]]=m[i[0]]||[0,0];g[0]+=i[4];g[1]+=i[8]??0});
    add('Por segmento',[['Segmento','Previsto (R$)','Realizado (R$)'],...Object.entries(m).sort((a,b)=>b[1][0]-a[1][0]).map(([k,g])=>[k,g[0],g[1]]),[],['Total',t,e.itens.reduce((s,i)=>s+(i[8]??0),0)]],[28,16,16])}
  add('Geral',[['Segmento','Item','Descrição','Fornecedor','Requisição','Status','Previsto (R$)','Realizado (R$)'],...porSeg(e.itens).map(([i])=>[i[0],i[1],i[2],i[3],i[7]||'',i[5],i[4],i[8]??'']),[],['','','','','','Total',t,e.itens.reduce((s,i)=>s+(i[8]??0),0)]],[20,26,40,22,14,12,14,14]);
  e.cot.forEach(migrarCot);add('Cotações',[['Segmento','Fornecedor','Opção','Qtd. por dia','Dias','Valor unitário (R$)','Valor total (R$)','Usada no orçamento'],...e.cot.flatMap(c=>c.forns.flatMap(f=>f.ops.map(o=>[c.seg,f.nome,o.desc||'',+o.qtd||0,+o.dias||0,+o.unit||0,opTotal(o),o.esc?'Sim':''])))],[20,22,40,12,8,16,16,16]);
  add('Decisões',[['Segmento','Tipo','Texto'],...e.cot.flatMap(c=>c.notas.map(n=>[c.seg,n.tipo==='decisao'?'Decisão':'Anotação',n.texto]))],[20,12,90]);
  add('Checklist',[['Feito','Tarefa','Responsável','Prazo','Observação'],...e.tarefas.map(x=>[x[2]?'Sim':'',x[0],x[3],isoBR(x[4]),x[1]])],[8,50,22,12,40]);
  if(e.equipe.length)add('Equipe',[['Nome','Função','Credencial'],...e.equipe.map(p=>[p.nome,p.funcao||'',CRED[credKey(p)]])],[30,24,12]);
  if(e.trechos.length)add('Voos',[['Trecho','Cidade','Nome','Data','Saída','Chegada','Cia','Voo','Localizador','Valor (R$)'],
    ...e.trechos.map(v=>[v.dir==='ida'?'Ida':'Volta',v.cidade,v.nome,dataBR(v.data)+(v.data?'/'+v.data.slice(0,4):''),v.saida,v.chegada,v.cia,v.voo,v.loc,+v.valor||0])],[8,16,26,12,8,8,8,8,12,12]);
  if(e.quartos.length){const H=hoteisDe(e);add('Hospedagem',[['Hotel','Diária single','Diária duplo'],...H.map(h=>[h.nome||'',h.single||'',h.duplo||'']),[],
    ['Hotel','Entrada','Saída','Noites','Tipo','Hóspede 1','Hóspede 2','Valor (R$)'],
    ...e.quartos.map(q=>[(H[q.hotel]||{}).nome||'',isoBR(q.in),isoBR(q.out),noites(q),q.tipo==='duplo'?'Duplo':'Single',q.ocup[0]||'',q.ocup[1]||'',valQuarto(e,q)])],[26,12,12,8,8,26,26,12])}
  const r=e.res;add('Resultados',e.tipo==='corrida'?[['Inscritos',r.inscritos??''],['Concluintes',r.concluintes??''],['Nota média',r.nota??''],['Custo por inscrito (R$)',r.inscritos&&t?+(t/r.inscritos).toFixed(2):'']]:e.tipo==='interno'?[['Participantes',r.participantes??''],['Nota média',r.nota??''],['Respostas da avaliação',r.respostas??'']]
    :[['Visitantes',r.visitantes??''],['Leads captados',r.leads??''],['Leads qualificados',r.qualificados??''],['Pedidos fechados',r.pedidos??''],['Valor fechado (R$)',r.faturamento??''],
      ['Custo por lead (R$)',r.leads&&t?+(t/r.leads).toFixed(2):''],['Retorno sobre o investido',r.faturamento&&t?+(r.faturamento/t).toFixed(2):'']],[28,16]);
  if(e.notas)add('Anotações',[[e.notas]],[100]);
  return XLSX.write(wb,{bookType:'xlsx',type:'array'});
}
async function baixarExcel(e,b){const txt=b.innerHTML;b.disabled=true;b.textContent='Gerando…';
  try{await carregarXLSX();const buf=planilha(e);const d=new Date();
    const nome=`Backup ${e.nome.replace(/[\\/:*?"<>|]/g,'')} ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.xlsx`;
    salvarArquivo(nome,buf,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Excel baixado.')}
  catch(err){toast('Não deu para gerar o Excel. Confira a conexão e tente de novo.')}
  b.disabled=false;b.innerHTML=txt}

// ---------- somente leitura ----------
function aplicarRO(root){if(podeEditar!==false)return;document.body.classList.add('ro');
  (root||document).querySelectorAll('#app input, #app select, #app textarea, #sheetBody input, #sheetBody select, #sheetBody textarea').forEach(el=>{if(!el.hasAttribute('data-livre'))el.disabled=true})}
let QUEM_EV=null;
function mostrarQuem(e){QUEM_EV=e;const el=document.getElementById('quem');if(!el||!e.atualizadoEm)return;
  const d=new Date(e.atualizadoEm);const quando=d.toLocaleDateString('pt-BR')+' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const nome=e.atualizadoPor&&String(e.atualizadoPor).includes('@')?Nuvem.nomeDe(e.atualizadoPor):'';
  el.textContent='Última alteração '+(nome?'por '+nome+' ':'')+'em '+quando}
function mostrarQuemAtual(){if(QUEM_EV&&document.getElementById('quem'))mostrarQuem(QUEM_EV)}

function rota(manter){const y=scrollY;const [id,aba]=location.hash.slice(1).split('--');const ev=EVENTOS.find(x=>x.id===id)||PATROS.find(x=>x.id===id);if(ev)ano=ev.ano;id?(id.startsWith('pt-')?patrocinio(id,aba):evento(id,aba)):home();window.scrollTo(0,manter===true?y:0)}
document.getElementById('fechaRes').onclick=fecharRes;document.getElementById('backdrop').onclick=fecharRes;
addEventListener('hashchange',()=>{fecharRes();rota()});iniciar();

