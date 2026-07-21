const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

const STATUS_LABELS = {
  pending: { text:'Aguardando confirmação da loja', class:'st-pending' },
  accepted: { text:'Aceito pela loja', class:'st-accepted' },
  preparing: { text:'Em preparo', class:'st-preparing' },
  on_the_way: { text:'A caminho', class:'st-on_the_way' },
  delivered: { text:'Entregue', class:'st-delivered' },
  cancelled: { text:'Cancelado', class:'st-cancelled' },
};

const authView = document.getElementById('auth-view');
const accountView = document.getElementById('account-view');
const logoutBtn = document.getElementById('logout-btn');
const authMsg = document.getElementById('auth-msg');

function showAuthMsg(text, type){
  authMsg.textContent = text;
  authMsg.className = 'app-msg show ' + type;
}

// ---------- Tabs login/cadastro ----------
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active'); tabSignup.classList.remove('active');
  loginForm.style.display = ''; signupForm.style.display = 'none';
  authMsg.classList.remove('show');
});
tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active'); tabLogin.classList.remove('active');
  signupForm.style.display = ''; loginForm.style.display = 'none';
  authMsg.classList.remove('show');
});

// ---------- Login ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(error){ showAuthMsg('E-mail ou senha incorretos.', 'error'); return; }
  onLoggedIn();
});

// ---------- Cadastro ----------
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name, phone } }
  });
  if(error){ showAuthMsg('Não foi possível criar a conta: ' + error.message, 'error'); return; }
  onLoggedIn();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// ---------- Ao logar ----------
async function onLoggedIn(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;

  authView.style.display = 'none';
  accountView.style.display = '';
  logoutBtn.style.display = '';

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
  document.getElementById('welcome-title').textContent = profile?.name ? `Olá, ${profile.name.split(' ')[0]}!` : 'Olá!';

  loadAddresses();
  loadOrders();

  // se veio de um checkout pendente, volta pro cardápio
  if(sessionStorage.getItem('redirect-after-login') === '1'){
    sessionStorage.removeItem('redirect-after-login');
    window.location.href = 'index.html?checkout=1';
  }
}

// ---------- Endereços ----------
const addressesList = document.getElementById('addresses-list');
const addAddressBtn = document.getElementById('add-address-btn');
const addressForm = document.getElementById('address-form');

addAddressBtn.addEventListener('click', () => {
  addressForm.style.display = addressForm.style.display === 'none' ? '' : 'none';
});

async function loadAddresses(){
  const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending:false });
  addressesList.innerHTML = '';
  if(error || !data || data.length === 0){
    addressesList.innerHTML = '<p class="empty-state">Nenhum endereço salvo ainda.</p>';
    return;
  }
  data.forEach(addr => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-main">
        <div class="list-card-title">${addr.label || 'Endereço'}</div>
        <div class="list-card-sub">${addr.address}${addr.reference ? ' — ' + addr.reference : ''}</div>
      </div>
      <div class="list-card-actions">
        <button type="button" class="icon-btn" data-remove="${addr.id}" aria-label="Remover">✕</button>
      </div>`;
    addressesList.appendChild(card);
  });
  addressesList.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('addresses').delete().eq('id', btn.dataset.remove);
      loadAddresses();
    });
  });
}

addressForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  const label = document.getElementById('addr-label').value.trim();
  const address = document.getElementById('addr-address').value.trim();
  const reference = document.getElementById('addr-reference').value.trim();

  const { error } = await supabase.from('addresses').insert({
    customer_id: user.id, label, address, reference
  });
  if(!error){
    addressForm.reset();
    addressForm.style.display = 'none';
    loadAddresses();
  }
});

// ---------- Helper: extrai sabor/tamanho, com fallback pro texto salvo ----------
function getCupFlavorSize(cup){
  if (cup.flavor && cup.size) return { flavor: cup.flavor, size: cup.size };
  const first = (cup.parts && cup.parts[0]) || '';
  const [flavor, size] = first.split(' — ').map(s => (s || '').trim());
  return { flavor: flavor || null, size: size || null };
}

// ---------- Histórico de pedidos ----------
const ordersList = document.getElementById('orders-list');

async function loadOrders(){
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending:false });
  ordersList.innerHTML = '';
  if(error || !data || data.length === 0){
    ordersList.innerHTML = '<p class="empty-state">Você ainda não fez nenhum pedido.</p>';
    return;
  }
  data.forEach(order => {
  const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
  const statusText = (order.status === 'on_the_way' && order.delivery_type === 'Retirada') ? 'Pronto para retirar' : st.text;
  const date = new Date(order.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  const cupsText = order.cups.map(c => c.parts.join(', ')).join(' • ');
  const canRepeat = order.cups.every(c => {
  const { flavor, size } = getCupFlavorSize(c);
  return !!(flavor && size);
});

  const card = document.createElement('div');
  card.className = 'list-card';
  card.innerHTML = `
    <div class="list-card-main">
      <div class="list-card-title">${date} — ${fmt(order.total)}</div>
      <div class="list-card-sub">${cupsText}</div>
      <div style="margin-top:8px;"><span class="status-pill ${st.class}">${statusText}</span></div>
    </div>
    ${canRepeat ? `<div class="list-card-actions"><button type="button" class="app-btn-outline" data-repeat="${order.id}" style="padding:8px 14px; font-size:0.85rem;">🔁 Repetir</button></div>` : ''}
  `;
  if(['pending','accepted','preparing','on_the_way'].includes(order.status)){
    card.querySelector('.list-card-main').style.cursor = 'pointer';
    card.querySelector('.list-card-main').addEventListener('click', () => window.location.href = `pedido.html?id=${order.id}`);
  }
  const repeatBtn = card.querySelector('[data-repeat]');
  if(repeatBtn){
    repeatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sessionStorage.setItem('repeat-order-cups', JSON.stringify(order.cups));
      window.location.href = 'index.html';
    });
  }
  ordersList.appendChild(card);
});
}

// ---------- Estado inicial ----------
(async function init(){
  const { data: { user } } = await supabase.auth.getUser();
  if(user){ onLoggedIn(); }
})();