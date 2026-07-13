// ---------- Dados do cardápio ----------
// Tamanhos com preço MANUAL por sabor (sem cálculo de acréscimo).
// onlyFlavor: tamanho exclusivo daquele sabor (ex: Tigela/Barca/Marmita só em Açaí).
const SIZES = [
  { name:'Copo 200ml', prices:{ 'Açaí':6.00,  'Cupuaçu':9.00,  'Meio a meio':7.50  } },
  { name:'Copo 300ml', prices:{ 'Açaí':9.00,  'Cupuaçu':13.50, 'Meio a meio':11.50 } },
  { name:'Copo 400ml', prices:{ 'Açaí':12.00, 'Cupuaçu':18.00, 'Meio a meio':15.00 } },
  { name:'Copo 500ml', prices:{ 'Açaí':14.00, 'Cupuaçu':22.00, 'Meio a meio':18.00 } },
  { name:'Copo 700ml', prices:{ 'Açaí':18.00, 'Cupuaçu':31.00, 'Meio a meio':24.50 } },
  { name:'Tigela 300ml',      prices:{ 'Açaí':10.00, 'Cupuaçu':13.00, 'Meio a meio':11.50 } },
  { name:'Tigela 500ml',      prices:{ 'Açaí':15.00, 'Cupuaçu':18.00, 'Meio a meio':16.50 } },
  { name:'Barca individual',  prices:{ 'Açaí':20.00 }, onlyFlavor:'Açaí' },
  { name:'Marmita 1L',        prices:{ 'Açaí':30.00 }, onlyFlavor:'Açaí' },
];

const MENU = {
  Frutas:[
    {name:'Abacaxi',price:2.50},{name:'Banana',price:2.50},{name:'Kiwi',price:3.50},
    {name:'Uva',price:2.50},{name:'Morango',price:3.50},
  ],
  Coberturas:[
    {name:'Cobertura de chocolate',price:2.00},{name:'Cobertura de morango',price:2.00},
    {name:'Cobertura de caramelo',price:2.00},{name:'Mel',price:3.00},
  ],
  'Combinações':[
    {name:'Leite condensado',price:2.50},{name:'Leite em pó',price:3.00},{name:'Coco ralado',price:2.00},
    {name:'Granola',price:3.00},{name:'Paçoca',price:2.00},{name:'Amendoim',price:3.00},
    {name:'Sucrilhos',price:3.00},{name:'Ovomaltine',price:3.00},{name:'Neston',price:3.00},
    {name:'Aveia',price:2.50},{name:'Farinha láctea',price:3.00},{name:'Nesquik',price:2.50},
    {name:'Beijinho',price:3.00},{name:'Doce de leite',price:3.00},{name:'Danone',price:2.50},
  ],
  Chocolates:[
    {name:'Power Boll',price:2.50},{name:'Kit Kat',price:3.50},{name:'Trento',price:3.50},
    {name:'Twix',price:2.00},{name:'Confetes',price:3.00},{name:'Granulado',price:2.00},
    {name:'Brigadeiro',price:3.00},{name:'Ouro Branco',price:3.00},{name:'Sonho de Valsa',price:3.00},
    {name:'Biss branco/preto',price:2.50},{name:'Prestígio',price:4.00},{name:'Raspa choc. branca',price:3.00},
    {name:'Raspa choc. preta',price:3.00},{name:'Ferrero Rocher',price:4.50},{name:'Creme de avelã',price:6.00},
    {name:'Creme de ninho',price:6.00},{name:'Nutella',price:7.50},
  ],
  Extras:[
    {name:'Mousse maracujá',price:4.00},{name:'Mousse morango',price:4.00},{name:'Mousse uva',price:4.00},
  ],
  Bebidas:[
    {name:'Água',price:2.50},
  ],
};

const FLAVORS = [
  {name:'Açaí', emoji:'🫐'},
  {name:'Cupuaçu', emoji:'🍈'},
  {name:'Meio a meio', emoji:'◐'},
];

