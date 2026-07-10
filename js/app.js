import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const teamSeed = [
  {nome:'ALEXANDRE MODESTO DE OLIVEIRA',matricula:'005576',funcao:'OPERADOR USINA ESP',categoria:'Especialista',status:'Ativo'},
  {nome:'ALVARO SOUZA DA SILVA',matricula:'005313',funcao:'OPERADOR USINA PL',categoria:'Operador Pleno',status:'Ativo'},
  {nome:'DAVID FERNANDES DA SILVA',matricula:'710693',funcao:'OPERADOR USINA JR',categoria:'Operador Júnior',status:'Ativo'},
  {nome:'FRANCISCO HELTON MENDES VASCONCELOS',matricula:'004349',funcao:'OPERADOR USINA SR',categoria:'Operador Sênior',status:'Ativo'},
  {nome:'IZAQUIEL SILVA MAGALHAES',matricula:'709285',funcao:'OPERADOR USINA JR',categoria:'Operador Júnior',status:'Ativo'},
  {nome:'JARDIEL LOPES RODRIGUES',matricula:'006319',funcao:'OPERADOR USINA PL',categoria:'Operador Pleno',status:'Ativo'},
  {nome:'RAIMUNDO SOARES RAMOS NETO',matricula:'005413',funcao:'OPERADOR USINA SR',categoria:'Operador Sênior',status:'Ativo'}
];

const state = { user:null, profile:null, team:[], unsubscribeTeam:null };
const $ = id => document.getElementById(id);
const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item')];

