const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

const STATUS_LABELS = {
  pending: { text:'Aguardando confirmação', class:'st-pending' },
  accepted: { text:'Aceito', class:'st-accepted' },
  preparing: { text:'Em preparo', class:'st-preparing' },
  on_the_way: { text:'A caminho', class:'st-on_the_way' },
  delivered: { text:'Entregue', class:'st-delivered' },
  cancelled: { text:'Cancelado', class:'st-cancelled' },
};
const NEXT_STATUS = { pending:'accepted', accepted:'preparing', preparing:'on_the_way', on_the_way:'delivered' };
const NEXT_LABEL = { pending:'✅ Aceitar pedido', accepted:'👩‍🍳 Iniciar preparo', preparing:'🛵 Saiu para entrega', on_the_way:'📦 Marcar como entregue' };

const loginView = document.getElementById('admin-login-view');
const panelView = document.getElementById('admin-panel-view');
const logoutBtn = document.getElementById('logout-btn');
const adminMsg = document.getElementById('admin-msg');

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(error){
    adminMsg.textContent = 'E-mail ou senha incorretos.';
    adminMsg.className = 'app-msg show error';
    return;
  }
  checkAdminAndInit();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.reload();
});

async function checkAdminAndInit(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;

  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if(error || !data){
    adminMsg.textContent = 'Essa conta não tem permissão de administrador.';
    adminMsg.className = 'app-msg show error';
    await supabase.auth.signOut();
    return;
  }

  loginView.style.display = 'none';
  panelView.style.display = '';
  logoutBtn.style.display = '';

  loadStoreStatus();
  loadStock();
  loadOrders('active');
  subscribeRealtime();
  tryReconnectPrinter();
}

// ---------- Abrir/fechar loja ----------
const storeSwitch = document.getElementById('store-open-switch');
const storeLabel = document.getElementById('store-toggle-label');

async function loadStoreStatus(){
  const { data } = await supabase.from('store_settings').select('is_open').eq('id', 1).single();
  applyStoreStatus(data?.is_open);
}
function applyStoreStatus(isOpen){
  storeSwitch.checked = !!isOpen;
  storeLabel.textContent = isOpen ? '🟢 Loja aberta' : '🔴 Loja fechada';
}
storeSwitch.addEventListener('change', async () => {
  const isOpen = storeSwitch.checked;
  applyStoreStatus(isOpen);
  await supabase.from('store_settings').update({ is_open: isOpen }).eq('id', 1);
});

// ---------- Estoque ----------
const stockSections = document.getElementById('stock-sections');

async function loadStock(){
  const [{ data: flavors }, { data: sizes }, { data: toppings }] = await Promise.all([
    supabase.from('flavors').select('*').order('sort_order'),
    supabase.from('sizes').select('*').order('sort_order'),
    supabase.from('toppings').select('*').order('category').order('sort_order'),
  ]);

  stockSections.innerHTML = '';
  renderStockGroup('Sabores', flavors || [], 'flavors');
  renderStockGroup('Tamanhos', sizes || [], 'sizes');

  const byCategory = {};
  (toppings || []).forEach(item => { (byCategory[item.category] ||= []).push(item); });
  Object.entries(byCategory).forEach(([category, items]) => renderStockGroup(category, items, 'toppings'));
}

function renderStockGroup(title, items, table){
  if(items.length === 0) return;
  const block = document.createElement('div');
  block.className = 'cat-block';
  block.innerHTML = `<div class="cat-title">${title}</div><div class="admin-grid"></div>`;
  const grid = block.querySelector('.admin-grid');
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'stock-item' + (item.available ? '' : ' unavailable');
    row.innerHTML = `
      <div>
        <div class="stock-item-name">${item.name}</div>
        ${item.price != null ? `<div class="stock-item-price">${fmt(item.price)}</div>` : ''}
      </div>
      <label class="switch">
        <input type="checkbox" ${item.available ? 'checked' : ''} data-id="${item.id}">
        <span class="switch-track"></span>
      </label>`;
    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', async () => {
      row.classList.toggle('unavailable', !checkbox.checked);
      await supabase.from(table).update({ available: checkbox.checked }).eq('id', item.id);
    });
    grid.appendChild(row);
  });
  stockSections.appendChild(block);
}

// ---------- Pedidos ----------
const ordersPanelList = document.getElementById('orders-panel-list');
let currentFilter = 'active';

document.querySelectorAll('#order-filter-tabs .app-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#order-filter-tabs .app-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    loadOrders(currentFilter);
  });
});

