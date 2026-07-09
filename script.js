const MENU = {
  sizes: [
    {name:'Copo 200ml', price:6.00},
    {name:'Copo 300ml', price:9.00},
    {name:'Copo 400ml', price:12.00},
    {name:'Copo 500ml', price:14.00},
    {name:'Copo 700ml', price:18.00},
    {name:'Tigela 300ml', price:10.00},
    {name:'Tigela 500ml', price:15.00},
    {name:'Barca individual', price:20.00},
    {name:'Marmita 1L', price:30.00}
  ],
  Frutas:[
    {name:'Abacaxi',price:2.50},{name:'Banana',price:2.50},{name:'Kiwi',price:3.50},
    {name:'Uva',price:2.50},{name:'Morango',price:3.50},
  ],
  Coberturas:[
    {name:'Cobertura chocolate',price:2.00},{name:'Cobertura morango',price:2.00},{name:'Cobertura caramelo',price:2.00},{name:'Mel',price:3.00},
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
    {name:'Mousse maracujá',price:4.00},{name:'Mousse morango',price:4.00},{name:'Mousse uva',price:4.00}
  ],
  Bebidas:[
    {name:'Água',price:2.50},
  ],
};

const FLAVORS = [
  { name: 'Açaí', emoji: '🫐', prices: { 'Copo 200ml': 6.00, 'Copo 300ml': 9.00, 'Copo 400ml': 12.00, 'Copo 500ml': 14.00, 'Copo 700ml': 18.00, 'Tigela 300ml': 10.00, 'Tigela 500ml': 15.00, 'Barca individual': 20.00, 'Marmita 1L': 30.00 } },
  { name: 'Cupuaçu', emoji: '🍈', prices: { 'Copo 200ml': 9.00, 'Copo 300ml': 13.50, 'Copo 400ml': 18.00, 'Copo 500ml': 22.00, 'Copo 700ml': 31.00, 'Tigela 300ml': 13.00, 'Tigela 500ml': 18.00 } },
  { name: 'Meio a meio', emoji: '◐', prices: { 'Copo 200ml': 7.50, 'Copo 300ml': 11.50, 'Copo 400ml': 15.00, 'Copo 500ml': 18.00, 'Copo 700ml': 24.50, 'Tigela 300ml': 11.50, 'Tigela 500ml': 16.50 } }
];

const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');

let cart = [];
let cartIdSeq = 1;

// render flavor radios
const flavorWrap = document.getElementById('flavor-options');
FLAVORS.forEach(flavor => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  chip.innerHTML = `<label><input type="radio" name="flavor" value="${flavor.name}"> <span class="opt-name">${flavor.emoji} ${flavor.name}</span></label>`;
  flavorWrap.appendChild(chip);
});

// render size radios
const baseWrap = document.getElementById('base-options');
MENU.sizes.forEach(item => {
  const chip = document.createElement('div');
  chip.className = 'radio-chip';
  chip.innerHTML = `<label><input type="radio" name="size" value="${item.name}" data-price="${item.price}"> <span class="opt-name">${item.name}</span> <span class="price">${fmt(item.price)}</span></label>`;
  baseWrap.appendChild(chip);
});

// render checkbox categories
['Frutas','Coberturas','Combinações','Chocolates','Extras','Bebidas'].forEach(cat => {
  const wrap = document.querySelector(`.opt-grid[data-cat="${cat}"]`);
  MENU[cat].forEach(item => {
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.innerHTML = `<label><input type="checkbox" value="${item.name}" data-price="${item.price}" data-cat="${cat}"> <span class="opt-name">${item.name}</span></label><span class="price">${fmt(item.price)}</span>`;
    wrap.appendChild(opt);
  });
});

const sizeWrapper = document.getElementById('size-wrapper');
const addCupBtn = document.getElementById('add-cup');
const cartBlock = document.getElementById('cart-block');
const cartList = document.getElementById('cart-list');

