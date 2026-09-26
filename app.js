const STORAGE_KEY = 'bgr_portfolio_state_v1';

const assets = [
  { symbol: 'BTC', name: 'Bitcoin', price: 68450, change: 2.4, history: [60, 62, 61, 64, 63, 68, 70, 69, 72, 74, 76, 79, 78, 81] },
  { symbol: 'ETH', name: 'Ethereum', price: 3520, change: 1.8, history: [48, 49, 51, 52, 50, 55, 57, 56, 58, 62, 61, 64, 67, 70] },
  { symbol: 'SOL', name: 'Solana', price: 168.4, change: 3.1, history: [36, 37, 38, 40, 39, 41, 43, 44, 42, 46, 48, 47, 52, 55] },
  { symbol: 'NVDA', name: 'NVIDIA', price: 126.2, change: -0.9, history: [44, 45, 43, 42, 41, 43, 40, 39, 38, 37, 36, 35, 34, 33] },
  { symbol: 'AAPL', name: 'Apple', price: 214.7, change: 0.6, history: [50, 52, 51, 48, 50, 49, 53, 54, 52, 55, 57, 58, 60, 59] },
];

const defaultPortfolio = {
  cash: 100000,
  positions: [
    { symbol: 'BTC', qty: 0.28, avgPrice: 65000 },
    { symbol: 'ETH', qty: 2.4, avgPrice: 3300 },
    { symbol: 'SOL', qty: 22, avgPrice: 150 },
  ],
};

const state = {
  activeTab: 'markets',
  orderSide: 'buy',
  portfolio: loadPortfolio(),
  selectedAsset: assets[0].symbol,
};

const marketGrid = document.getElementById('marketGrid');
const positionsList = document.getElementById('positionsList');
const portfolioValueEl = document.getElementById('portfolioValue');
const portfolioPnlEl = document.getElementById('portfolioPnl');
const portfolioChart = document.getElementById('portfolioChart');
const performanceTag = document.getElementById('performanceTag');
const assetSelect = document.getElementById('assetSelect');
const qtyInput = document.getElementById('qtyInput');
const orderPrice = document.getElementById('orderPrice');
const orderTotal = document.getElementById('orderTotal');
const orderForm = document.getElementById('orderForm');

function loadPortfolio() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return JSON.parse(JSON.stringify(defaultPortfolio));

  try {
    const parsed = JSON.parse(saved);
    return {
      cash: Number(parsed.cash ?? defaultPortfolio.cash),
      positions: Array.isArray(parsed.positions) ? parsed.positions : defaultPortfolio.positions,
    };
  } catch (error) {
    return JSON.parse(JSON.stringify(defaultPortfolio));
  }
}

function savePortfolio() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.portfolio));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(value) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function getAssetBySymbol(symbol) {
  return assets.find((asset) => asset.symbol === symbol) || assets[0];
}

function renderMarkets() {
  marketGrid.innerHTML = assets
    .map((asset) => {
      const isPositive = asset.change >= 0;
      const path = buildSparklinePath(asset.history);
      return `
        <article class="market-card" data-symbol="${asset.symbol}">
          <div>
            <div class="market-symbol">${asset.name}</div>
            <h3>${asset.symbol}</h3>
          </div>
          <div class="market-price">${formatCurrency(asset.price)}</div>
          <div class="market-delta ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${asset.change.toFixed(2)}%</div>
          <svg class="sparkline" viewBox="0 0 300 42" preserveAspectRatio="none">
            <path d="${path}" fill="none" stroke="${isPositive ? '#58e6a1' : '#ff6b6b'}" stroke-width="2.3" stroke-linecap="round" />
          </svg>
        </article>
      `;
    })
    .join('');
}

function buildSparklinePath(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 300;
      const y = 42 - ((value - min) / range) * 36 - 3;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function renderPortfolioSummary() {
  const total = state.portfolio.cash + computePositionsValue();
  const pnl = computePortfolioPnl();

  portfolioValueEl.textContent = formatCurrency(total);
  portfolioPnlEl.textContent = formatSignedCurrency(pnl);
  portfolioPnlEl.classList.toggle('gain', pnl >= 0);
  portfolioPnlEl.classList.toggle('loss', pnl < 0);

  const performancePct = total > 0 ? ((pnl / (total - pnl)) * 100) : 0;
  performanceTag.textContent = `${performancePct >= 0 ? '+' : ''}${performancePct.toFixed(2)}%`;
  performanceTag.classList.toggle('positive', performancePct >= 0);
  performanceTag.classList.toggle('negative', performancePct < 0);

  drawPortfolioChart();
}

function computePositionsValue() {
  return state.portfolio.positions.reduce((sum, position) => {
    const asset = getAssetBySymbol(position.symbol);
    return sum + position.qty * asset.price;
  }, 0);
}

function computePortfolioPnl() {
  return state.portfolio.positions.reduce((sum, position) => {
    const asset = getAssetBySymbol(position.symbol);
    const marketValue = position.qty * asset.price;
    const costBasis = position.qty * position.avgPrice;
    return sum + (marketValue - costBasis);
  }, 0);
}

function drawPortfolioChart() {
  const data = [];
  const points = 24;
  const total = computePositionsValue() + state.portfolio.cash;

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const wave = Math.sin(progress * 12) * 12;
    const drift = i * 1.2;
    const base = total * (0.78 + progress * 0.2);
    data.push(base + wave + drift);
  }

  const width = 340;
  const height = 130;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const line = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 12) - 6;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  portfolioChart.innerHTML = `
    <defs>
      <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(88,230,161,0.45)" />
        <stop offset="100%" stop-color="rgba(88,230,161,0.02)" />
      </linearGradient>
    </defs>
    <path d="${line} L ${width} ${height} L 0 ${height} Z" fill="url(#portfolioFill)" opacity="0.85"></path>
    <path d="${line}" fill="none" stroke="#58e6a1" stroke-width="2.5"></path>
  `;
}