function showAdminModal({ message, withInput=false, placeholder='', confirmText='Confirmar' }){
  return new Promise(resolve => {
    const overlay = document.getElementById('admin-modal-overlay');
    const msgEl = document.getElementById('admin-modal-message');
    const input = document.getElementById('admin-modal-input');
    const confirmBtn = document.getElementById('admin-modal-confirm');
    const cancelBtn = document.getElementById('admin-modal-cancel');

    msgEl.textContent = message;
    input.classList.toggle('show', withInput);
    input.value = '';
    input.placeholder = placeholder;
    confirmBtn.textContent = confirmText;
	confirmBtn.className = confirmText === 'Excluir' ? 'btn-mini danger filled' : 'btn-mini danger';
    overlay.classList.add('show');

    function cleanup(result){
      overlay.classList.remove('show');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onConfirm(){ cleanup(withInput ? input.value.trim() : true); }
    function onCancel(){ cleanup(undefined); }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
  });
}

async function loadOrders(filter){
  let query = supabase.from('orders').select('*').order('created_at', { ascending:false });
  if(filter === 'active') query = query.in('status', ['pending','accepted','preparing','on_the_way']);
  else query = query.eq('status', filter);

  const { data, error } = await query;

  renderDailyTotals(filter === 'delivered' ? (data || []) : []);

  ordersPanelList.innerHTML = '';
  if(error || !data || data.length === 0){
    ordersPanelList.innerHTML = '<p class="empty-state">Nenhum pedido aqui.</p>';
    return;
  }
  data.forEach(order => renderOrderCard(order));
}

function renderDailyTotals(orders){
  const summaryEl = document.getElementById('daily-totals');
  if(!summaryEl) return;
  if(!orders || orders.length === 0){ summaryEl.innerHTML = ''; return; }

  const groups = {};
  orders.forEach(o => {
    const day = new Date(o.created_at).toLocaleDateString('pt-BR');
    if(!groups[day]) groups[day] = { total: 0, count: 0 };
    groups[day].total += Number(o.total);
    groups[day].count += 1;
  });

  const days = Object.keys(groups).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
  });

  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);

  summaryEl.innerHTML = `
    <div class="daily-totals-box">
      <div class="daily-totals-title">💰 Faturamento por dia</div>
      ${days.map(day => `
        <div class="daily-totals-row">
          <span class="daily-totals-date">${day}</span>
          <span class="daily-totals-count">${groups[day].count} pedido${groups[day].count > 1 ? 's' : ''}</span>
          <span class="daily-totals-value">${fmt(groups[day].total)}</span>
        </div>
      `).join('')}
      <div class="daily-totals-row daily-totals-grand">
        <span class="daily-totals-date">Total geral</span>
        <span class="daily-totals-count">${orders.length} pedidos</span>
        <span class="daily-totals-value">${fmt(grandTotal)}</span>
      </div>
    </div>
  `;
}

