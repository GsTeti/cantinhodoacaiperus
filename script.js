const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

// ⚠️ Mantenha esses horários iguais aos que aparecem no modal (index.html) — são só informativos.
const STORE_HOURS = [
  { day:'Domingo', open:'15:00', close:'21:30' },
  { day:'Segunda', open:'15:00', close:'21:30' },
  { day:'Terça',   open:'15:00', close:'21:30' },
  { day:'Quarta',  open:'15:00', close:'21:30' },
  { day:'Quinta',  open:'15:00', close:'21:30' },
  { day:'Sexta',   open:'15:00', close:'21:30' },
  { day:'Sábado',  open:'15:00', close:'21:30' },
];

const PAYMENT_METHODS = [
  {name:'Dinheiro', emoji:'💵'},
  {name:'Cartão de Crédito', emoji:'💳'},
  {name:'Cartão de Débito', emoji:'💳'},
  {name:'Pix', emoji:'💠'},
];

// ⚠️ EDITE AQUI se a chave Pix mudar
const PIX_KEY = '11913299252';

// ---------- Estado carregado do banco ----------
let FLAVORS = [];
let SIZES = [];        // { id, name, onlyFlavor, prices: {flavorName: price} }
let MENU = {};          // { categoria: [ {id, name, price, available} ] }
let storeIsOpen = true;
let currentUser = null;
let savedAddresses = [];

let cart = [];
let cartIdSeq = 1;
let currentCupTotal = 0;

function getSizePriceFor(sizeName, flavorName){
  const size = SIZES.find(s => s.name === sizeName);
  if(!size || !flavorName) return 0;
  return size.prices[flavorName] ?? 0;
}

function getCupFlavorSize(cup){
  if (cup.flavor && cup.size) return { flavor: cup.flavor, size: cup.size };
  const first = (cup.parts && cup.parts[0]) || '';
  const [flavor, size] = first.split(' — ').map(s => (s || '').trim());
  return { flavor: flavor || null, size: size || null };
}

// ============================================================
// CARREGAMENTO DE DADOS
// ============================================================
async function loadMenuData(){
  const [{ data: flavorsData }, { data: sizesData }, { data: pricesData }, { data: toppingsData }] = await Promise.all([
    supabase.from('flavors').select('*').order('sort_order'),
    supabase.from('sizes').select('*').order('sort_order'),
    supabase.from('size_prices').select('*'),
    supabase.from('toppings').select('*').order('category').order('sort_order'),
  ]);

  FLAVORS = (flavorsData || []).map(f => ({ name:f.name, emoji:f.emoji, available:f.available }));

  SIZES = (sizesData || []).map(s => {
  const prices = {};
  (pricesData || []).filter(p => p.size_id === s.id).forEach(p => { prices[p.flavor_name] = Number(p.price); });
  return { name:s.name, onlyFlavor:s.only_flavor, prices, available:s.available };
});

  MENU = {};
  (toppingsData || []).forEach(item => {
    (MENU[item.category] ||= []).push({ id:item.id, name:item.name, price:Number(item.price), available:item.available });
  });

  renderFlavors();
  renderSizes();
  renderToppings();
}

async function loadStoreStatus(){
  const { data } = await supabase.from('store_settings').select('is_open').eq('id', 1).single();
  applyStoreStatus(data?.is_open ?? true);
}
function applyStoreStatus(isOpen){
  storeIsOpen = isOpen;
  const badge = document.getElementById('store-status-badge');
  badge.classList.toggle('status-open', isOpen);
  badge.classList.toggle('status-closed', !isOpen);
  badge.textContent = isOpen ? '🟢 Aberto agora' : '🔴 Fechado no momento';
  document.getElementById('closed-banner')?.remove();
  if(!isOpen){
    const banner = document.createElement('div');
    banner.id = 'closed-banner';
    banner.className = 'app-msg show error';
    banner.style.margin = '0 0 24px';
    banner.textContent = 'A loja está fechada no momento. Você pode montar seu pedido, mas só poderá enviá-lo quando abrirmos de novo.';
    document.querySelector('.builder-body').prepend(banner);
  }
  recalcGrandTotal();
}