function renderPositions() {
  const entries = state.portfolio.positions.map((position) => {
    const asset = getAssetBySymbol(position.symbol);
    const value = position.qty * asset.price;
    const delta = (asset.price - position.avgPrice) * position.qty;
    return `
      <div class="position-item">
        <div class="position-main">
          <strong>${position.symbol}</strong>
          <span class="position-meta">${position.qty.toFixed(2)} ${asset.symbol} · ${formatCurrency(position.avgPrice)} moy.</span>
        </div>
        <div class="position-value">
          <strong>${formatCurrency(value)}</strong>
          <span class="position-meta ${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${formatCurrency(delta)}</span>
        </div>
      </div>
    `;
  });

  positionsList.innerHTML = entries.join('');
}

function populateAssetSelect() {
  assetSelect.innerHTML = assets
    .map((asset) => `<option value="${asset.symbol}">${asset.symbol} · ${asset.name}</option>`)
    .join('');

  assetSelect.value = state.selectedAsset;
  syncOrderPrice();
}

function syncOrderPrice() {
  const asset = getAssetBySymbol(assetSelect.value || state.selectedAsset);
  orderPrice.value = formatCurrency(asset.price);
  updateOrderTotal();
}

function updateOrderTotal() {
  const asset = getAssetBySymbol(assetSelect.value || state.selectedAsset);
  const quantity = Number(qtyInput.value) || 0;
  const total = asset.price * quantity;
  orderTotal.textContent = formatCurrency(total);
}

function setActiveTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tab === tabName);
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
}

function handleOrderSubmit(event) {
  event.preventDefault();

  const assetSymbol = assetSelect.value;
  const symbol = getAssetBySymbol(assetSymbol);
  const qty = Number(qtyInput.value || 0);
  const side = state.orderSide;

  if (qty <= 0) {
    alert('La quantité doit être supérieure à 0.');
    return;
  }

  const totalCost = symbol.price * qty;

  if (side === 'buy' && totalCost > state.portfolio.cash) {
    alert('Solde insuffisant pour cet ordre.');
    return;
  }

  const existing = state.portfolio.positions.find((pos) => pos.symbol === assetSymbol);

  if (side === 'buy') {
    state.portfolio.cash -= totalCost;

    if (existing) {
      const totalQty = existing.qty + qty;
      existing.avgPrice = ((existing.avgPrice * existing.qty) + (symbol.price * qty)) / totalQty;
      existing.qty = totalQty;
    } else {
      state.portfolio.positions.push({ symbol: assetSymbol, qty, avgPrice: symbol.price });
    }
  } else {
    if (!existing || existing.qty < qty) {
      alert('Quantité indisponible pour cette vente.');
      return;
    }

    const proceeds = symbol.price * qty;
    state.portfolio.cash += proceeds;
    existing.qty -= qty;

    if (existing.qty <= 0) {
      state.portfolio.positions = state.portfolio.positions.filter((pos) => pos.symbol !== assetSymbol);
    }
  }

  savePortfolio();
  renderAll();
}

function updateMarketSimulation() {
  assets.forEach((asset) => {
    const drift = (Math.random() - 0.48) * 1.9;
    const nextPrice = Math.max(asset.price * (1 + drift / 100), 1);
    asset.price = Number(nextPrice.toFixed(2));

    asset.history.push(Number(nextPrice.toFixed(2)));
    if (asset.history.length > 14) {
      asset.history.shift();
    }

    const last = asset.history[asset.history.length - 1];
    const first = asset.history[0];
    asset.change = (((last - first) / first) * 100);
  });
}

function renderAll() {
  renderMarkets();
  renderPortfolioSummary();
  renderPositions();
  syncOrderPrice();
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.querySelectorAll('.order-type').forEach((button) => {
    button.addEventListener('click', () => {
      state.orderSide = button.dataset.side;
      document.querySelectorAll('.order-type').forEach((el) => el.classList.toggle('active', el.dataset.side === state.orderSide));
    });
  });

  assetSelect.addEventListener('change', () => {
    state.selectedAsset = assetSelect.value;
    syncOrderPrice();
  });

  qtyInput.addEventListener('input', updateOrderTotal);
  orderForm.addEventListener('submit', handleOrderSubmit);

  document.querySelectorAll('.market-card').forEach((card) => {
    card.addEventListener('click', () => {
      const symbol = card.dataset.symbol;
      assetSelect.value = symbol;
      state.selectedAsset = symbol;
      syncOrderPrice();
      setActiveTab('trading');
    });
  });
}

populateAssetSelect();
renderAll();
bindEvents();
setActiveTab('markets');

setInterval(() => {
  updateMarketSimulation();
  renderAll();
}, 1800);