function renderOrderCard(order){
  const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
  const date = new Date(order.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  const cupsText = order.cups.map((c,i) => `Copo ${i+1}: ${c.parts.join(', ')}`).join('<br>');

  let addressLine = order.delivery_type === 'Delivery'
    ? `📍 ${order.address}${order.reference ? ' — ' + order.reference : ''}`
    : '🏬 Retirada no local';

  const card = document.createElement('div');
  card.className = 'order-card';
  card.dataset.orderId = order.id;
  card.innerHTML = `
    <div class="order-card-head">
      <div>
        <div class="order-card-name">${order.customer_name}</div>
        <div class="order-card-id">${date} · ${order.customer_phone ? `<a href="https://wa.me/55${order.customer_phone.replace(/\D/g,'')}" target="_blank">📞 ${order.customer_phone}</a>` : 'sem telefone'}</div>
      </div>
      <div class="order-card-head-right">
        <span class="status-pill ${st.class}">${st.text}</span>
        ${order.status === 'cancelled' ? `<button class="order-delete-btn" title="Excluir pedido">✕</button>` : ''}
      </div>
    </div>
    <div class="order-card-cups">${cupsText}</div>
    <div class="order-card-meta">
      ${addressLine}<br>
      💳 ${order.payment_method}${order.change_for ? ' — troco para R$ ' + order.change_for : ''}
      ${order.notes ? '<br>📝 ' + order.notes : ''}
    </div>
    <div class="order-card-head" style="margin-bottom:0;">
      <span class="order-card-total">${fmt(order.total)}</span>
      <div class="order-card-actions" id="actions-${order.id}"></div>
    </div>
  `;
  if(order.status === 'cancelled'){
    card.querySelector('.order-delete-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const ok = await showAdminModal({
    message: 'Excluir este pedido cancelado? Essa ação não pode ser desfeita.',
    confirmText: 'Excluir'
  });
  if(!ok) return;
  const { error } = await supabase.from('orders').delete().eq('id', order.id);
  if(error){ alert('Não foi possível excluir.'); return; }
  card.remove();
});
  }

  ordersPanelList.appendChild(card);
  renderOrderActions(order);
}

  function renderOrderActions(order){
  const wrap = document.getElementById(`actions-${order.id}`);
  if(!wrap) return;
  wrap.innerHTML = '';

  // NOVO: cobre pending -> accepted e accepted -> preparing
  if(NEXT_STATUS[order.status] && order.status !== 'preparing'){
    const btn = document.createElement('button');
    btn.className = 'btn-mini'; btn.textContent = NEXT_LABEL[order.status];
    btn.addEventListener('click', async () => {
      const wasPending = order.status === 'pending';
      await supabase.from('orders').update({ status: NEXT_STATUS[order.status] }).eq('id', order.id);
	  if(wasPending) printOrder(order);
      loadOrders(currentFilter);
    });
    wrap.appendChild(btn);
  }

  if(order.status === 'preparing'){
    // pede o tempo estimado antes de marcar "a caminho"
    const etaInput = document.createElement('input');
    etaInput.type = 'number'; etaInput.min = '5'; etaInput.placeholder = 'min';
    etaInput.className = 'eta-input'; etaInput.value = order.eta_minutes || 30;
    wrap.appendChild(etaInput);

    const btn = document.createElement('button');
    btn.className = 'btn-mini'; btn.textContent = NEXT_LABEL.preparing;
    btn.addEventListener('click', async () => {
      await supabase.from('orders').update({ status:'on_the_way', eta_minutes: parseInt(etaInput.value) || 30 }).eq('id', order.id);
      loadOrders(currentFilter);
    });
    wrap.appendChild(btn);
  }

  if(['pending','accepted'].includes(order.status)){
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-mini danger'; cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', async () => {
  const reason = await showAdminModal({
    message: `Cancelar pedido de ${order.customer_name}. Por que não vamos aceitar? (aparece pro cliente)`,
    withInput: true,
    placeholder: 'Motivo do cancelamento (opcional)',
    confirmText: 'Cancelar pedido'
  });
  if(reason === undefined) return; // fechou o modal sem confirmar

  await supabase.from('orders').update({ status:'cancelled', cancel_reason: reason || null }).eq('id', order.id);

  if(order.customer_phone){
    const phone = order.customer_phone.replace(/\D/g,'');
    const msg = `Oi ${order.customer_name}! Infelizmente não conseguimos aceitar seu pedido nº ${order.id.slice(0,8)}.\n\nMotivo: ${reason || 'entre em contato pra mais detalhes'}\n\nQualquer dúvida é só chamar por aqui`;
    window.open('https://wa.me/55' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    alert('Esse cliente não tem telefone salvo no perfil — cancelado sem aviso automático.');
  }
  loadOrders(currentFilter);
});
    wrap.appendChild(cancelBtn);
  }

  if(order.status !== 'cancelled'){
    const reprintBtn = document.createElement('button');
    reprintBtn.className = 'btn-mini secondary';
    reprintBtn.textContent = '🖨️ Reimprimir';
    reprintBtn.addEventListener('click', () => printOrder(order));
    wrap.appendChild(reprintBtn);
  }
}

// ---------- Som de notificação de pedido novo ----------
function playNewOrderSound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const playTone = (freq, start, dur, type='square', vol=0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    // sequência tipo "caixa registradora": bipe duplo grave + "cling" agudo no final
    playTone(660, 0,    0.12, 'square', 0.28);
    playTone(660, 0.14, 0.12, 'square', 0.28);
    playTone(880, 0.30, 0.10, 'square', 0.25);
    playTone(1320, 0.42, 0.35, 'triangle', 0.22); // o "cling" final, mais brilhante e longo
  }catch(err){
    console.warn('Não foi possível tocar o som de notificação.', err);
  }
}

// ---------- Tempo real: novos pedidos e mudanças aparecem sem precisar atualizar a página ----------
function subscribeRealtime(){
  supabase.channel('admin-orders')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'orders' }, () => {
      playNewOrderSound();
      loadOrders(currentFilter);
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders' }, () => {
      loadOrders(currentFilter);
    })
    .on('postgres_changes', { event:'DELETE', schema:'public', table:'orders' }, () => {
      loadOrders(currentFilter);
    })
    .subscribe();
}