function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800); }
function initials(name='Usuário'){ return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function normalizeRole(role='operador'){ const r=role.toLowerCase(); return ['supervisor','especialista','operador'].includes(r)?r:'operador'; }
function roleLabel(role){ return ({supervisor:'Supervisor',especialista:'Especialista',operador:'Operador'})[role]||'Operador'; }
function formatAuthError(code){
  const map={
    'auth/invalid-credential':'E-mail ou senha inválidos.',
    'auth/invalid-email':'Informe um e-mail válido.',
    'auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed':'Falha de conexão. Verifique a internet.'
  };
  return map[code]||'Não foi possível entrar. Confira os dados e tente novamente.';
}

async function login(){
  const email=$('email').value.trim(); const password=$('password').value;
  if(!email||!password){$('loginMessage').textContent='Preencha o e-mail e a senha.';return;}
  $('loginButton').disabled=true;$('loginButton').textContent='Entrando...';$('loginMessage').textContent='';
  try{ await signInWithEmailAndPassword(auth,email,password); }
  catch(err){ $('loginMessage').textContent=formatAuthError(err.code); }
  finally{$('loginButton').disabled=false;$('loginButton').textContent='Acessar portal';}
}

async function getProfile(user){
  const snap=await getDoc(doc(db,'usuarios',user.uid));
  if(!snap.exists()) return {nome:user.displayName||user.email.split('@')[0],email:user.email,perfil:'operador',colaboradorId:null,pendenteConfiguracao:true};
  return {...snap.data(),perfil:normalizeRole(snap.data().perfil)};
}

function applyProfile(){
  const p=state.profile; const name=p.nome||state.user.email;
  $('userName').textContent=name;$('userRole').textContent=roleLabel(p.perfil);$('userInitials').textContent=initials(name);
  $('sidebarUser').innerHTML=`<strong>${name}</strong><span>${roleLabel(p.perfil)}</span>`;
  document.querySelectorAll('.supervisor-only').forEach(el=>el.classList.toggle('hidden',p.perfil!=='supervisor'));
  $('welcomeTitle').textContent=`Olá, ${name.split(' ')[0]}`;
  if(p.pendenteConfiguracao) toast('Seu perfil ainda não foi configurado no Firestore. Acesso padrão: Operador.');
}

function showApp(){ $('loading').classList.add('hidden');$('loginPage').classList.add('hidden');$('app').classList.remove('hidden');$('connectionBadge').textContent='Online';applyProfile();listenTeam();loadDashboardCounts(); }
function showLogin(){ $('loading').classList.add('hidden');$('app').classList.add('hidden');$('loginPage').classList.remove('hidden'); if(state.unsubscribeTeam) state.unsubscribeTeam(); }

function openView(id){
  views.forEach(v=>v.classList.toggle('active',v.id===id));navItems.forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  const titles={dashboard:['Dashboard','Visão geral da Equipe E'],equipe:['Equipe','Cadastro e composição da equipe'],folgas:['Folgas','Solicitações e aprovações'],banco:['Banco de horas','Saldos e importações do RH'],ferias:['Férias','Planejamento anual'],treinamentos:['Treinamentos','Capacitações e certificações']};
  $('pageTitle').textContent=titles[id][0];$('pageSubtitle').textContent=titles[id][1];$('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});
}

function renderTeam(filter=''){
  const term=filter.trim().toLowerCase();
  const list=state.team.filter(p=>[p.nome,p.matricula,p.funcao,p.categoria].some(v=>String(v||'').toLowerCase().includes(term)));
  $('teamTableBody').innerHTML=list.map(p=>`<tr><td><div class="person-cell"><span class="person-avatar">${initials(p.nome)}</span><strong>${p.nome}</strong></div></td><td>${p.matricula||'-'}</td><td>${p.funcao||'-'}</td><td><span class="role-pill">${p.categoria||'-'}</span></td><td><span class="active-pill">${p.status||'Ativo'}</span></td></tr>`).join('')||'<tr><td colspan="5">Nenhum colaborador encontrado.</td></tr>';
  $('teamCount').textContent=`${list.length} registro${list.length===1?'':'s'}`;$('metricEquipe').textContent=state.team.length;
  renderCategories();
}

function renderCategories(){
  const counts=state.team.reduce((acc,p)=>{acc[p.categoria]=(acc[p.categoria]||0)+1;return acc;},{}); const max=Math.max(1,...Object.values(counts));
  $('categoryList').innerHTML=Object.entries(counts).map(([name,count])=>`<div class="category-row"><span>${name}</span><div class="category-track"><span style="width:${count/max*100}%"></span></div><strong>${count}</strong></div>`).join('')||'<p class="muted">Cadastre a equipe para visualizar a distribuição.</p>';
}

function listenTeam(){
  if(state.unsubscribeTeam) state.unsubscribeTeam();
  state.unsubscribeTeam=onSnapshot(collection(db,'colaboradores'),snap=>{
    state.team=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.nome.localeCompare(b.nome));renderTeam($('teamSearch').value);
  },err=>{console.error(err);$('connectionBadge').textContent='Sem acesso ao banco';toast('Não foi possível consultar a equipe. Verifique as regras do Firestore.');});
}

async function seedTeam(){
  if(state.profile.perfil!=='supervisor') return;
  if(!confirm('Cadastrar os 7 colaboradores iniciais no Firestore?')) return;
  const batch=writeBatch(db);teamSeed.forEach(p=>batch.set(doc(db,'colaboradores',p.matricula),p,{merge:true}));
  await batch.commit();toast('Equipe inicial cadastrada com sucesso.');
}

async function loadDashboardCounts(){
  try{
    const pend=await getDocs(query(collection(db,'solicitacoes_folga'),where('status','==','Pendente')));$('metricFolgas').textContent=pend.size;
  }catch{$('metricFolgas').textContent='0';}
}

function setDate(){const now=new Date();$('todayDay').textContent=now.getDate();$('todayMonth').textContent=now.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');}

$('loginButton').addEventListener('click',login);$('password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('togglePassword').addEventListener('click',()=>{$('password').type=$('password').type==='password'?'text':'password';});
$('logoutButton').addEventListener('click',()=>signOut(auth));$('menuButton').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
navItems.forEach(item=>item.addEventListener('click',()=>openView(item.dataset.view)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.go)));
$('teamSearch').addEventListener('input',e=>renderTeam(e.target.value));$('seedTeamButton').addEventListener('click',()=>seedTeam().catch(e=>{console.error(e);toast('Falha ao cadastrar equipe. Verifique as permissões.');}));

setDate();
onAuthStateChanged(auth,async user=>{
  state.user=user;
  if(!user){state.profile=null;showLogin();return;}
  try{state.profile=await getProfile(user);showApp();}catch(err){console.error(err);await signOut(auth);$('loginMessage').textContent='Não foi possível carregar seu perfil. Verifique o Firestore.';showLogin();}
});