const PAYMENT_METHODS = [
  {name:'Dinheiro', emoji:'💵'},
  {name:'Cartão de Crédito', emoji:'💳'},
  {name:'Cartão de Débito', emoji:'💳'},
  {name:'Pix', emoji:'💠'},
];

// ⚠️ EDITE AQUI: coloque sua chave Pix real (CPF/CNPJ, e-mail, telefone ou chave aleatória)
const PIX_KEY = '1191329-9252';

const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');

// retorna o preço manual daquele tamanho para o sabor escolhido (0 se não existir)
function getSizePriceFor(sizeName, flavorName){
  const size = SIZES.find(s => s.name === sizeName);
  if(!size || !flavorName) return 0;
  return size.prices[flavorName] ?? 0;
}

let cart = [];
let cartIdSeq = 1;
let currentCupTotal = 0;

// render flavor radios
const flavorWrap = document.getElementById('flavor-options');
FLAVORS.forEach(flavor => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  chip.innerHTML = `<label><input type="radio" name="flavor" value="${flavor.name}"> <span class="opt-name">${flavor.emoji} ${flavor.name}</span></label>`;
  flavorWrap.appendChild(chip);
});

// render size radios (tamanhos de copo/tigela + opções exclusivas como Barca e Marmita)
const baseWrap = document.getElementById('base-options');
SIZES.forEach(item => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  if(item.onlyFlavor) chip.classList.add('radio-chip-flavor-restricted');
  chip.innerHTML = `<label><input type="radio" name="size" value="${item.name}" ${item.onlyFlavor ? `data-only-flavor="${item.onlyFlavor}"` : ''}> <span class="opt-name">${item.name}</span> <span class="price">R$ --</span></label>`;
  baseWrap.appendChild(chip);
});

// render categorias de acompanhamentos com contador de quantidade (+/-)
['Frutas','Coberturas','Combinações','Chocolates','Extras','Bebidas'].forEach(cat => {
  const wrap = document.querySelector(`.opt-grid[data-cat="${cat}"]`);
  MENU[cat].forEach(item => {
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.dataset.price = item.price;
    opt.dataset.qty = '0';
    opt.dataset.name = item.name;
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
    wrap.appendChild(opt);
  });
});

// render payment method radios
const paymentWrap = document.getElementById('payment-options');
PAYMENT_METHODS.forEach(method => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  chip.innerHTML = `<label><input type="radio" name="payment-method" value="${method.name}"> <span class="opt-name">${method.emoji} ${method.name}</span></label>`;
  paymentWrap.appendChild(chip);
});
document.getElementById('pix-key-display').textContent = PIX_KEY;

// ⚠️ Mantenha esses horários iguais aos que aparecem no modal (index.html).
// Formato 24h "HH:MM". Se um dia for fechado, deixe open e close como null.
const STORE_HOURS = [
  { day:'Domingo', open:'15:00', close:'21:30' },
  { day:'Segunda', open:'15:00', close:'21:30' },
  { day:'Terça',   open:'15:00', close:'21:30' },
  { day:'Quarta',  open:'15:00', close:'21:30' },
  { day:'Quinta',  open:'15:00', close:'21:30' },
  { day:'Sexta',   open:'15:00', close:'21:30' },
  { day:'Sábado',  open:'15:00', close:'21:30' },
];

function updateStoreStatus(){
  const badge = document.getElementById('store-status-badge');
  if(!badge) return;

  const now = new Date();
  const todayHours = STORE_HOURS[now.getDay()]; // 0=Domingo ... 6=Sábado

  let isOpen = false;
  if(todayHours && todayHours.open && todayHours.close){
    const [openH, openM] = todayHours.open.split(':').map(Number);
    const [closeH, closeM] = todayHours.close.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if(closeMinutes > openMinutes){
      isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    } else {
      // horário que vira a noite (ex: 18:00 às 01:00)
      isOpen = nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    }
  }

  badge.classList.toggle('status-open', isOpen);
  badge.classList.toggle('status-closed', !isOpen);
  badge.textContent = isOpen ? '🟢 Aberto agora' : '🔴 Fechado agora';
}