// ---------- Estado inicial ----------
(async function init(){
  const { data: { user } } = await supabase.auth.getUser();
  if(user) checkAdminAndInit();
})();

// ---------- Impressora Bluetooth (ESC/POS via Web Serial) ----------
let printerWriter = null;
const ESC = 0x1B;

document.getElementById('connect-printer-btn').addEventListener('click', connectPrinter);

async function connectPrinter(){
  if(!('serial' in navigator)){
    alert('Esse navegador não suporta impressão direta. Use o Chrome ou Edge no computador.');
    return;
  }
  try{
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    printerWriter = port.writable.getWriter();
    updatePrinterStatus(true);
  }catch(err){
    console.error(err);
    alert('Não consegui conectar. Confirme que a impressora está pareada e ligada.');
  }
}

async function tryReconnectPrinter(){
  if(!('serial' in navigator)) return;
  const ports = await navigator.serial.getPorts(); // portas já autorizadas antes
  if(ports.length === 0) return;
  try{
    await ports[0].open({ baudRate: 9600 });
    printerWriter = ports[0].writable.getWriter();
    updatePrinterStatus(true);
  }catch{
    updatePrinterStatus(false);
  }
}

function updatePrinterStatus(connected){
  const el = document.getElementById('printer-status');
  el.textContent = connected ? '🖨️ Impressora conectada' : '🖨️ Impressora desconectada';
  el.className = 'printer-status ' + (connected ? 'ok' : 'off');
}

function sanitizeText(str){
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[•·●○▪]/g, '-')                          // bullets comuns viram hífen
    .replace(/[^\x00-\x7F]/g, '');                      // qualquer coisa não-ASCII que sobrar, remove
}

function buildReceiptBytes(order, viaLabel){
  const enc = new TextEncoder();
  const bytes = [];
  const raw = (...arr) => bytes.push(...arr);
  const text = (s) => bytes.push(...enc.encode(sanitizeText(s)));

  raw(ESC, 0x40);             // inicializa
  raw(ESC, 0x61, 0x01);       // centralizar
  raw(ESC, 0x21, 0x30);       // fonte grande
  text('CANTINHO DO ACAI\nPERUS\n');
  raw(ESC, 0x21, 0x00);       // fonte normal

  if(viaLabel){
    raw(ESC, 0x45, 0x01);
    text(`--- ${viaLabel} ---\n`);
    raw(ESC, 0x45, 0x00);
  }

  raw(ESC, 0x61, 0x00);       // alinhar esquerda
  text('--------------------------------\n');
  text(`Pedido #${order.id.slice(0,8)}\n`);
  text(`${new Date(order.created_at).toLocaleString('pt-BR')}\n`);
  text('--------------------------------\n');
  text(`Cliente: ${order.customer_name}\n`);
  text('--------------------------------\n');
  order.cups.forEach((c,i) => {
  text(`Copo ${i+1}:\n`);
  c.parts.forEach(p => text(`  ${p}\n`));
  text('\n');
});
  text('--------------------------------\n');
  if(order.delivery_type === 'Delivery'){
    text(`Entrega: ${order.address}\n`);
    if(order.reference) text(`Ref: ${order.reference}\n`);
  } else {
    text('Retirada no local\n');
  }
  text(`Pagamento: ${order.payment_method}\n`);
  if(order.change_for) text(`Troco para: R$ ${order.change_for}\n`);
  if(order.notes) text(`Obs: ${order.notes}\n`);
  text('--------------------------------\n');
  raw(ESC, 0x45, 0x01);       // negrito on
  text(`TOTAL: ${fmt(order.total)}\n`);
  raw(ESC, 0x45, 0x00);       // negrito off
  text('\n\n\n\n');
  return new Uint8Array(bytes);
}

async function printOrder(order){
  if(!printerWriter){
    console.warn('Impressora nao conectada — pedido nao foi impresso.');
    return;
  }
  try{
    if(order.delivery_type === 'Delivery'){
      await printerWriter.write(buildReceiptBytes(order, 'VIA LOJA'));
      await printerWriter.write(buildReceiptBytes(order, 'VIA MOTOQUEIRO'));
    } else {
      await printerWriter.write(buildReceiptBytes(order));
    }
  }catch(err){
    console.error(err);
    alert('Falha ao imprimir o pedido.');
  }
}