// atualiza os preços exibidos nos tamanhos conforme o sabor escolhido e esconde barca/marmita se necessário
function updatesizeprices(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  
  document.querySelectorAll('#base-options input[name="size"]').forEach(inp => {
    const sizename = inp.value;
    const chipWrapper = inp.closest('.radio-chip');
    
    if (flavorChecked) {
      const flavordata = FLAVORS.find(f => f.name === flavorChecked.value);
      
      if (flavordata && flavordata.prices[sizename] === undefined) {
        chipWrapper.style.display = 'none';
        inp.checked = false;
      } else {
        chipWrapper.style.display = 'flex';
        const finalprice = flavordata.prices[sizename];
        const pricespan = chipWrapper.querySelector('.price');
        if (pricespan) pricespan.textContent = fmt(finalprice);
      }
    } else {
      chipWrapper.style.display = 'flex';
      const pricespan = chipWrapper.querySelector('.price');
      if (pricespan) pricespan.textContent = fmt(parseFloat(inp.dataset.price));
    }
  });
}

function onFlavorChange(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  sizeWrapper.classList.toggle('reveal-open', !!flavorChecked);
  updatesizeprices();
  recalcCurrentCup();
}

// calcula o subtotal do copo sendo montado agora
function recalcCurrentCup(){
  let total = 0;
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const sizeChecked = document.querySelector('input[name="size"]:checked');

  if (flavorChecked && sizeChecked) {
    const flavordata = FLAVORS.find(f => f.name === flavorChecked.value);
    if (flavordata && flavordata.prices[sizeChecked.value] !== undefined) {
      total += flavordata.prices[sizeChecked.value];
    } else {
      total += parseFloat(sizeChecked.dataset.price);
    }
  }
  
  document.querySelectorAll('.opt-grid input[type="checkbox"]:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price);
  });

  document.getElementById('cup-subtotal').textContent = fmt(total);

  const ready = !!(flavorChecked && sizeChecked);
  addCupBtn.disabled = !ready;
}

function addCupToCart(){
  const flavorChecked = document.querySelector('input[name="flavor"]:checked');
  const sizeChecked = document.querySelector('input[name="size"]:checked');
  if(!flavorChecked || !sizeChecked) return;

  const parts = [`${flavorChecked.value} — ${sizeChecked.value}`];
  let total = 0;

  const flavordata = FLAVORS.find(f => f.name === flavorChecked.value);
  if (flavordata && flavordata.prices[sizeChecked.value] !== undefined) {
    total += flavordata.prices[sizeChecked.value];
  } else {
    total += parseFloat(sizeChecked.dataset.price);
  }

  document.querySelectorAll('.opt-grid input[type="checkbox"]:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price);
    parts.push(cb.value);
    cb.checked = false;
  });

  cart.push({ id: cartIdSeq++, parts, total });

  flavorChecked.checked = false;
  sizeChecked.checked = false;
  sizeWrapper.classList.remove('reveal-open');
  updatesizeprices();
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
    total += parseFloat(deliveryChecked.dataset.fee);
  }

  document.getElementById('total-val').textContent = fmt(total);
  const btn = document.getElementById('send-order');

  const name = document.getElementById('customer-name').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const reference = document.getElementById('customer-reference').value.trim();

  // condições para liberar o botão: carrinho com itens, nome preenchido,
  // e endereço preenchido SE for delivery (referência é sempre opcional)
  const ready = cart.length > 0 && name !== '' && (!isDelivery || address !== '');

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
  msg += `\nNome: ${name}`;
  if(isDelivery){
    msg += `\nEndereço: ${address}`;
    if(reference) msg += `\nPonto de referência: ${reference}`;
  }
  msg += `\n\nTotal: ${fmt(total)}`;
  // ------------------------------------------------------------------
  msg += '\n\nObrigado pela preferência!';
  btn.href = 'https://wa.me/5511949360595?text=' + encodeURIComponent(msg);
}

document.querySelectorAll('input[name="flavor"]').forEach(inp => inp.addEventListener('change', onFlavorChange));
document.querySelectorAll('#base-options input, .opt-grid input').forEach(inp => inp.addEventListener('input', recalcCurrentCup));
addCupBtn.addEventListener('click', addCupToCart);
document.querySelectorAll('#delivery-options input, #customer-name, #customer-address').forEach(inp => inp.addEventListener('input', recalcGrandTotal));

recalcCurrentCup();
renderCart();
recalcGrandTotal();

// hamburger menu
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');
menuToggle.addEventListener('click', () => {
  const isOpen = header.classList.toggle('nav-open');
  menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
});
mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
  const menuWasOpen = header.classList.contains('nav-open');
  header.classList.remove('nav-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');

  if (menuWasOpen) {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }
}));