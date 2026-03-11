// ===== MERCADO PAGO MANAGER v4.0.0 - INTEGRAÇÃO DE PAGAMENTOS =====
// Gerencia pagamentos PIX e cartão físico via Mercado Pago

class MercadoPagoManager {
  constructor(app) {
    this.app = app;
    this.state = {
      initialized: false,
      currentPayment: null,
      paymentInProgress: false,
      lastPaymentId: null,
      retryCount: 0,
      maxRetries: 3
    };
    
    this.config = {
      publicKey: null,
      accessToken: null,
      environment: 'sandbox',
      prices: { cycle: 2000, currency: 'BRL' },
      timeouts: { 
        pix: 5 * 60 * 1000, 
        card: 2 * 60 * 1000, 
        polling: 3000, 
        maxPolling: 10 * 60 * 1000 
      },
      backend: {
        baseUrl: '/api/mercadopago',
        createPayment: '/create-payment',
        getPayment: '/payment',
        webhook: '/webhook',
        cardMachine: '/card-machine'
      },
      cardMachine: {
        enabled: true,
        provider: 'stone',
        endpoint: '/api/card-machine',
        pollInterval: 2000,
        maxWaitTime: 120000
      }
    };
    
    this.timers = new Map();
    this.paymentMethods = [];
    this.mp = null;
    
    this.init();
  }

  init() {
    this.loadConfiguration();
    this.addPaymentStyles();
    
    // Tenta carregar SDK do Mercado Pago
    this.loadMercadoPagoSDK().then(() => {
      this.state.initialized = true;
      Utils.log('MercadoPagoManager inicializado', 'success');
    }).catch(error => {
      Utils.log('Erro ao inicializar MercadoPago:', 'warn', error);
      // Continua funcionando sem SDK
    });
  }

  async loadMercadoPagoSDK() {
    return new Promise((resolve, reject) => {
      if (typeof MercadoPago !== 'undefined') {
        this.mp = new MercadoPago(this.config.publicKey || 'TEST-public-key');
        resolve();
        return;
      }
      
      // Se SDK não estiver carregado, simula funcionamento
      setTimeout(() => {
        Utils.log('SDK MercadoPago simulado', 'warn');
        resolve();
      }, 1000);
    });
  }

  loadConfiguration() {
    // Carrega configuração do PAYMENT_CONFIG global se disponível
    if (typeof PAYMENT_CONFIG !== 'undefined') {
      Object.assign(this.config, {
        prices: PAYMENT_CONFIG.prices || this.config.prices,
        timeout: PAYMENT_CONFIG.timeout || this.config.timeouts,
        methods: PAYMENT_CONFIG.methods || ['pix', 'card'],
        backend: PAYMENT_CONFIG.backend || this.config.backend
      });
    }
    
    // Define métodos de pagamento disponíveis
    this.paymentMethods = [
      {
        id: 'pix',
        name: 'PIX',
        icon: '📱',
        description: 'Pagamento instantâneo via QR Code',
        enabled: true
      },
      {
        id: 'card',
        name: 'Cartão',
        icon: '💳',
        description: 'Débito ou crédito na máquina física',
        enabled: this.config.cardMachine.enabled
      }
    ];
  }

  showPaymentModal() {
    if (this.state.paymentInProgress) {
      Utils.log('Pagamento já em progresso', 'warn');
      return;
    }
    
    const modal = this.createPaymentModal();
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('active'), 100);
    