updateStoreStatus();
setInterval(updateStoreStatus, 60000); // reavalia a cada 1 minuto

// ---------- Efeito parallax no banner do topo ----------
const storeHeroBg = document.querySelector('.store-hero-bg');
const storeHeroSection = document.querySelector('.store-hero');

function updateHeroParallax(){
  if(!storeHeroBg || !storeHeroSection) return;
  const rect = storeHeroSection.getBoundingClientRect();
  if(rect.bottom < 0 || rect.top > window.innerHeight) return;
  const maxOffset = rect.height * 0.12; // limite seguro dentro da sobra de 15%
  let offset = rect.top * 0.3;
  offset = Math.max(-maxOffset, Math.min(maxOffset, offset));
  storeHeroBg.style.transform = `translateY(${offset}px)`;
}

window.addEventListener('scroll', updateHeroParallax, { passive:true });
window.addEventListener('resize', updateHeroParallax);
updateHeroParallax();

const sizeWrapper = document.getElementById('size-wrapper');
const cartBlock = document.getElementById('cart-block');
const cartList = document.getElementById('cart-list');
const cupPromptWrapper = document.getElementById('cup-prompt-wrapper');

// ---------- Contador de quantidade (+/-) nos acompanhamentos ----------
function changeQty(optDiv, delta){
  let qty = parseInt(optDiv.dataset.qty) || 0;
  qty = Math.max(0, qty + delta);
  optDiv.dataset.qty = qty;
  optDiv.querySelector('.qty-val').textContent = qty;
  optDiv.classList.toggle('opt-active', qty > 0);
  recalcCurrentCup();
}

document.querySelectorAll('.opt-grid .qty-plus').forEach(btn => {
  btn.addEventListener('click', () => changeQty(btn.closest('.opt'), 1));
});
document.querySelectorAll('.opt-grid .qty-minus').forEach(btn => {
  btn.addEventListener('click', () => changeQty(btn.closest('.opt'), -1));
});

// ---------- Preço flutuante (visível enquanto a pessoa marca os itens) ----------
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

window.addEventListener('scroll', updateFloatPrice, { passive: true });
window.addEventListener('resize', updateFloatPrice);

// atualiza os preços exibidos nos tamanhos conforme o sabor escolhido (valores manuais, sem acréscimo)
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