async function loadAuthState(){
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  if(user){
    const { data } = await supabase.from('addresses').select('*').order('created_at', { ascending:false });
    savedAddresses = data || [];
  }
  renderSavedAddresses();
}

// ============================================================
// RENDER: sabor / tamanho / ingredientes
// ============================================================
function renderFlavors(){
  const wrap = document.getElementById('flavor-options');
  wrap.innerHTML = '';
  FLAVORS.forEach(flavor => {
    const chip = document.createElement('div');
    chip.className = 'radio-chip' + (flavor.available ? '' : ' radio-chip-disabled');
    chip.innerHTML = flavor.available
      ? `<label><input type="radio" name="flavor" value="${flavor.name}"> <span class="opt-name">${flavor.emoji || ''} ${flavor.name}</span></label>`
      : `<label class="disabled"><span class="opt-name">${flavor.emoji || ''} ${flavor.name}</span> <span class="price" style="color:#a32b2b;">Esgotado</span></label>`;
    wrap.appendChild(chip);
  });
  document.querySelectorAll('input[name="flavor"]').forEach(inp => inp.addEventListener('change', onFlavorChange));
}

function renderSizes(){
  const wrap = document.getElementById('base-options');
  wrap.innerHTML = '';
  SIZES.forEach(item => {
    const chip = document.createElement('div');
    let cls = 'radio-chip' + (item.available ? '' : ' radio-chip-disabled');
    if (item.onlyFlavor) cls += ' radio-chip-flavor-restricted';
    chip.className = cls;
    chip.innerHTML = item.available
      ? `<label><input type="radio" name="size" value="${item.name}"${item.onlyFlavor ? ` data-only-flavor="${item.onlyFlavor}"` : ''}> <span class="opt-name">${item.name}</span> <span class="price">R$ 0,00</span></label>`
      : `<label class="disabled"><span class="opt-name">${item.name}</span> <span class="price" style="color:#a32b2b;">Esgotado</span></label>`;
    wrap.appendChild(chip);
  });
  document.querySelectorAll('input[name="size"]').forEach(inp => inp.addEventListener('change', onFlavorChange));
}

function renderToppings(){
  ['Frutas','Coberturas','Combinações','Chocolates','Extras','Bebidas'].forEach(cat => {
    const wrap = document.querySelector(`.opt-grid[data-cat="${cat}"]`);
    if(!wrap) return;
    wrap.innerHTML = '';
    (MENU[cat] || []).forEach(item => {
      const opt = document.createElement('div');
      opt.className = 'opt' + (item.available ? '' : ' opt-unavailable');
      opt.dataset.price = item.price;
      opt.dataset.qty = '0';
      opt.dataset.name = item.name;
      opt.style.opacity = item.available ? '' : '0.5';
	  opt.dataset.id = item.id;

      if(item.available){
        opt.innerHTML = `
          <span class="opt-name">${item.name}</span>
          <div class="opt-right">
            <span class="opt-unit-price">${fmt(item.price)}</span>
            <div class="qty-stepper">
              <button type="button" class="qty-btn qty-minus" aria-label="Diminuir ${item.name}">−</button>
              <span class="qty-val">0</span>
              <button type="button" class="qty-btn qty-plus" aria-label="Aumentar ${item.name}">+</button>
            </div>
          </div>`;
        opt.querySelector('.qty-plus').addEventListener('click', () => changeQty(opt, 1));
        opt.querySelector('.qty-minus').addEventListener('click', () => changeQty(opt, -1));
      } else {
        opt.innerHTML = `
          <span class="opt-name">${item.name}</span>
          <div class="opt-right">
            <span class="opt-unit-price" style="color:#a32b2b;">Esgotado</span>
          </div>`;
      }
      wrap.appendChild(opt);
    });
  });
}