    this.state.paymentInProgress = true;
    Utils.log('Modal de pagamento MercadoPago exibido', 'info');
  }

  createPaymentModal() {
    const modal = document.createElement('div');
    modal.className = 'mercadopago-modal';
    modal.innerHTML = `
      <div class="payment-content">
        <div class="payment-header">
          <h3>💳 Pagamento Mercado Pago</h3>
          <button class="payment-close">✕</button>
        </div>
        <div class="payment-price">
          <div class="price-label">Valor do ciclo de desinfecção:</div>
          <div class="price-value">${this.formatCurrency(this.config.prices.cycle)}</div>
        </div>
        <div class="payment-methods">
          ${this.createPaymentMethodsHTML()}
        </div>
      </div>
    `;

    this.setupPaymentModalEvents(modal);
    return modal;
  }

  createPaymentMethodsHTML() {
    return this.paymentMethods
      .filter(method => method.enabled)
      .map(method => `
        <div class="payment-method" data-method="${method.id}">
          <div class="payment-method-icon">${method.icon}</div>
          <div class="payment-method-info">
            <h4>${method.name}</h4>
            <p>${method.description}</p>
          </div>
        </div>
      `).join('');
  }

  setupPaymentModalEvents(modal) {
    modal.querySelector('.payment-close').addEventListener('click', () => this.closePaymentModal());
    modal.addEventListener('click', (e) => { 
      if (e.target === modal) this.closePaymentModal(); 
    });

    modal.querySelectorAll('.payment-method').forEach(method => {
      method.addEventListener('click', (e) => {
        const methodType = e.currentTarget.dataset.method;
        this.selectPaymentMethod(methodType, modal);
      });
    });
  }

  selectPaymentMethod(method, modal) {
    Utils.log(`Método de pagamento selecionado: ${method}`, 'info');
    
    switch (method) {
      case 'pix':
        this.initiatePIXPayment(modal);
        break;
      case 'card':
        this.initiateCardMachinePayment(modal);
        break;
      default:
        Utils.log(`Método não implementado: ${method}`, 'warn');
    }
  }

  async initiatePIXPayment(modal) {
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-header">
        <h3>📱 Pagamento PIX</h3>
        <button class="payment-close">✕</button>
      </div>
      <div class="payment-processing">
        <div class="payment-spinner"></div>
        <h4>Gerando código PIX...</h4>
      </div>
    `;

    try {
      // Simula criação do pagamento PIX
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pixPayment = await this.createPIXPayment();
      this.showPIXInterface(modal, pixPayment);
      
    } catch (error) {
      this.handlePaymentFailure(modal, 'PIX', error);
    }

    modal.querySelector('.payment-close').addEventListener('click', () => this.closePaymentModal());
  }

  async createPIXPayment() {
  try {
    const response = await fetch("/api/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "pix",
        amount: this.config.prices.cycle / 100 // valor em reais
      })
    });

    const data = await response.json();

    // O backend retorna init_point, sandbox_init_point e id
    // Para PIX, você pode usar o sandbox_init_point para abrir checkout
    // ou exibir o QR Code se estiver disponível
    return {
      id: data.id,
      qr_code: data.qr_code,               // imagem base64 oficial
      qr_code_base64: data.qr_code_base64, // código copiável
      sandbox_init_point: data.sandbox_init_point,
      status: "pending"
    };
  } catch (error) {
    console.error("❌ Erro ao criar pagamento PIX:", error);
    throw error;
  }
}

  showPIXInterface(modal, pixPayment) {
  const content = modal.querySelector('.payment-content');
  content.innerHTML = `
    <div class="payment-header">
      <h3>📱 Pagamento PIX</h3>
      <button class="payment-close">✕</button>
    </div>
    <div class="pix-section">
      <div class="pix-qr">
        <img src="${pixPayment.qr_code}" alt="QR Code PIX" style="width:200px;height:200px;" />
      </div>
      <h4>Escaneie o QR Code ou copie o código:</h4>
      <div class="pix-code">${pixPayment.qr_code_base64}</div>
      <button class="pix-copy-btn" onclick="navigator.clipboard?.writeText('${pixPayment.qr_code_base64}')">
        📋 Copiar Código PIX
      </button>
      <div class="payment-timer">
        <div class="timer-label">Tempo restante:</div>
        <div class="timer-value" id="pixTimer">05:00</div>
      </div>
    </div>
  `;

  this.state.currentPayment = pixPayment;
  this.startPIXTimer(modal);

  // Agora não usa mais Math.random: espera o WebSocket atualizar status
  modal.querySelector('.payment-close').addEventListener('click', () => this.closePaymentModal());
}

  startPIXTimer(modal) {
    let timeLeft = this.config.timeouts.pix / 1000;
    
    const timerInterval = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timerElement = modal.querySelector('#pixTimer');
      
      if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      timeLeft--;
      if (timeLeft < 0) {
        clearInterval(timerInterval);
        this.handlePaymentTimeout('PIX');
      }
    }, 1000);
    
    this.timers.set('pixTimer', timerInterval);
  }

  startPIXMonitoring(paymentId) {
    const checkInterval = setInterval(() => {
      // Simula verificação de status
      if (Math.random() < 0.3 && Date.now() % 10000 < 2000) {
        clearInterval(checkInterval);
        this.timers.delete('pixMonitoring');
        this.handlePaymentSuccess('PIX', paymentId);
      }
    }, 2000);
    
    this.timers.set('pixMonitoring', checkInterval);
  }

  async initiateCardMachinePayment(modal) {
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-header">
        <h3>💳 Pagamento Cartão</h3>
        <button class="payment-close">✕</button>
      </div>
      <div class="card-machine-section">
        <div class="payment-processing">
          <div class="payment-spinner"></div>
          <h4>Ativando máquina de cartão...</h4>
        </div>
      </div>
    `;

    try {
      await this.activateCardMachine();
      this.showCardMachineInterface(modal);
      
    } catch (error) {
      this.handlePaymentFailure(modal, 'Cartão', error);
    }

    modal.querySelector('.payment-close').addEventListener('click', () => this.closePaymentModal());
  }

  async activateCardMachine() {
    // Simula ativação da máquina de cartão
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      id: 'card_' + Utils.generateId(),
      status: 'waiting_card',
      provider: this.config.cardMachine.provider,
      amount: this.config.prices.cycle
    };
  }

  showCardMachineInterface(modal) {
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-header">
        <h3>💳 Máquina de Cartão</h3>
        <button class="payment-close">✕</button>
      </div>
      <div class="card-machine-section">
        <div class="card-machine-animation">💳</div>
        <div class="card-machine-instructions">
          <h4 style="color: var(--primary-light); margin-bottom: 15px;">Instruções:</h4>
          <ol style="text-align: left; color: var(--text-secondary); padding-left: 20px;">
            <li style="margin-bottom: 8px;">Insira ou aproxime seu cartão</li>
            <li style="margin-bottom: 8px;">Digite sua senha</li>
            <li style="margin-bottom: 8px;">Aguarde a confirmação</li>
          </ol>
        </div>
        <div class="payment-timer">
          <div class="timer-label">Tempo limite:</div>
          <div class="timer-value" id="cardTimer">02:00</div>
        </div>
      </div>
    `;

    this.animateCardMachine(modal);
    this.startCardTimer(modal);
    this.startCardMachineMonitoring();
  }

  animateCardMachine(modal) {
    const animation = modal.querySelector('.card-machine-animation');
    if (animation) {
      animation.style.cssText = `
        font-size: 4rem;
        margin: 20px 0;
        animation: pulse 2s infinite;
      `;
    }
  }

  startCardTimer(modal) {
    let timeLeft = this.config.timeouts.card / 1000;
    
    const timerInterval = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timerElement = modal.querySelector('#cardTimer');
      
      if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      timeLeft--;
      if (timeLeft < 0) {
        clearInterval(timerInterval);
        this.handlePaymentTimeout('Cartão');
      }
    }, 1000);
    
    this.timers.set('cardTimer', timerInterval);
  }

  startCardMachineMonitoring() {
    const checkInterval = setInterval(() => {
      // Simula verificação da máquina
      if (Math.random() < 0.4 && Date.now() % 15000 < 3000) {
        clearInterval(checkInterval);
        this.timers.delete('cardMachineMonitoring');
        this.handlePaymentSuccess('Cartão', 'CARD_' + Utils.generateId());
      }
    }, 2000);
    
    this.timers.set('cardMachineMonitoring', checkInterval);
  }

  handlePaymentSuccess(method, transactionId) {
    this.clearAllTimers();
    
    const modal = document.querySelector('.mercadopago-modal');
    if (!modal) return;
    
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-success">
        <div class="payment-success-icon">✅</div>
        <h3>Pagamento Aprovado!</h3>
        <p>Método: ${method}</p>
        <p>Transação: ${transactionId.substr(0, 8)}...</p>
        <p style="margin-top: 20px;">🤖 Iniciando ciclo...</p>
      </div>
    `;

    this.logPaymentEvent('payment_success', { method, transactionId });
    this.state.lastPaymentId = transactionId;
    
    setTimeout(() => {
      this.closePaymentModal();
      this.startCycleAfterPayment();
    }, 3000);
  }

  handlePaymentFailure(modal, method, error) {
    this.clearAllTimers();
    
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-error">
        <div class="payment-error-icon">❌</div>
        <h3>Erro no Pagamento</h3>
        <p>Método: ${method}</p>
        <p>Erro: ${error.message || 'Erro desconhecido'}</p>
        <button onclick="document.querySelector('.mercadopago-modal')?.remove()" 
                style="background: var(--danger-color); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 20px;">
          🔄 Tentar Novamente
        </button>
      </div>
    `;

    this.logPaymentEvent('payment_error', { method, error: error.message });
  }

  handlePaymentTimeout(method) {
    this.clearAllTimers();
    
    const modal = document.querySelector('.mercadopago-modal');
    if (!modal) return;
    
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-error">
        <div class="payment-error-icon">⏰</div>
        <h3>Tempo Esgotado</h3>
        <p>O pagamento via ${method} expirou.</p>
        <button onclick="document.querySelector('.mercadopago-modal')?.remove()" 
                style="background: var(--danger-color); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 20px;">
          🔄 Tentar Novamente
        </button>
      </div>
    `;

    this.logPaymentEvent('payment_timeout', { method });
  }

  startCycleAfterPayment() {
    if (this.app.startCycle) {
      this.app.startCycle();
    } else {
      Utils.log('Método startCycle não encontrado na app', 'warn');
    }
  }

  closePaymentModal() {
    this.clearAllTimers();
    this.state.paymentInProgress = false;
    
    const modal = document.querySelector('.mercadopago-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }

  logPaymentEvent(event, data) {
    const logData = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.app.state?.sessionId || 'unknown'
    };

    Utils.log(`Evento de pagamento: ${event}`, 'info', data);
    
    // Salva no sistema offline se disponível
    if (this.app.components?.offlineManager) {
      this.app.components.offlineManager.saveLog('payment_' + event, logData);
    }
  }

  addPaymentStyles() {
    if (document.getElementById('mercadopago-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'mercadopago-styles';
    styles.textContent = `
      .mercadopago-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center; z-index: 2000;
        opacity: 0; visibility: hidden; transition: all 0.3s ease;
      }
      .mercadopago-modal.active { opacity: 1; visibility: visible; }
      .payment-content {
        background: var(--bg-secondary); border: 1px solid var(--border-color);
        border-radius: var(--border-radius-xl); padding: var(--spacing-xl);
        max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
        transform: scale(0.9); transition: transform 0.3s ease;
      }
      .mercadopago-modal.active .payment-content { transform: scale(1); }
      .payment-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-md);
        border-bottom: 1px solid var(--border-color);
      }
      .payment-close {
        background: none; border: none; color: var(--text-secondary);
        font-size: var(--font-size-lg); cursor: pointer; width: 44px; height: 44px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        transition: var(--transition-fast);
      }
      .payment-close:hover { background: rgba(255, 255, 255, 0.1); color: var(--text-primary); }
      .payment-price {
        text-align: center; margin-bottom: var(--spacing-xl); padding: var(--spacing-lg);
        background: linear-gradient(135deg, var(--primary-blue), var(--primary-light));
        border-radius: var(--border-radius-lg); color: white;
      }
      .payment-price .price-value {
        font-size: var(--font-size-3xl); font-weight: 700;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
      .payment-methods { display: grid; gap: var(--spacing-md); margin-bottom: var(--spacing-xl); }
      .payment-method {
        padding: var(--spacing-lg); border: 2px solid var(--border-color);
        border-radius: var(--border-radius-lg); background: rgba(255, 255, 255, 0.05);
        cursor: pointer; transition: var(--transition-normal);
        display: flex; align-items: center; gap: var(--spacing-md); min-height: 60px;
      }
      .payment-method:hover {
        border-color: var(--primary-light); background: rgba(59, 130, 246, 0.1);
        transform: translateY(-2px);
      }
      .payment-method-icon { font-size: var(--font-size-2xl); width: 50px; text-align: center; }
      .payment-processing { text-align: center; padding: var(--spacing-xl); }
      .payment-spinner {
        width: 60px; height: 60px; border: 4px solid var(--border-color);
        border-top: 4px solid var(--primary-light); border-radius: 50%;
        animation: spin 1s linear infinite; margin: 0 auto var(--spacing-lg);
      }
      .pix-section, .card-machine-section { text-align: center; padding: var(--spacing-lg); }
      .pix-qr {
        width: 200px; height: 200px; background: white; border-radius: var(--border-radius-lg);
        margin: 0 auto var(--spacing-lg); display: flex; align-items: center;
        justify-content: center; font-size: 4rem; box-shadow: var(--shadow-card);
      }
      .pix-code {
        background: var(--bg-tertiary); padding: var(--spacing-md);
        border-radius: var(--border-radius-md); font-family: monospace;
        font-size: var(--font-size-sm); word-break: break-all;
        margin-bottom: var(--spacing-md); border: 1px solid var(--border-color);
      }
      .pix-copy-btn {
        background: var(--success-color); color: white; border: none;
        padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--border-radius-md);
        cursor: pointer; font-size: var(--font-size-sm); font-weight: 600;
        transition: var(--transition-fast); min-height: 44px;
      }
      .payment-timer {
        background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning-color);
        border-radius: var(--border-radius-md); padding: var(--spacing-md);
        margin-top: var(--spacing-lg); text-align: center;
      }
      .card-machine-instructions {
        background: rgba(59, 130, 246, 0.1); border: 1px solid var(--primary-light);
        border-radius: 12px; padding: 20px; margin-bottom: 20px;
      }
      .payment-success, .payment-error { text-align: center; padding: var(--spacing-xl); }
      .payment-success { color: var(--success-color); }
      .payment-error { color: var(--danger-color); }
      .payment-success-icon, .payment-error-icon { font-size: 4rem; margin-bottom: var(--spacing-lg); }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    `;
    
    document.head.appendChild(styles);
  }

  formatCurrency(cents) {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  }

  clearAllTimers() {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
  }

  // Métodos públicos
  isInitialized() {
    return this.state.initialized;
  }

  isPaymentInProgress() {
    return this.state.paymentInProgress;
  }

  getLastPaymentId() {
    return this.state.lastPaymentId;
  }

  destroy() {
    this.clearAllTimers();
    this.closePaymentModal();
    
    const styles = document.getElementById('mercadopago-styles');
    if (styles) styles.remove();
    
    Utils.log('MercadoPagoManager destruído', 'warn');
  }
}

// Disponibiliza globalmente

window.MercadoPagoManager = MercadoPagoManager;

