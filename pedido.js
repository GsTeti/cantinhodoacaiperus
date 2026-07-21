const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

const STEPS = [
  { key:'pending',    title:'Pedido enviado',        sub:'Aguardando a loja confirmar' },
  { key:'accepted',   title:'Pedido aceito',         sub:'A loja confirmou seu pedido' },
  { key:'preparing',  title:'Em preparo',            sub:'Seu açaí está sendo montado' },
  { key:'on_the_way', title:'A caminho',             sub:'Saiu para entrega' },
  { key:'delivered',  title:'Entregue',              sub:'Bom apetite! 🫐' },
];
const STEP_INDEX = { pending:0, accepted:1, preparing:2, on_the_way:3, delivered:4 };

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');
const content = document.getElementById('tracker-content');

if(!orderId){
  content.innerHTML = '<p class="empty-state">Pedido não encontrado.</p>';
} else {
  init();
}

async function init(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user){
    window.location.href = 'conta.html';
    return;
  }
  await loadOrder();
  supabase.channel('order-' + orderId)
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`id=eq.${orderId}` }, (payload) => {
      render(payload.new);
    })
    .subscribe();
}

async function loadOrder(){
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if(error || !data){
    content.innerHTML = '<p class="empty-state">Não foi possível encontrar esse pedido.</p>';
    return;
  }
  render(data);
}

function render(order){
  if(order.status === 'cancelled'){
  content.innerHTML = `
    <div class="tracker-card">
      <div class="tracker-status-big">
        <div class="emoji">😔</div>
        <h2>Pedido cancelado</h2>
        <p>${order.cancel_reason ? order.cancel_reason : 'Se isso for um engano, fale com a loja pelo WhatsApp.'}</p>
      </div>
    </div>`;
  return;
}

  const currentIndex = STEP_INDEX[order.status] ?? 0;
  const current = STEPS[currentIndex];
  const isPickup = order.delivery_type === 'Retirada';

  const stepsHtml = STEPS.map((step, i) => {
    let cls = '';
    if(i < currentIndex) cls = 'done';
    else if(i === currentIndex) cls = 'current';
    const icon = i < currentIndex ? '✓' : (i === currentIndex ? '●' : '');
    let title = step.title;
    let sub = step.sub;
    if(step.key === 'on_the_way'){
      if(isPickup){
        title = 'Pronto para retirar';
        sub = 'Pode vir buscar seu pedido na loja';
      } else if(order.eta_minutes && i <= currentIndex){
        sub = `Chegada estimada: ~${order.eta_minutes} min`;
      }
    }
    return `
      <div class="tracker-step ${cls}">
        <div class="tracker-step-dot">${icon}</div>
        <div class="tracker-step-text">
          <div class="tracker-step-title">${title}</div>
          <div class="tracker-step-sub">${sub}</div>
        </div>
      </div>`;
  }).join('');

  const cupsText = order.cups.map((c,i) => `Copo ${i+1}: ${c.parts.join(', ')} — ${fmt(c.total)}`).join('<br>');

  let bigTitle = current.title;
  let bigSub = current.sub;
  if(order.status === 'on_the_way'){
    if(isPickup){
      bigTitle = 'Pronto para retirar';
      bigSub = 'Pode vir buscar seu pedido na loja';
    } else if(order.eta_minutes){
      bigSub = `Chegada estimada: ~${order.eta_minutes} min`;
    }
  }

  content.innerHTML = `
    <div class="tracker-card">
      <div class="tracker-status-big">
        <div class="emoji">🫐</div>
        <h2>${bigTitle}</h2>
        <p>${bigSub}</p>
      </div>
      <div class="tracker-steps">${stepsHtml}</div>
      <div class="tracker-order-summary">
        ${cupsText}<br><br>
        <strong>Total: ${fmt(order.total)}</strong>
      </div>
    </div>`;
}