// ============================================================
// LÓGICA DO CARDÁPIO (montar copo)
// ============================================================
const sizeWrapper = document.getElementById('size-wrapper');
const cartBlock = document.getElementById('cart-block');
const cartList = document.getElementById('cart-list');
const cupPromptWrapper = document.getElementById('cup-prompt-wrapper');

function changeQty(optDiv, delta){
  let qty = parseInt(optDiv.dataset.qty) || 0;
  qty = Math.max(0, qty + delta);
  optDiv.dataset.qty = qty;
  optDiv.querySelector('.qty-val').textContent = qty;
  optDiv.classList.toggle('opt-active', qty > 0);
  recalcCurrentCup();
}

const floatPrice = document.getElementById('float-price');
const floatPriceVal = document.getElementById('float-price-val');
const monteSection = document.getElementById('monte');
const subtotalBlock = document.querySelector('.add-cup-block');

function updateFloatPrice(){
  if(!floatPrice || !floatPriceVal) return;
  let inMonte = false;
  if(monteSection){
    const monteRect = monteSection.getBoundingClientRect();
    inMonte = monteRect.top < window.innerHeight && monteRect.bottom > 0;
  }
  let subtotalPassed = false;
  if(subtotalBlock){
    const subRect = subtotalBlock.getBoundingClientRect();
    subtotalPassed = subRect.top <= 90;
  }
  floatPriceVal.textContent = fmt(currentCupTotal);
  const shouldShow = inMonte && !subtotalPassed && currentCupTotal > 0;
  floatPrice.classList.toggle('show', shouldShow);
}
window.addEventListener('scroll', updateFloatPrice, { passive:true });
window.addEventListener('resize', updateFloatPrice);

function updateSizePrices(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const flavorName = flavorChecked ? flavorChecked.value : null;
  document.querySelectorAll('#base-options .radio-chip').forEach(chip => {
    const input = chip.querySelector('input[name="size"]');
    const priceSpan = chip.querySelector('.price');
    const price = flavorName ? getSizePriceFor(input.value, flavorName) : 0;
    priceSpan.textContent = fmt(price);
  });
}

function updateFlavorRestrictedOptions(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const flavorName = flavorChecked ? flavorChecked.value : null;
  document.querySelectorAll('.radio-chip-flavor-restricted').forEach(chipDiv => {
    const input = chipDiv.querySelector('input');
    const allowed = input.dataset.onlyFlavor === flavorName;
    chipDiv.classList.toggle('chip-flavor-visible', allowed);
    if(!allowed && input.checked) input.checked = false;
  });
}

function onFlavorChange(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const alreadyOpen = sizeWrapper.classList.contains('reveal-open');
  sizeWrapper.classList.toggle('reveal-open', !!flavorChecked);
  updateSizePrices();
  updateFlavorRestrictedOptions();
  recalcCurrentCup();
  if(flavorChecked && !alreadyOpen){
    const sizeBlock = sizeWrapper.querySelector('.cat-block');
    setTimeout(() => { if(sizeBlock) sizeBlock.scrollIntoView({ behavior:'smooth', block:'start' }); }, 300);
  }
}

function recalcCurrentCup(){
  let total = 0;
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const sizeChecked = document.querySelector('input[name="size"]:checked');
  if(flavorChecked && sizeChecked) total += getSizePriceFor(sizeChecked.value, flavorChecked.value);
  document.querySelectorAll('.opt-grid .opt').forEach(optDiv => {
    const qty = parseInt(optDiv.dataset.qty) || 0;
    if(qty > 0) total += (parseFloat(optDiv.dataset.price) || 0) * qty;
  });
  currentCupTotal = total;
  document.getElementById('cup-subtotal').textContent = fmt(total);
  updateFloatPrice();
  const ready = !!(flavorChecked && sizeChecked);
  cupPromptWrapper.classList.toggle('reveal-open', ready);
}