// esconde/mostra tamanhos restritos a um sabor específico (ex: Barca/Marmita só em Açaí)
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

  // ao escolher o sabor, desce suavemente até a opção de tamanho recém-revelada
  if(flavorChecked && !alreadyOpen){
    const sizeBlock = sizeWrapper.querySelector('.cat-block');
    setTimeout(() => {
      if(sizeBlock) sizeBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
}

// calcula o subtotal do copo sendo montado agora, em tempo real
function recalcCurrentCup(){
  let total = 0;
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const sizeChecked = document.querySelector('input[name="size"]:checked');

  if(flavorChecked && sizeChecked){
    total += getSizePriceFor(sizeChecked.value, flavorChecked.value);
  }
  document.querySelectorAll('.opt-grid .opt').forEach(optDiv => {
    const qty = parseInt(optDiv.dataset.qty) || 0;
    if(qty > 0){
      total += (parseFloat(optDiv.dataset.price) || 0) * qty;
    }
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
  let total = getSizePriceFor(sizeChecked.value, flavorChecked.value);

  document.querySelectorAll('.opt-grid .opt').forEach(optDiv => {
    const qty = parseInt(optDiv.dataset.qty) || 0;
    if(qty > 0){
      const price = parseFloat(optDiv.dataset.price) || 0;
      total += price * qty;
      const name = optDiv.dataset.name;
      parts.push(qty > 1 ? `${name} x${qty}` : name);
      // reseta a quantidade desse item
      optDiv.dataset.qty = '0';
      optDiv.querySelector('.qty-val').textContent = '0';
      optDiv.classList.remove('opt-active');
    }
  });

  cart.push({ id: cartIdSeq++, parts, total });

  // reseta a seleção para montar o próximo copo do zero
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

function recalcGrandTotal(){
  let total = cart.reduce((sum, item) => sum + item.total, 0);

  const deliveryChecked = document.querySelector('input[name="delivery-type"]:checked');
  const isDelivery = deliveryChecked && deliveryChecked.value === 'Delivery';
  const addressField = document.getElementById('address-field');
  const referenceField = document.getElementById('reference-field');
  addressField.classList.toggle('hidden', !isDelivery);
  referenceField.classList.toggle('hidden', !isDelivery);

  if(isDelivery){
    total += parseFloat(deliveryChecked.dataset.fee) || 0;
  }

  const paymentChecked = document.querySelector('input[name="payment-method"]:checked');

  document.getElementById('total-val').textContent = fmt(total);
  const btn = document.getElementById('send-order');

  const name = document.getElementById('customer-name').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const reference = document.getElementById('customer-reference').value.trim();
  const notes = document.getElementById('customer-notes').value.trim();

  const ready = cart.length > 0 && !!deliveryChecked && !!paymentChecked && name !== '' && (!isDelivery || address !== '');

  if(!ready){
    btn.setAttribute('aria-disabled','true');
    btn.style.opacity = '0.5';
    btn.href = '#monte';
    return;
  }
  btn.removeAttribute('aria-disabled');
  btn.style.opacity = '1';

  // ---- MENSAGEM DO WHATSAPP (edite aqui para mudar o texto enviado) ----
  let msg = 'Oi! Quero fazer esse pedido:\n\n';
  cart.forEach((item, index) => {
    msg += `Copo ${index + 1}: ${item.parts.join(', ')}\nSubtotal: ${fmt(item.total)}\n\n`;
  });
  msg += `${isDelivery ? 'Delivery (+ R$ 7,00)' : 'Retirada no local'}`;
  msg += `\n\nNome: ${name}`;
  if(isDelivery){
    msg += `\nEndereço: ${address}`;
    if(reference) msg += `\nPonto de referência: ${reference}`;
  }
  msg += `\n\nForma de pagamento: ${paymentChecked.value}`;
  if(paymentChecked.value === 'Pix'){
    msg += ` (chave: ${PIX_KEY})`;
  }
  if(paymentChecked.value === 'Dinheiro'){
    const trocoChecked = document.querySelector('input[name="troco-needed"]:checked');
    if(trocoChecked && trocoChecked.value === 'Sim'){
      const trocoValue = document.getElementById('troco-value').value.trim();
      msg += trocoValue ? `\nTroco para: R$ ${trocoValue}` : `\nPrecisa de troco`;
    } else if(trocoChecked && trocoChecked.value === 'Não'){
      msg += `\nNão precisa de troco`;
    }
  }
  if(notes) msg += `\n\nObservações: ${notes}`;
  msg += `\n\nTotal: ${fmt(total)}`;
  // ------------------------------------------------------------------

  btn.href = 'https://wa.me/5511949360595?text=' + encodeURIComponent(msg);
}

// sobe até o início do cardápio (seleção de sabor) para montar um novo copo
function scrollToFlavorStart(){
  const target = document.getElementById('flavor-options').closest('.cat-block');
  if(target){
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}

document.querySelectorAll('input[name="flavor"]').forEach(inp => inp.addEventListener('change', onFlavorChange));

// ao escolher o tamanho, desce suavemente até o início dos acompanhamentos (Frutas)
const frutasBlock = document.querySelector('.opt-grid[data-cat="Frutas"]').closest('.cat-block');
document.querySelectorAll('#base-options input[name="size"]').forEach(inp => {
  inp.addEventListener('change', () => {
    recalcCurrentCup();
    setTimeout(() => {
      if(frutasBlock) frutasBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  });
});

document.getElementById('add-another-cup').addEventListener('click', () => {
  addCupToCart();
  scrollToFlavorStart();
});

document.getElementById('finish-cups').addEventListener('click', () => {
  addCupToCart();
  const deliverySection = document.getElementById('delivery-section');
  if(deliverySection){
    setTimeout(() => deliverySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 550);
  }
});

document.querySelectorAll('#delivery-options input, #customer-name, #customer-address, #customer-reference, #troco-value, #customer-notes').forEach(inp => inp.addEventListener('input', recalcGrandTotal));

// forma de pagamento: revela a caixa do Pix só quando essa opção é escolhida
const pixInfoWrapper = document.getElementById('pix-info-wrapper');
const trocoInfoWrapper = document.getElementById('troco-info-wrapper');
const trocoValueWrapper = document.getElementById('troco-value-wrapper');

function onPaymentChange(){
  const checked = document.querySelector('input[name="payment-method"]:checked');
  pixInfoWrapper.classList.toggle('reveal-open', !!checked && checked.value === 'Pix');
  trocoInfoWrapper.classList.toggle('reveal-open', !!checked && checked.value === 'Dinheiro');
  recalcGrandTotal();
}
document.querySelectorAll('input[name="payment-method"]').forEach(inp => inp.addEventListener('change', onPaymentChange));

function onTrocoNeededChange(){
  const trocoChecked = document.querySelector('input[name="troco-needed"]:checked');
  trocoValueWrapper.classList.toggle('reveal-open', !!trocoChecked && trocoChecked.value === 'Sim');
  recalcGrandTotal();
}
document.querySelectorAll('input[name="troco-needed"]').forEach(inp => inp.addEventListener('change', onTrocoNeededChange));

// botão de copiar a chave Pix
const copyPixBtn = document.getElementById('copy-pix-btn');
copyPixBtn.addEventListener('click', async () => {
  const restoreLabel = () => { copyPixBtn.textContent = '📋 Copiar'; };
  try{
    await navigator.clipboard.writeText(PIX_KEY);
  }catch(err){
    // fallback para navegadores sem suporte à Clipboard API
    const temp = document.createElement('textarea');
    temp.value = PIX_KEY;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  }
  copyPixBtn.textContent = '✅ Copiado!';
  setTimeout(restoreLabel, 2000);
});

recalcCurrentCup();
renderCart();
recalcGrandTotal();

// ---------- Modal "Horários, endereço e mais" ----------
const storeInfoModal = document.getElementById('store-info-modal');
const openStoreInfoBtn = document.getElementById('open-store-info');
const closeStoreInfoBtn = document.getElementById('close-store-info');

function openStoreModal(){
  storeInfoModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeStoreModal(){
  storeInfoModal.classList.remove('open');
  document.body.style.overflow = '';
}
openStoreInfoBtn.addEventListener('click', openStoreModal);
closeStoreInfoBtn.addEventListener('click', closeStoreModal);
storeInfoModal.addEventListener('click', (e) => {
  if(e.target === storeInfoModal) closeStoreModal();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && storeInfoModal.classList.contains('open')) closeStoreModal();
});

// ---------- Busca de ingredientes dentro do cardápio ----------
const menuSearchInput = document.getElementById('menu-search');
const searchNoResults = document.getElementById('search-no-results');

menuSearchInput.addEventListener('input', () => {
  const query = menuSearchInput.value.trim().toLowerCase();
  let anyResultAtAll = false;

  document.querySelectorAll('.opt-grid').forEach(grid => {
    let anyVisibleInGrid = false;
    grid.querySelectorAll('.opt').forEach(optDiv => {
      const name = (optDiv.dataset.name || '').toLowerCase();
      const match = !query || name.includes(query);
      optDiv.style.display = match ? '' : 'none';
      if(match){
        anyVisibleInGrid = true;
        anyResultAtAll = true;
      }
    });
    const catBlock = grid.closest('.cat-block');
    if(catBlock) catBlock.style.display = anyVisibleInGrid ? '' : 'none';
  });

  searchNoResults.classList.toggle('show', query !== '' && !anyResultAtAll);
});