function addCupToCart(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const sizeChecked = document.querySelector('input[name="size"]:checked');
  if(!flavorChecked || !sizeChecked) return;

  const parts = [`${flavorChecked.value} — ${sizeChecked.value}`];
  const toppings = [];
  let total = getSizePriceFor(sizeChecked.value, flavorChecked.value);

  document.querySelectorAll('.opt-grid .opt').forEach(optDiv => {
    const qty = parseInt(optDiv.dataset.qty) || 0;
    if(qty > 0){
      const price = parseFloat(optDiv.dataset.price) || 0;
      total += price * qty;
      const name = optDiv.dataset.name;
      parts.push(qty > 1 ? `${name} x${qty}` : name);
      toppings.push({ id: parseInt(optDiv.dataset.id), name, qty });
      optDiv.dataset.qty = '0';
      optDiv.querySelector('.qty-val').textContent = '0';
      optDiv.classList.remove('opt-active');
    }
  });

  cart.push({
    id: cartIdSeq++, parts, total,
    flavor: flavorChecked.value, size: sizeChecked.value, toppings
  });

  flavorChecked.checked = false;
  sizeChecked.checked = false;
  sizeWrapper.classList.remove('reveal-open');
  updateSizePrices();
  updateFlavorRestrictedOptions();
  recalcCurrentCup();
  renderCart();
  recalcGrandTotal();
}

function renderCart(){
  cartBlock.classList.toggle('has-items', cart.length > 0);
  cartList.innerHTML = '';
  cart.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-title">Copo ${index + 1}</div>
        <div class="cart-item-parts">${item.parts.join(' • ')}</div>
      </div>
      <div class="cart-item-side">
        <span class="cart-item-price">${fmt(item.total)}</span>
        <button type="button" class="cart-item-remove" data-id="${item.id}" aria-label="Remover copo">✕</button>
      </div>`;
    cartList.appendChild(row);
  });
  cartList.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      cart = cart.filter(item => item.id !== parseInt(btn.dataset.id));
      renderCart();
      recalcGrandTotal();
    });
  });
}

function scrollToFlavorStart(){
  const target = document.getElementById('flavor-options').closest('.cat-block');
  if(target) setTimeout(() => target.scrollIntoView({ behavior:'smooth' }), 50);
}

document.getElementById('add-another-cup').addEventListener('click', () => { addCupToCart(); scrollToFlavorStart(); });
document.getElementById('finish-cups').addEventListener('click', () => {
  addCupToCart();
  const deliverySection = document.getElementById('delivery-section');
  if(deliverySection) setTimeout(() => deliverySection.scrollIntoView({ behavior:'smooth', block:'start' }), 550);
});

// ============================================================
// ENDEREÇOS SALVOS (se logado)
// ============================================================
function renderSavedAddresses(){
  let wrap = document.getElementById('saved-addresses-wrap');
  const addressField = document.getElementById('address-field');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'saved-addresses-wrap';
    wrap.style.marginBottom = '14px';
    addressField.parentNode.insertBefore(wrap, addressField);
  }
  wrap.innerHTML = '';
  if(!currentUser || savedAddresses.length === 0) return;

  const label = document.createElement('div');
  label.className = 'cat-hint';
  label.style.marginBottom = '8px';
  label.textContent = 'Usar um endereço salvo:';
  wrap.appendChild(label);

  const row = document.createElement('div');
  row.className = 'radio-row';
  savedAddresses.forEach(addr => {
    const chip = document.createElement('div');
    chip.className = 'radio-chip';
    chip.innerHTML = `<label><input type="radio" name="saved-address" value="${addr.id}"> <span class="opt-name">${addr.label || 'Endereço'}</span></label>`;
    chip.querySelector('input').addEventListener('change', () => {
      document.getElementById('customer-address').value = addr.address;
      document.getElementById('customer-reference').value = addr.reference || '';
    });
    row.appendChild(chip);
  });
  wrap.appendChild(row);
}

// ============================================================
// ENTREGA / PAGAMENTO
// ============================================================
document.querySelectorAll('#delivery-options input, #customer-name, #customer-address, #customer-reference, #troco-value, #customer-notes')
  .forEach(inp => inp.addEventListener('input', recalcGrandTotal));

  ['customer-name','customer-address'].forEach(id => {
  document.getElementById(id).addEventListener('input', function(){
    this.classList.remove('field-error');
  });
});

document.getElementById('payment-options').addEventListener('change', function(){
  this.classList.remove('field-error');
});

function recalcGrandTotal(){
  let total = cart.reduce((sum, item) => sum + item.total, 0);
  const deliveryChecked = document.querySelector('input[name="delivery-type"]:checked');
  const isDelivery = deliveryChecked && deliveryChecked.value === 'Delivery';
  const addressField = document.getElementById('address-field');
  const referenceField = document.getElementById('reference-field');
  addressField.classList.toggle('hidden', !isDelivery);
  referenceField.classList.toggle('hidden', !isDelivery);
  document.getElementById('saved-addresses-wrap')?.style.setProperty('display', isDelivery ? '' : 'none');

  if(isDelivery) total += parseFloat(deliveryChecked.dataset.fee) || 0;

  const paymentChecked = document.querySelector('input[name="payment-method"]:checked');
  document.getElementById('total-val').textContent = fmt(total);

  const btn = document.getElementById('send-order');
  const name = document.getElementById('customer-name').value.trim();
  const address = document.getElementById('customer-address').value.trim();

  btn.setAttribute('aria-disabled', 'false');
  btn.style.opacity = '1';

  if(!storeIsOpen && cart.length > 0 && deliveryChecked && paymentChecked && name && (!isDelivery || address)){
    btn.textContent = '🔴 Loja fechada no momento';
  } else {
    btn.textContent = '📲 Enviar pedido';
  }
}

const pixInfoWrapper = document.getElementById('pix-info-wrapper');
const trocoInfoWrapper = document.getElementById('troco-info-wrapper');
const trocoValueWrapper = document.getElementById('troco-value-wrapper');

function onPaymentChange(){
  const checked = document.querySelector('input[name="payment-method"]:checked');
  pixInfoWrapper.classList.toggle('reveal-open', !!checked && checked.value === 'Pix');
  trocoInfoWrapper.classList.toggle('reveal-open', !!checked && checked.value === 'Dinheiro');
  recalcGrandTotal();
}
function onTrocoNeededChange(){
  const trocoChecked = document.querySelector('input[name="troco-needed"]:checked');
  trocoValueWrapper.classList.toggle('reveal-open', !!trocoChecked && trocoChecked.value === 'Sim');
  recalcGrandTotal();
}
document.querySelectorAll('input[name="troco-needed"]').forEach(inp => inp.addEventListener('change', onTrocoNeededChange));

const copyPixBtn = document.getElementById('copy-pix-btn');
document.getElementById('pix-key-display').textContent = PIX_KEY;
copyPixBtn.addEventListener('click', async () => {
  try{ await navigator.clipboard.writeText(PIX_KEY); }
  catch(err){
    const temp = document.createElement('textarea');
    temp.value = PIX_KEY; temp.style.position = 'fixed'; temp.style.opacity = '0';
    document.body.appendChild(temp); temp.select(); document.execCommand('copy'); document.body.removeChild(temp);
  }
  copyPixBtn.textContent = '✅ Copiado!';
  setTimeout(() => copyPixBtn.textContent = '📋 Copiar', 2000);
});

const paymentWrap = document.getElementById('payment-options');
PAYMENT_METHODS.forEach(method => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  chip.innerHTML = `<label><input type="radio" name="payment-method" value="${method.name}"> <span class="opt-name">${method.emoji} ${method.name}</span></label>`;
  paymentWrap.appendChild(chip);
});
document.querySelectorAll('input[name="payment-method"]').forEach(inp => inp.addEventListener('change', onPaymentChange));

function validateOrderFields(){
  const name = document.getElementById('customer-name');
  const deliveryChecked = document.querySelector('input[name="delivery-type"]:checked');
  const isDelivery = deliveryChecked && deliveryChecked.value === 'Delivery';
  const address = document.getElementById('customer-address');
  const paymentChecked = document.querySelector('input[name="payment-method"]:checked');
  const paymentOptions = document.getElementById('payment-options');

  let firstInvalid = null;

  const textFields = isDelivery ? [name, address] : [name];
  textFields.forEach(field => {
    const valid = field.value.trim() !== '';
    field.classList.toggle('field-error', !valid);
    if(!valid && !firstInvalid) firstInvalid = field;
  });

  paymentOptions.classList.toggle('field-error', !paymentChecked);
  if(!paymentChecked && !firstInvalid) firstInvalid = paymentOptions;

  if(firstInvalid){
    firstInvalid.scrollIntoView({ behavior:'smooth', block:'center' });
    if(typeof firstInvalid.focus === 'function') firstInvalid.focus();
    return false;
  }
  return true;
}

// ============================================================
// ENVIO DO PEDIDO (exige login)
// ============================================================
const sendOrderBtn = document.getElementById('send-order');
const authGate = document.getElementById('auth-gate');

sendOrderBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  if(!validateOrderFields()) return;

  if(!currentUser){
    authGate.classList.add('reveal-open');
    authGate.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  submitOrder();
});

document.getElementById('auth-gate-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('gate-email').value.trim();
  const password = document.getElementById('gate-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  const msg = document.getElementById('auth-gate-msg');
  if(error){ msg.textContent = 'E-mail ou senha incorretos.'; msg.className = 'app-msg show error'; return; }
  await loadAuthState();
  authGate.classList.remove('reveal-open');
  submitOrder();
});

document.getElementById('auth-gate-signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('gate-name').value.trim();
  const phone = document.getElementById('gate-phone').value.trim();
  const email = document.getElementById('gate-signup-email').value.trim();
  const password = document.getElementById('gate-signup-password').value;
  const { error } = await supabase.auth.signUp({ email, password, options:{ data:{ name, phone } } });
  const msg = document.getElementById('auth-gate-msg');
  if(error){ msg.textContent = 'Não foi possível criar a conta: ' + error.message; msg.className = 'app-msg show error'; return; }
  await loadAuthState();
  authGate.classList.remove('reveal-open');
  submitOrder();
});

document.querySelectorAll('.auth-gate-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-gate-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('auth-gate-login-form').style.display = tab.dataset.gate === 'login' ? '' : 'none';
    document.getElementById('auth-gate-signup-form').style.display = tab.dataset.gate === 'signup' ? '' : 'none';
  });
});

async function submitOrder(){
  if(!storeIsOpen){ recalcGrandTotal(); return; }

  const { data: profile } = await supabase.from('profiles').select('phone').eq('id', currentUser.id).single();
  const deliveryChecked = document.querySelector('input[name="delivery-type"]:checked');
  const isDelivery = deliveryChecked.value === 'Delivery';
  const paymentChecked = document.querySelector('input[name="payment-method"]:checked');
  const name = document.getElementById('customer-name').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const reference = document.getElementById('customer-reference').value.trim();
  const notes = document.getElementById('customer-notes').value.trim();

  let changeFor = null;
  if(paymentChecked.value === 'Dinheiro'){
    const trocoChecked = document.querySelector('input[name="troco-needed"]:checked');
    if(trocoChecked?.value === 'Sim') changeFor = document.getElementById('troco-value').value.trim() || 'sim';
  }

  const subtotal = cart.reduce((s,i) => s + i.total, 0);
  const deliveryFee = isDelivery ? (parseFloat(deliveryChecked.dataset.fee) || 0) : 0;
  const total = subtotal + deliveryFee;

  sendOrderBtn.style.pointerEvents = 'none';
  sendOrderBtn.textContent = 'Enviando...';

  const { data: order, error } = await supabase.from('orders').insert({
    customer_id: currentUser.id,
    customer_name: name,
    customer_phone: profile?.phone || null,
    delivery_type: isDelivery ? 'Delivery' : 'Retirada',
    address: isDelivery ? address : null,
    reference: isDelivery ? reference : null,
    payment_method: paymentChecked.value,
    change_for: changeFor,
    notes: notes || null,
    cups: cart,
    subtotal, delivery_fee: deliveryFee, total,
  }).select().single();

  sendOrderBtn.style.pointerEvents = '';

  if(error){
    alert('Não foi possível enviar o pedido. Tente novamente.');
    recalcGrandTotal();
    return;
  }

  // também abre o WhatsApp com o resumo, como canal extra de contato
  let msg = `Oi! Fiz um pedido pelo site (nº ${order.id.slice(0,8)}):\n\n`;
  cart.forEach((item, index) => { msg += `Copo ${index + 1}: ${item.parts.join(', ')} — ${fmt(item.total)}\n`; });
  msg += `\n${isDelivery ? 'Delivery' : 'Retirada no local'}\nNome: ${name}`;
  if(isDelivery) msg += `\nEndereço: ${address}${reference ? ' — ' + reference : ''}`;
  msg += `\nPagamento: ${paymentChecked.value}\nTotal: ${fmt(total)}`;
  window.open('https://wa.me/5511949360595?text=' + encodeURIComponent(msg), '_blank');

  window.location.href = `pedido.html?id=${order.id}`;
}

// ============================================================
// Modal "Horários, endereço e mais"
// ============================================================
const storeInfoModal = document.getElementById('store-info-modal');
document.getElementById('open-store-info').addEventListener('click', () => {
  storeInfoModal.classList.add('open'); document.body.style.overflow = 'hidden';
});
document.getElementById('close-store-info').addEventListener('click', closeStoreModal);
function closeStoreModal(){ storeInfoModal.classList.remove('open'); document.body.style.overflow = ''; }
storeInfoModal.addEventListener('click', (e) => { if(e.target === storeInfoModal) closeStoreModal(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && storeInfoModal.classList.contains('open')) closeStoreModal(); });

// ---------- Parallax do banner ----------
const storeHeroBg = document.querySelector('.store-hero-bg');
const storeHeroSection = document.querySelector('.store-hero');
function updateHeroParallax(){
  if(!storeHeroBg || !storeHeroSection) return;
  const rect = storeHeroSection.getBoundingClientRect();
  if(rect.bottom < 0 || rect.top > window.innerHeight) return;
  const maxOffset = rect.height * 0.12;
  let offset = rect.top * 0.3;
  offset = Math.max(-maxOffset, Math.min(maxOffset, offset));
  storeHeroBg.style.transform = `translateY(${offset}px)`;
}
window.addEventListener('scroll', updateHeroParallax, { passive:true });
window.addEventListener('resize', updateHeroParallax);
updateHeroParallax();

// ---------- Busca de ingredientes ----------
const menuSearchInput = document.getElementById('menu-search');
const searchNoResults = document.getElementById('search-no-results');
const flavorBlock = document.getElementById('flavor-options').closest('.cat-block');

menuSearchInput.addEventListener('input', () => {
  const query = menuSearchInput.value.trim().toLowerCase();
  const isSearching = query !== '';

  flavorBlock.style.display = isSearching ? 'none' : '';
  sizeWrapper.style.display = isSearching ? 'none' : '';

  let anyResultAtAll = false;
  document.querySelectorAll('.opt-grid').forEach(grid => {
    let anyVisibleInGrid = false;
    grid.querySelectorAll('.opt').forEach(optDiv => {
      const name = (optDiv.dataset.name || '').toLowerCase();
      const match = !query || name.includes(query);
      optDiv.style.display = match ? '' : 'none';
      if(match){ anyVisibleInGrid = true; anyResultAtAll = true; }
    });
    const catBlock = grid.closest('.cat-block');
    if(catBlock) catBlock.style.display = anyVisibleInGrid ? '' : 'none';
  });
  searchNoResults.classList.toggle('show', query !== '' && !anyResultAtAll);
});

// ============================================================
// TEMPO REAL: estoque e status da loja atualizam sozinhos
// ============================================================
function subscribeRealtime(){
  supabase.channel('cardapio-live')
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'store_settings' }, (payload) => {
      applyStoreStatus(payload.new.is_open);
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'toppings' }, () => {
      loadMenuData();
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'flavors' }, () => {
      loadMenuData();
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'sizes' }, () => {
      loadMenuData();
    })
    .subscribe();
}

// ============================================================
// INÍCIO
// ============================================================
(async function init(){
  await Promise.all([loadMenuData(), loadStoreStatus(), loadAuthState()]);
  recalcCurrentCup();
  await tryLoadRepeatOrder();
  renderCart();
  recalcGrandTotal();
  subscribeRealtime();
})();

async function tryLoadRepeatOrder(){
  const raw = sessionStorage.getItem('repeat-order-cups');
  if(!raw) return;
  sessionStorage.removeItem('repeat-order-cups');

  let cups;
  try{ cups = JSON.parse(raw); } catch { return; }

  const removed = [];
  cups.forEach(cup => {
    const { flavor, size } = getCupFlavorSize(cup);
    if(!flavor || !size) return;
    const flavorOk = FLAVORS.find(f => f.name === flavor && f.available);
    const sizeOk = SIZES.find(s => s.name === size && s.available);
    if(!flavorOk || !sizeOk){
      removed.push(`Copo (${flavor} — ${size})`);
      return;
    }
    let total = getSizePriceFor(size, flavor);
    const parts = [`${flavor} — ${size}`];
    const toppings = [];

    // AQUI dentro é onde entra a versão nova, substituindo o forEach antigo:
    parseToppingsFallback(cup).forEach(t => {
      const live = Object.values(MENU).flat().find(m =>
        t.id != null ? m.id === t.id : m.name === t.name
      );
      if(!live || !live.available){ removed.push(`${t.name} (do copo ${flavor})`); return; }
      total += live.price * t.qty;
      parts.push(t.qty > 1 ? `${t.name} x${t.qty}` : t.name);
      toppings.push({ id: live.id, name: live.name, qty: t.qty });
    });

    cart.push({ id: cartIdSeq++, parts, total, flavor, size, toppings });
  });

  renderCart();
  recalcGrandTotal();
  if(removed.length){
    alert('Alguns itens desse pedido estão esgotados e não entraram: ' + removed.join(', '));
  }
  if(cart.length){
    document.getElementById('cart-block')?.scrollIntoView({ behavior:'smooth' });
  }
}

// função auxiliar, essa sim fica solta fora, do lado de fora da função acima
function parseToppingsFallback(cup){
  if (cup.toppings && cup.toppings.length) return cup.toppings;
  if (!cup.parts || cup.parts.length < 2) return [];
  return cup.parts.slice(1).map(p => {
    const m = p.match(/^(.*?)(?: x(\d+))?$/);
    const name = (m[1] || p).trim();
    const qty = m[2] ? parseInt(m[2]) : 1;
    return { id: null, name, qty };
  });
}

document.getElementById('logout-account-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.reload();
});