// ===== CLEAN HELMET CLIENT v4.0.0 - SISTEMA COMPLETO COM ESP32 =====
// Desenvolvido para tela touch 1280x800 com Firebase + Raspberry Pi + ESP32
// Sistema de pagamentos integrado (PIX + Cartão físico)
// Comunicação: Cliente → Firebase → Raspberry Pi → ESP32

// ===== CONFIGURAÇÕES GLOBAIS =====
const CONFIG = {
  version: '4.0.0',
  themes: ['dark', 'light', 'neon', 'ocean', 'sunset', 'forest', 'space', 'minimal'],
  cycleSteps: [
    { name: 'Oxi-Sanitização', duration: 120, icon: '💨', description: 'Eliminação de germes e bactérias' },
    { name: 'Neutralização', duration: 30, icon: '❄️', description: 'Resfriamento seguro do capacete' },
    { name: 'UV Germicida', duration: 90, icon: '🔆', description: 'Desinfecção por luz ultravioleta' },
    { name: 'Desodorização', duration: 60, icon: '🌿', description: 'Aplicação de fragrância fresh' }
  ],
  ads: { autoPlay: true, duration: 5000, fadeTime: 500 },
  volume: { default: 75, min: 0, max: 100 },
  loading: { timeout: 500, maxRetries: 3 },
  debug: true
};

const PAYMENT_CONFIG = {
  prices: { cycle: 2000, currency: 'BRL' }, // R$ 20,00
  timeout: { pix: 300000, card: 60000 }, // PIX: 5min, Cartão: 1min
  methods: ['pix', 'card'],
  physicalMachine: { enabled: true, endpoint: '/api/card-machine', pollInterval: 2000 },
  backend: {
    baseUrl: '/api/mercadopago', // ⚠️ AJUSTAR PARA SEU BACKEND
  }
};

            const FIREBASE_CONFIG = {
              // 🔥 FIREBASE CONFIGURADO - MODO ONLINE ATIVO
              // Credenciais do projeto: cleanhelmet-e55b7
              // Status: CONECTADO AO FIREBASE REAL
              
              apiKey: "AIzaSyCO3ilDnLT2RjnFpzrIRBG1jxMrDppmEIA",
              authDomain: "cleanhelmet-e55b7.firebaseapp.com",
              databaseURL: "https://cleanhelmet-e55b7-default-rtdb.firebaseio.com",
              projectId: "cleanhelmet-e55b7",
              storageBucket: "cleanhelmet-e55b7.firebasestorage.app",
              messagingSenderId: "862264948080",
              appId: "1:862264948080:web:c45791659355e509634bb5",
              measurementId: null                             // Não fornecido (opcional)
              
              // ✅ FIREBASE ATIVO: Sistema sairá automaticamente do modo demo
              // 🚀 ESP32 + Raspberry Pi + Firebase totalmente integrados
            };

const demoAds = [
  {
    title: 'Clean Helmet Premium',
    description: 'Desinfecção profissional para motociclistas',
    image: '🏍️',
    gradient: 'linear-gradient(135deg, #1e3a8a, #3b82f6)'
  },
  {
    title: 'Tecnologia UV-C',
    description: 'Controle inteligente com sensores em tempo real',
    image: '🤖',
    gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)'
  },
  {
    title: 'Segurança Total',
    description: 'Monitoramento contínuo via Raspberry Pi',
    image: '🛡️',
    gradient: 'linear-gradient(135deg, #059669, #10b981)'
  },
  {
    title: 'Sistema Integrado',
    description: 'Firebase + Hardware em perfeita sintonia',
    image: '🔗',
    gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)'
  }
];

// ===== UTILITÁRIOS =====
const Utils = {
  log: (message, type = 'info', data = null) => {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}] Clean Helmet:`;
  
  switch (type) {
    case 'error': console.error(prefix, message, data); break;
    case 'warn': console.warn(prefix, message, data); break;
    case 'success': console.log(`%c${prefix} ${message}`, 'color: #10b981', data); break;
    default: console.log(prefix, message, data);
  }
  
  // 🆕 ADICIONAR ESTAS 5 LINHAS AQUI:
  // Log para sistema offline se disponível
  if (window.helmetMistApp?.components?.offlineManager) {
    window.helmetMistApp.components.offlineManager.saveLog(type, {
      message, data, timestamp: Date.now()
    });
  }
},

  generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),

  formatTime: (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  formatCurrency: (cents) => {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  },

  cleanObjectForFirebase: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          cleaned[key] = Utils.cleanObjectForFirebase(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  },

  safeLocalStorage: {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        Utils.log(`Erro ao ler localStorage [${key}]:`, 'error', error);
        return defaultValue;
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        Utils.log(`Erro ao salvar localStorage [${key}]:`, 'error', error);
        return false;
      }
    }
  }
};

// ===== CLASSE PRINCIPAL DA APLICAÇÃO =====
class CleanHelmetClientApp {
  constructor() {
    this.state = {
      initialized: false,
      currentTheme: 'dark',
      volume: CONFIG.volume.default,
      isFirstCycle: true, // 🆕 Primeiro ciclo é grátis
      currentAdIndex: 0,
      adsPlaying: true,
      
      sessionId: Utils.generateId()
    };
    
    this.timers = new Map();
    this.components = {};
    
    Utils.log('Inicializando Clean Helmet Client v4.0.0', 'success');
  }

  async init() {
    try {
      Utils.log('Iniciando componentes...');
      
      // 🆕 NOVOS COMPONENTES v4.0.0
if (typeof OfflineManager !== 'undefined') {
  this.components.offlineManager = new OfflineManager(this);
}
if (typeof SessionManager !== 'undefined') {
  this.components.sessionManager = new SessionManager(this);
}
if (typeof MercadoPagoManager !== 'undefined') {
  this.components.mercadoPagoManager = new MercadoPagoManager(this);
}
      
      // Inicializa componentes principais (síncronos)
      this.components.cycleManager = new ClientCycleManager(this);
      this.components.notificationManager = new NotificationManager();
      this.components.paymentManager = new PaymentManager(this);
      
      // Configura interface (síncrono)
      this.setupInterfaceControls();
      this.setupKeyboardShortcuts();
      this.setupSettingsModal();
      
      // Carrega configurações e inicializa anúncios (síncronos)
      this.loadSettings();
      this.initializeAds();
      this.updateUI();
      
      this.state.initialized = true;
      Utils.log('Interface inicializada!', 'success');
      
      // Inicializa Firebase em background (não bloqueia)
      this.initFirebaseWithTimeout().then(() => {
        Utils.log('Sistema completo Inicializado!', 'success');
      });
      
      this.showNotification('Sistema Clean Helmet Pronto!', 'success');
      
    } catch (error) {
      Utils.log('Erro na inicialização:', 'error', error);
      // Mesmo com erro, marca como inicializado para não travar
      this.state.initialized = true;
      this.showNotification('Sistema iniciado com limitações', 'warning');
    }
  }

  async initFirebaseWithTimeout() {
    try {
      this.components.firebaseManager = new FirebaseManager(this);
      
      // Timeout mais longo e melhor tratamento
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 3000)
      );

      await Promise.race([this.components.firebaseManager.init(), timeout]);
      
      // Aguarda um pouco para garantir que o estado foi definido
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verifica se realmente conectou (não está em modo demo)
      if (this.components.firebaseManager.state.demoMode) {
        Utils.log('🟡 Firebase em modo demo', 'warn');
        this.updateConnectionStatus('Modo Demo');
        this.showNotification('Sistema funcionando em modo demonstração', 'info');
      } else {
        Utils.log('🟢 Firebase Conectado!', 'success');
        this.updateConnectionStatus('Sistema Online');
        this.showNotification('🔥 Firebase conectado! Sistema completo ativo', 'success');
      }
      
    } catch (error) {
      Utils.log('Firebase indisponível, usando modo demo', 'warn', error);
      this.components.firebaseManager = null;
      this.updateConnectionStatus('Modo Demo');
      this.showNotification('Sistema funcionando em modo demonstração', 'info');
    }
  }

  // ===== CONFIGURAÇÃO DE CONTROLES =====
  setupInterfaceControls() {
    // Botão principal de início
    // NOVA VERSÃO MAIS RESPONSIVA:
const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (!this.state.initialized) {
      this.showNotification('Sistema ainda carregando...', 'warning');
      return;
    }
    
    // Feedback visual imediato
    startBtn.style.transform = 'scale(0.95)';
    startBtn.style.opacity = '0.8';
    setTimeout(() => {
      startBtn.style.transform = '';
      startBtn.style.opacity = '';
    }, 150);
    
    this.handleStartCycle();
  });
  
  // Adiciona suporte a touch
  startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    startBtn.click();
  });
}

    // Controles de tema e volume
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('volumeUp')?.addEventListener('click', () => this.adjustVolume(10));
    document.getElementById('volumeDown')?.addEventListener('click', () => this.adjustVolume(-10));

    // Controles de anúncios
    document.getElementById('adsPrev')?.addEventListener('click', () => this.previousAd());
    document.getElementById('adsNext')?.addEventListener('click', () => this.nextAd());
    document.getElementById('adsPlayPause')?.addEventListener('click', () => this.toggleAdsPlayback());

    // Intercepta botão "Novo Ciclo" na tela de conclusão
    document.addEventListener('click', (e) => {
      if (e.target.id === 'newCycleBtn') {
        e.preventDefault();
        e.stopPropagation();
        this.handleNewCycle();
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.state.initialized) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (!this.components.cycleManager.isRunning) {
            this.handleStartCycle();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.previousAd();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextAd();
          break;
        case 'KeyT':
          if (e.ctrlKey) {
            e.preventDefault();
            this.toggleTheme();
          }
          break;
        case 'Escape':
          this.closeSettings();
          break;
        // Simulação de sensor de porta ESP32 (apenas para teste)
        case 'KeyO': // O = Open
          if (e.ctrlKey && this.components.cycleManager.isRunning) {
            this.components.cycleManager.pauseByDoorSensor();
          }
          break;
        case 'KeyC': // C = Close
          if (e.ctrlKey && this.components.cycleManager.isPaused) {
            this.components.cycleManager.resumeByDoorSensor();
          }
          break;
      }
    });
  }

  setupSettingsModal() {
    document.getElementById('themeToggle')?.addEventListener('dblclick', () => this.openSettings());
    document.getElementById('closeSettings')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('themeSelect')?.addEventListener('change', (e) => this.changeTheme(e.target.value));
    document.getElementById('volumeSlider')?.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)));
    
    document.getElementById('settingsModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') this.closeSettings();
    });
  }

  // ===== CONTROLE DE CICLO =====
  handleStartCycle() {
  if (this.components.cycleManager.isRunning) {
    this.showNotification('Ciclo já está em execução!', 'warning');
    return;
  }

  if (this.state.isFirstCycle) {
    this.state.isFirstCycle = false;
    this.showNotification('🎉 Ciclo de demonstração iniciado!', 'success');
    this.startCycle();
  } else {
    // Ciclos subsequentes com pagamento
    this.initiatePaymentFlow();
  }
}

 // 🆕 Novo método para pagamentos (MercadoPago - novos componentes)
initiatePaymentFlow() {
  try {
    if (this.components.mercadoPagoManager && this.components.mercadoPagoManager.isInitialized()) {
      this.components.mercadoPagoManager.showPaymentModal();
      this.showNotification('💳 Selecione o método de pagamento', 'info');
    } else {
      // Fallback para PaymentManager existente
      this.initiatePaymentFlowFallback();
    }
  } catch (error) {
    this.showNotification('🔧 Modo desenvolvimento ativo - ciclo liberado', 'info');
    setTimeout(() => this.startCycle(), 2000);
  }
}

// Método fallback para PaymentManager existente
initiatePaymentFlowFallback() {
  if (this.components.cycleManager.isRunning) {
    this.showNotification('Ciclo já está em execução!', 'warning');
    return;
  }

  try {
    this.components.paymentManager.showPaymentModal();
    this.showNotification('💳 Selecione o método de pagamento para continuar', 'info');
  } catch (error) {
    Utils.log('Erro ao iniciar pagamento:', 'error', error);
    this.showNotification('❌ Sistema de pagamento temporariamente indisponível', 'error');
    
    // Modo desenvolvimento - permite pular pagamento
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setTimeout(() => {
        this.showNotification('🔧 Modo desenvolvimento: Ciclo liberado', 'warning');
        this.startCycle();
      }, 3000);
    }
  }
}

// Método público para iniciar ciclo (chamado após pagamento)
startCycle() {
  this.components.cycleManager.startCycle();
}
  
  handleNewCycle() {
    // Novos ciclos sempre requerem pagamento
    this.initiatePaymentFlow();
  }


  startCycle() {
    if (this.components.cycleManager.isRunning) {
      this.showNotification('Ciclo já está em execução!', 'warning');
      return;
    }

    this.components.cycleManager.startCycle();
    this.components.firebaseManager?.startCycle();
    this.showNotification('🤖 Ciclo iniciado! Comandos enviados', 'success');
  }

  // ===== GERENCIAMENTO DE TEMAS =====
  toggleTheme() {
    const currentIndex = CONFIG.themes.indexOf(this.state.currentTheme);
    const nextIndex = (currentIndex + 1) % CONFIG.themes.length;
    this.changeTheme(CONFIG.themes[nextIndex]);
  }

  changeTheme(theme) {
    document.body.classList.remove(`theme-${this.state.currentTheme}`);
    this.state.currentTheme = theme;
    
    if (theme !== 'dark') {
      document.body.classList.add(`theme-${theme}`);
    }
    
    this.updateThemeButton();
    this.saveSettings();
    this.showNotification(`Tema alterado para ${this.getThemeName(theme)}`, 'success');
  }

  getThemeName(theme) {
    const names = {
      dark: 'Dark Cyber', light: 'Light', neon: 'Neon', ocean: 'Ocean',
      sunset: 'Sunset', forest: 'Forest', space: 'Space', minimal: 'Minimal'
    };
    return names[theme] || theme;
  }

  updateThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    const icons = {
      dark: '🌙', light: '☀️', neon: '⚡', ocean: '🌊',
      sunset: '🌅', forest: '🌲', space: '🚀', minimal: '⚪'
    };
    if (themeBtn) themeBtn.textContent = icons[this.state.currentTheme] || '🌙';
  }

  
  // ===== GERENCIAMENTO DE ANÚNCIOS =====
  initializeAds() {
    this.createAdsSlides();
    this.createAdsDots();
    this.startAdsRotation();
  }

  createAdsSlides() {
    const container = document.getElementById('adsContainer');
    if (!container) return;
    
    container.innerHTML = '';

    demoAds.forEach((ad, index) => {
      const slide = document.createElement('div');
      slide.className = `ad-slide ${index === 0 ? 'active' : ''}`;
      slide.style.background = ad.gradient;
      
      // Verifica se é uma imagem URL ou ícone emoji
      // Verifica se é uma imagem URL ou ícone emoji (melhorado)
const isImageUrl = ad.image && (
  ad.image.startsWith('http') || 
  ad.image.includes('unsplash') ||
  ad.image.includes('.jpg') || 
  ad.image.includes('.jpeg') || 
  ad.image.includes('.png') || 
  ad.image.includes('.webp') || 
  ad.image.includes('.gif') ||
  ad.image.includes('imgur') ||
  ad.image.includes('cloudinary') ||
  ad.image.includes('firebase')
);
      
      slide.innerHTML = `
        <div class="ad-content">
          ${isImageUrl ? 
            `<div class="ad-image"><img src="${ad.image}" alt="${ad.title}"></div>` :
            `<div class="ad-image">${ad.image}</div>`
          }
          <h4>${ad.title}</h4>
          <p>${ad.description}</p>
        </div>
      `;
      container.appendChild(slide);
    });
  }

  createAdsDots() {
    const dotsContainer = document.getElementById('adsDots');
    if (!dotsContainer) return;
    
    dotsContainer.innerHTML = '';

    demoAds.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = `ads-dot ${index === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => this.goToAd(index));
      dotsContainer.appendChild(dot);
    });
  }

  startAdsRotation() {
    this.clearTimer('adsRotation');
    
    if (this.state.adsPlaying) {
      this.timers.set('adsRotation', setInterval(() => {
        this.nextAd();
      }, CONFIG.ads.duration));
    }
  }

  nextAd() {
    this.state.currentAdIndex = (this.state.currentAdIndex + 1) % demoAds.length;
    this.updateAdDisplay();
  }

  previousAd() {
    this.state.currentAdIndex = (this.state.currentAdIndex - 1 + demoAds.length) % demoAds.length;
    this.updateAdDisplay();
  }

  goToAd(index) {
    this.state.currentAdIndex = index;
    this.updateAdDisplay();
  }

  updateAdDisplay() {
    const slides = document.querySelectorAll('.ad-slide');
    const dots = document.querySelectorAll('.ads-dot');

    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === this.state.currentAdIndex);
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.state.currentAdIndex);
    });
  }

  toggleAdsPlayback() {
    this.state.adsPlaying = !this.state.adsPlaying;
    const btn = document.getElementById('adsPlayPause');
    if (btn) btn.textContent = this.state.adsPlaying ? '⏸️' : '▶️';
    
    if (this.state.adsPlaying) {
      this.startAdsRotation();
    } else {
      this.clearTimer('adsRotation');
    }
  }

  updateAdsFromFirebase(ads) {
    if (Array.isArray(ads) && ads.length > 0) {
      // Evita loop infinito - verifica se os anúncios realmente mudaram
      const currentTitles = demoAds.map(ad => ad.title).join(',');
      const newTitles = ads.map(ad => ad.title).join(',');
      
      if (currentTitles !== newTitles) {
        // Substitui os anúncios demo pelos do Firebase
        demoAds.splice(0, demoAds.length, ...ads);
        this.createAdsSlides();
        this.createAdsDots();
        this.showNotification('Anúncios atualizados do servidor', 'success');
        Utils.log('Anúncios Firebase carregados:', 'success', ads);
      } else {
        Utils.log('Anúncios já estão atualizados', 'info');
      }
    } else {
      Utils.log('Nenhum anúncio ativo encontrado no Firebase', 'warn');
    }
  }

  // ===== CONFIGURAÇÕES =====
  openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.add('active');
      
      const themeSelect = document.getElementById('themeSelect');
      const volumeSlider = document.getElementById('volumeSlider');
      
      if (themeSelect) themeSelect.value = this.state.currentTheme;
      if (volumeSlider) volumeSlider.value = this.state.volume;
    }
  }

  closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
  }

  saveSettings() {
    const settings = {
      theme: this.state.currentTheme,
      volume: this.state.volume,
      adsPlaying: this.state.adsPlaying,
      isFirstCycle: this.state.isFirstCycle
    };
    Utils.safeLocalStorage.set('helmetmist-settings', settings);
  }

  loadSettings() {
    const settings = Utils.safeLocalStorage.get('helmetmist-settings', {});
    
    this.changeTheme(settings.theme || 'dark');
    this.setVolume(settings.volume || CONFIG.volume.default);
    this.state.adsPlaying = settings.adsPlaying !== false;
    this.state.isFirstCycle = settings.isFirstCycle !== false;
  }

  // ===== ATUALIZAÇÃO DA UI =====
  updateUI() {
    this.updateVolumeDisplay();
    this.updateThemeButton();
    this.updateConnectionStatus();
  }

  updateConnectionStatus(status = 'Sistema Online') {
    const indicator = document.getElementById('connectionStatus');
    const text = document.querySelector('.status-text');
    const modeValue = document.getElementById('modeValue');
    const modeInfo = document.getElementById('modeInfo');
    
    if (indicator) {
      indicator.className = status.includes('Demo') ? 'status-indicator offline' : 'status-indicator online';
    }
    if (text) text.textContent = status;
    
    // Atualiza o modo na interface
    if (modeValue && modeInfo) {
      if (status.includes('Demo')) {
        modeValue.textContent = 'DEMONSTRAÇÃO';
        modeInfo.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'; // Amarelo
      } else {
        modeValue.textContent = 'FIREBASE ONLINE';
        modeInfo.style.background = 'linear-gradient(135deg, #10b981, #059669)'; // Verde
      }
    }
  }

  // ===== NOTIFICAÇÕES =====
  showNotification(message, type = 'info') {
    this.components.notificationManager?.show(message, type);
  }

  // ===== LIMPEZA =====
  clearTimer(name) {
    if (this.timers.has(name)) {
      clearInterval(this.timers.get(name));
      this.timers.delete(name);
    }
  }

  destroy() {
    // Limpa todos os timers
    this.timers.forEach((timer, name) => {
      clearInterval(timer);
    });
    this.timers.clear();

    // Destroi componentes
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });

    Utils.log('Aplicação destruída', 'warn');
  }
}

// ===== GERENCIADOR DO CICLO DE DESINFECÇÃO =====
class ClientCycleManager {
  constructor(app) {
    this.app = app;
    this.state = {
      isRunning: false,
      isPaused: false,
      currentStep: 0,
      stepTimeRemaining: 0,
      startTime: null,
      sessionId: Utils.generateId()
    };
    this.stepTimer = null;
  }

  startCycle() {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentStep = 0;
    this.state.startTime = Date.now();
    
    this.showCycleInterface();
    this.updateCycleStatus('Executando');
    this.startStep(0);
    
    Utils.log('Ciclo iniciado - Comandos Enviados', 'success', { sessionId: this.state.sessionId });
  }

  startStep(stepIndex) {
    if (stepIndex >= CONFIG.cycleSteps.length) {
      this.completeCycle();
      return;
    }

    this.state.currentStep = stepIndex;
    const step = CONFIG.cycleSteps[stepIndex];
    this.state.stepTimeRemaining = step.duration;

    this.updateStepDisplay();
    this.app.showNotification(`🤖: Iniciando ${step.name}`, 'info');

    this.stepTimer = setInterval(() => {
      this.state.stepTimeRemaining--;
      this.updateStepProgress();

      if (this.state.stepTimeRemaining <= 0) {
        this.completeStep();
      }
    }, 1000);

    // Notifica Firebase → Raspberry Pi → ESP32
    this.app.components.firebaseManager?.startStep(stepIndex);
  }

  completeStep() {
    this.clearTimer();
    
    const stepElement = document.querySelector(`[data-step="${this.state.currentStep}"]`);
    if (stepElement) {
      stepElement.classList.add('completed');
      stepElement.classList.remove('active');
    }

    this.app.components.firebaseManager?.completeStep(this.state.currentStep);

    setTimeout(() => {
      this.startStep(this.state.currentStep + 1);
    }, 500);
  }

  completeCycle() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    
    this.updateCycleStatus('Concluído');
    this.showCompletionInterface();
    this.app.showNotification('✅ Desinfecção concluída! finalizou processo', 'success');
    
    this.generateReport();
    Utils.log('Ciclo concluído - ESP32 desativado', 'success', { sessionId: this.state.sessionId });
  }

  pauseByDoorSensor() {
    if (!this.state.isRunning || this.state.isPaused) return;

    this.state.isPaused = true;
    this.updateCycleStatus('Pausado - Porta Aberta');
    this.app.showNotification('🚪: Porta aberta! Processo pausado por segurança', 'warning');
    this.clearTimer();
  }

  resumeByDoorSensor() {
    if (!this.state.isRunning || !this.state.isPaused) return;

    this.state.isPaused = false;
    this.updateCycleStatus('Executando');
    this.app.showNotification('✅: Porta fechada! Processo retomado', 'success');
    
    this.stepTimer = setInterval(() => {
      this.state.stepTimeRemaining--;
      this.updateStepProgress();

      if (this.state.stepTimeRemaining <= 0) {
        this.completeStep();
      }
    }, 1000);
  }

  forceStop() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.clearTimer();
    this.updateCycleStatus('Interrompido');
    this.showStartInterface();
    this.resetStepsDisplay();
    Utils.log('Ciclo forçado a parar', 'warn');
  }

  // ===== INTERFACE =====
  showCycleInterface() {
    document.getElementById('startSection')?.classList.add('hidden');
    document.getElementById('cycleSteps')?.classList.remove('hidden');
    document.getElementById('safetyInfo')?.classList.remove('hidden');
    document.getElementById('completionSection')?.classList.add('hidden');
  }

  showCompletionInterface() {
    document.getElementById('startSection')?.classList.add('hidden');
    document.getElementById('cycleSteps')?.classList.add('hidden');
    document.getElementById('safetyInfo')?.classList.add('hidden');
    document.getElementById('completionSection')?.classList.remove('hidden');
  }

  showStartInterface() {
    document.getElementById('startSection')?.classList.remove('hidden');
    document.getElementById('cycleSteps')?.classList.add('hidden');
    document.getElementById('safetyInfo')?.classList.add('hidden');
    document.getElementById('completionSection')?.classList.add('hidden');
  }

  updateCycleStatus(status) {
    const statusElement = document.getElementById('cycleStatus');
    if (statusElement) {
      statusElement.textContent = status;
      statusElement.className = `cycle-status ${status.toLowerCase().replace(/\s+/g, '-')}`;
    }
  }

  updateStepDisplay() {
    document.querySelectorAll('.step-item').forEach(item => {
      item.classList.remove('active');
    });

    const currentStepElement = document.querySelector(`[data-step="${this.state.currentStep}"]`);
    if (currentStepElement) {
      currentStepElement.classList.add('active');
    }
  }

  updateStepProgress() {
    const stepElement = document.querySelector(`[data-step="${this.state.currentStep}"]`);
    if (!stepElement) return;

    const progressCircle = stepElement.querySelector('.progress-ring-circle');
    const progressText = stepElement.querySelector('.progress-text');
    const step = CONFIG.cycleSteps[this.state.currentStep];

    if (progressCircle && progressText) {
      // Calcula progresso circular
      const progress = 1 - (this.state.stepTimeRemaining / step.duration);
      const circumference = 2 * Math.PI * 25; // raio = 25
      const offset = circumference * (1 - progress);

      progressCircle.style.strokeDashoffset = offset;
      progressText.textContent = `${this.state.stepTimeRemaining}s`;
    }
  }

  resetStepsDisplay() {
    document.querySelectorAll('.step-item').forEach(item => {
      item.classList.remove('active', 'completed');
      
      const progressCircle = item.querySelector('.progress-ring-circle');
      const progressText = item.querySelector('.progress-text');
      const stepIndex = parseInt(item.dataset.step);
      const step = CONFIG.cycleSteps[stepIndex];

      if (progressCircle) progressCircle.style.strokeDashoffset = 157;
      if (progressText) progressText.textContent = `${step.duration}s`;
    });
  }

  generateReport() {
    const duration = Math.round((Date.now() - this.state.startTime) / 1000);
    const report = {
      timestamp: new Date().toISOString(),
      duration: duration,
      steps: CONFIG.cycleSteps.length,
      success: true,
      startTime: this.state.startTime,
      endTime: Date.now(),
      sessionId: this.state.sessionId,
      paymentId: this.app.components.paymentManager?.lastPaymentId || null,
      hardware: 'Confidencial'
    };

    Utils.log('Relatório do Ciclo ESP32:', 'success', report);
    Utils.safeLocalStorage.set('last-cycle-report', report);
    
    this.app.components.firebaseManager?.saveUsageStats(report);
  }

  clearTimer() {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  get isRunning() {
    return this.state.isRunning;
  }

  get isPaused() {
    return this.state.isPaused;
  }

  destroy() {
    this.clearTimer();
    Utils.log('CycleManager destruído', 'warn');
  }
}

// ===== GERENCIADOR DE NOTIFICAÇÕES =====
class NotificationManager {
  constructor() {
    this.container = document.getElementById('notifications');
    this.notifications = [];
    this.maxNotifications = 5;
  }

  show(message, type = 'info', duration = 5000) {
    if (!this.container) return;

    // Limita número de notificações
    if (this.notifications.length >= this.maxNotifications) {
      this.remove(this.notifications[0]);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <span class="notification-message">${message}</span>
      <button class="notification-close">✕</button>
    `;

    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Auto remove
    const autoRemoveTimer = setTimeout(() => {
      this.remove(notification);
    }, duration);

    // Click to remove
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn?.addEventListener('click', () => {
      clearTimeout(autoRemoveTimer);
      this.remove(notification);
    });

    notification.addEventListener('click', () => {
      clearTimeout(autoRemoveTimer);
      this.remove(notification);
    });
  }

  remove(notification) {
    if (notification.parentNode) {
      notification.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
        this.notifications = this.notifications.filter(n => n !== notification);
      }, 300);
    }
  }

  clear() {
    this.notifications.forEach(notification => {
      this.remove(notification);
    });
  }

  destroy() {
    this.clear();
    Utils.log('NotificationManager destruído', 'warn');
  }
}

// ===== SOCKET LISTENERS =====
function registerSocketListeners(onConnect, onDisconnect, onPaymentUpdate) {
  // Conecta ao backend via Socket.IO
  const socket = io(SERVER_URL, {
    transports: ['websocket'], // força uso de WebSocket
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000
  });

  // Evento de conexão
  socket.on('connect', () => {
    Utils.log("🔌 Conectado ao servidor de pagamentos: " + socket.id, "success");
    if (onConnect) onConnect(socket.id);
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    Utils.log("⚠️ Desconectado do servidor de pagamentos", "warn");
    if (onDisconnect) onDisconnect();
  });

  // Evento de atualização de pagamento
  socket.on('payment-status-update', (paymentData) => {
    Utils.log("💳 Atualização de pagamento recebida:", "info", paymentData);
    if (onPaymentUpdate) onPaymentUpdate(paymentData);
  });
}


// ===== SISTEMA DE PAGAMENTOS INTEGRADO =====
class PaymentManager {
  constructor(app) {
    this.app = app;
    this.state = {
      currentPayment: null,
      lastPaymentId: null
    };
    this.timers = new Map();
    
    this.init();
  }

  init() {
  this.addPaymentStyles();
  Utils.log('Sistema de pagamentos inicializado', 'success');

  // Listener global de pagamento
  registerSocketListeners(null, null, (paymentData) => {
    if (paymentData.status === "approved") {
      this.handlePaymentSuccess(document.querySelector('.payment-modal'), paymentData.method, paymentData.id);
    } else if (paymentData.status === "rejected") {
      this.handlePaymentTimeout(paymentData.method);
    }
  });
}

  addPaymentStyles() {
    if (document.getElementById('payment-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'payment-styles';
    styles.textContent = `
      .payment-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center; z-index: 2000;
        opacity: 0; visibility: hidden; transition: all 0.3s ease;
      }
      .payment-modal.active { opacity: 1; visibility: visible; }
      .payment-content {
        background: var(--bg-secondary); border: 1px solid var(--border-color);
        border-radius: var(--border-radius-xl); padding: var(--spacing-xl);
        max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
        transform: scale(0.9); transition: transform 0.3s ease;
      }
      .payment-modal.active .payment-content { transform: scale(1); }
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
      .payment-spinner {
        width: 60px; height: 60px; border: 4px solid var(--border-color);
        border-top: 4px solid var(--primary-light); border-radius: 50%;
        animation: spin 1s linear infinite; margin: 0 auto var(--spacing-lg);
      }
      .payment-success, .payment-error { text-align: center; padding: var(--spacing-xl); }
      .payment-success { color: var(--success-color); }
      .payment-error { color: var(--danger-color); }
      .payment-success-icon, .payment-error-icon { font-size: 4rem; margin-bottom: var(--spacing-lg); }
    `;
    document.head.appendChild(styles);
  }

  showPaymentModal() {
    const modal = this.createPaymentModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 100);
    Utils.log('Modal de pagamento exibido', 'info');
  }

  createPaymentModal() {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
      <div class="payment-content">
        <div class="payment-header">
          <h3>💳 Pagamento</h3>
          <button class="payment-close">✕</button>
        </div>
        <div class="payment-price">
          <div class="price-label">Valor do ciclo de desinfecção:</div>
          <div class="price-value">${Utils.formatCurrency(PAYMENT_CONFIG.prices.cycle)}</div>
        </div>
        <div class="payment-methods">
          <div class="payment-method" data-method="pix">
            <div class="payment-method-icon">📱</div>
            <div class="payment-method-info">
              <h4>PIX</h4>
              <p>Pagamento instantâneo via QR Code</p>
            </div>
          </div>
          <div class="payment-method" data-method="card">
            <div class="payment-method-icon">💳</div>
            <div class="payment-method-info">
              <h4>Cartão</h4>
              <p>Débito ou crédito na máquina física</p>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('.payment-close').addEventListener('click', () => this.closePaymentModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closePaymentModal(); });
    modal.querySelectorAll('.payment-method').forEach(method => {
      method.addEventListener('click', (e) => {
        const methodType = e.currentTarget.dataset.method;
        if (methodType === 'pix') this.initPixPayment(modal);
        else if (methodType === 'card') this.initCardPayment(modal);
      });
    });

    return modal;
  }

  async initPixPayment(modal) {
  const content = modal.querySelector('.payment-content');
  content.innerHTML = `
    <div class="payment-header"><h3>📱 PIX</h3><button class="payment-close">✕</button></div>
    <div class="payment-processing">
      <div class="payment-spinner"></div>
      <h4>Gerando código PIX...</h4>
    </div>
  `;

  try {
    const response = await fetch("https://server-hibrido-js-1.onrender.com/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "pix", amount: PAYMENT_CONFIG.prices.cycle })
    });
    const data = await response.json();

    content.innerHTML = `
      <div class="payment-header"><h3>📱 Pagamento PIX</h3><button class="payment-close">✕</button></div>
      <iframe src="${data.init_point}" style="width:100%;height:500px;border:none;"></iframe>
    `;

  } catch (error) {
    Utils.log("Erro ao iniciar pagamento PIX", "error", error);
  }
}

  async initCardPayment(modal) {
  const content = modal.querySelector('.payment-content');
  content.innerHTML = `
    <div class="payment-header"><h3>💳 Pagamento Cartão</h3><button class="payment-close">✕</button></div>
    <div class="payment-processing">
      <div class="payment-spinner"></div>
      <h4>Conectando à máquina de cartão...</h4>
    </div>
  `;

  try {
    const response = await fetch("https://server-hibrido-js-1.onrender.com/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "card", amount: PAYMENT_CONFIG.prices.cycle })
    });
    const data = await response.json();

    content.innerHTML = `
      <div class="payment-header"><h3>💳 Pagamento Cartão</h3><button class="payment-close">✕</button></div>
      <iframe src="${data.init_point}" style="width:100%;height:500px;border:none;"></iframe>
    `;

  } catch (error) {
    Utils.log("Erro ao iniciar pagamento Cartão", "error", error);
  }
}

  handlePaymentSuccess(modal, method, transactionId) {
    this.clearAllTimers();
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

    this.logPaymentSuccess(method, transactionId);
    setTimeout(() => {
      this.closePaymentModal();
      this.app.startCycle();
    }, 3000);
  }

  handlePaymentTimeout(method) {
    this.clearAllTimers();
    const modal = document.querySelector('.payment-modal');
    if (!modal) return;
    const content = modal.querySelector('.payment-content');
    content.innerHTML = `
      <div class="payment-error">
        <div class="payment-error-icon">⏰</div>
        <h3>Tempo Esgotado</h3>
        <p>O pagamento via ${method} expirou.</p>
        <button onclick="document.querySelector('.payment-modal')?.remove()" 
                style="background: var(--danger-color); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 20px;">
          🔄 Tentar Novamente
        </button>
      </div>
    `;
  }

  logPaymentSuccess(method, transactionId) {
    const paymentData = {
      id: transactionId,
      method: method,
      amount: PAYMENT_CONFIG.prices.cycle,
      currency: PAYMENT_CONFIG.prices.currency,
      timestamp: new Date().toISOString(),
      sessionId: this.app.state.sessionId,
      status: 'completed',
      hardware: 'Confidencial'
    };

    const payments = Utils.safeLocalStorage.get('payments', []);
    payments.push(paymentData);
    Utils.safeLocalStorage.set('payments', payments);

    this.app.components.firebaseManager?.log('payment_success', paymentData);
    this.state.lastPaymentId = transactionId;
    Utils.log('Pagamento registrado:', 'success', paymentData);
  }

  closePaymentModal() {
    this.clearAllTimers();
    const modal = document.querySelector('.payment-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }

  clearAllTimers() {
    this.timers.forEach((timer, name) => clearInterval(timer));
    this.timers.clear();
  }

  get lastPaymentId() { return this.state.lastPaymentId; }

  destroy() {
    this.clearAllTimers();
    const modal = document.querySelector('.payment-modal');
    if (modal) modal.remove();
    const styles = document.getElementById('payment-styles');
    if (styles) styles.remove();
    Utils.log('PaymentManager destruído', 'warn');
  }
}

// ===== GERENCIADOR FIREBASE + ESP32 =====
class FirebaseManager {
  constructor(app) {
    this.app = app;
    this.state = { connected: false, authenticated: false, user: null, demoMode: false };
    this.listeners = [];
  }

                async init() {
                try {
                  // Verifica se Firebase está disponível e configurado
                  if (typeof firebase === 'undefined') {
                    Utils.log('Firebase SDK não encontrado, usando modo demo', 'warn');
                    this.initDemo();
                    return;
                  }

                  // Verifica se as credenciais estão configuradas
                  if (!FIREBASE_CONFIG.apiKey || 
                      FIREBASE_CONFIG.apiKey === null || 
                      FIREBASE_CONFIG.apiKey === "SUA_API_AQUI" ||
                      !FIREBASE_CONFIG.projectId ||
                      FIREBASE_CONFIG.projectId === null ||
                      FIREBASE_CONFIG.projectId === "PROJECT_ID") {
                    Utils.log('❌ Firebase não configurado (credenciais inválidas), usando modo demo', 'warn');
                    Utils.log('Credenciais encontradas:', 'warn', {
                      apiKey: FIREBASE_CONFIG.apiKey ? 'Configurado' : 'Não configurado',
                      projectId: FIREBASE_CONFIG.projectId ? 'Configurado' : 'Não configurado'
                    });
                    this.initDemo();
                    return;
                  }

                  Utils.log('🔍 Credenciais Firebase encontradas, tentando conectar...', 'info');
                  Utils.log('Projeto:', 'info', FIREBASE_CONFIG.projectId);

                  // Inicializa Firebase
                  if (!firebase.apps.length) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                  }

      this.database = firebase.database();
      this.auth = firebase.auth();

      // Autentica anonimamente (com timeout mais longo)
      const authPromise = this.authenticate();
      const authTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      );
      
      await Promise.race([authPromise, authTimeout]);
      
      // Marca como conectado ANTES de configurar listeners
      this.state.demoMode = false;
      this.state.connected = true;
      Utils.log('🟢 Sistema conectado com sucesso!', 'success');
      Utils.log('✅ Modo online ativo - Todas as funcionalidades disponíveis', 'success');
      
      // Configura listeners em background para não travar
      setTimeout(() => {
        this.setupListeners();
      }, 100);

      // Carrega anúncios automaticamente
      this.loadAndUpdateAds();
      
    } catch (error) {
      Utils.log('Erro no Firebase, modo demo ativo:', 'warn', error);
      this.initDemo();
    }
  }

  initDemo() {
    this.state.demoMode = true;
    this.state.connected = false;
    Utils.log('🟡 Modo demo Firebase ativo', 'warn');
    Utils.log('Motivo: Credenciais não configuradas ou erro de conexão', 'warn');
    this.app.updateConnectionStatus('Modo Demo');
  }

  async authenticate() {
    try {
      const result = await this.auth.signInAnonymously();
      this.state.authenticated = true;
      this.state.user = result.user;
      Utils.log('Autenticação anônima OK:', 'success', { uid: result.user.uid });
      await this.testWritePermission();
    } catch (error) {
      Utils.log('Erro na autenticação:', 'error', error);
      throw error;
    }
  }

  async testWritePermission() {
    try {
      const testRef = this.database.ref('test_write');
      await testRef.set({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        user: this.state.user?.uid || 'anonymous'
      });
      await testRef.remove();
      Utils.log('Permissões de escrita OK', 'success');
    } catch (error) {
      Utils.log('Erro nas permissões:', 'error', error);
      throw error;
    }
  }

  setupListeners() {
    if (this.state.demoMode) return;
    try {
      // Sistema geral (Raspberry Pi + ESP32)
      const systemRef = this.database.ref('system');
      const systemListener = systemRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) this.updateSystemStatus(data);
      });
      this.listeners.push({ ref: systemRef, listener: systemListener });

      // Sensores ESP32 em tempo real
      const sensorsRef = this.database.ref('sensors');
      const sensorsListener = sensorsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) this.updateSensorData(data);
      });
      this.listeners.push({ ref: sensorsRef, listener: sensorsListener });

      // Hardware status (ESP32 + relés)
      const hardwareRef = this.database.ref('hardware');
      const hardwareListener = hardwareRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) this.updateHardwareStatus(data);
      });
      this.listeners.push({ ref: hardwareRef, listener: hardwareListener });

      // Anúncios (do painel admin)
      const adsRef = this.database.ref('anuncios');
      const adsListener = adsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const ads = this.convertAnunciosToAds(data);
          if (ads.length > 0) this.app.updateAdsFromFirebase(ads);
        }
      });
      this.listeners.push({ ref: adsRef, listener: adsListener });

      // Pagamentos aprovados
      const paymentsRef = this.database.ref('payments');
      const paymentsListener = paymentsRef.on('child_added', (snapshot) => {
        const payment = snapshot.val();
        if (payment && payment.status === 'approved') {
          this.handlePaymentUpdates(payment);
        }
      });
      this.listeners.push({ ref: paymentsRef, listener: paymentsListener });

      Utils.log('Listeners Firebase + ESP32 configurados', 'success');
    } catch (error) {
      Utils.log('Erro nos listeners:', 'error', error);
    }
  }

  // ===== TRATAMENTO DE DADOS ESP32 =====
  
  updateSensorData(sensorData) {
    // Dados vindos do ESP32 via Raspberry Pi
    const {
      door_sensor,
      temperature,
      humidity,
      ozone_level,
      uv_intensity,
      air_flow,
      fragrance_level
    } = sensorData;

    // Sensor de porta (crítico para segurança)
    if (door_sensor !== undefined) {
      const isDoorOpen = door_sensor === 'open' || door_sensor === true;
      
      if (isDoorOpen && this.app.components.cycleManager.isRunning) {
        this.app.components.cycleManager.pauseByDoorSensor();
        this.app.showNotification('🚨 : Porta aberta! Ciclo pausado por segurança', 'warning');
      } else if (!isDoorOpen && this.app.components.cycleManager.isPaused) {
        this.app.components.cycleManager.resumeByDoorSensor();
        this.app.showNotification('✅: Porta fechada! Ciclo retomado', 'success');
      }
    }

    // Monitoramento de temperatura (alertas)
    if (temperature !== undefined) {
      if (temperature > 45) {
        this.app.showNotification('🌡️: Temperatura alta detectada!', 'warning');
      } else if (temperature < 10) {
        this.app.showNotification('🧊: Temperatura muito baixa!', 'warning');
      }
    }

    // Nível de ozônio (segurança)
    if (ozone_level !== undefined && ozone_level > 0.1) {
      this.app.showNotification('💨: Nível de ozônio adequado', 'info');
    }

    // Intensidade UV
    if (uv_intensity !== undefined && uv_intensity > 80) {
      this.app.showNotification('🔆: Lâmpadas UV funcionando corretamente', 'success');
    }

    // Log dos sensores para debug
    Utils.log('Dados dos sensores:', 'info', {
      door: door_sensor,
      temp: temperature + '°C',
      humidity: humidity + '%',
      ozone: ozone_level,
      uv: uv_intensity,
      airflow: air_flow,
      fragrance: fragrance_level
    });
  }

  updateHardwareStatus(hardwareData) {
    // Status dos relés e atuadores ESP32
    const {
      relays,
      fans,
      pumps,
      lamps,
      system_voltage,
      esp32_status,
      last_command_executed
    } = hardwareData;

    // Status do ESP32
    if (esp32_status) {
      if (esp32_status === 'online') {
        Utils.log('ESP32 online e funcionando', 'success');
      } else if (esp32_status === 'error') {
        this.app.showNotification('⚠️ Erro no ESP32 detectado!', 'error');
      }
    }

    // Monitoramento de voltagem
    if (system_voltage && system_voltage < 11.5) {
      this.app.showNotification('🔋 ESP32: Voltagem baixa no sistema!', 'warning');
    }

    // Status dos relés
    if (relays) {
      const activeRelays = Object.entries(relays)
        .filter(([key, value]) => value === true)
        .map(([key]) => key);
      
      if (activeRelays.length > 0) {
        Utils.log('ESP32 - Relés ativos:', 'info', activeRelays);
      }
    }

    // Último comando executado
    if (last_command_executed) {
      Utils.log('ESP32 - Último comando:', 'info', last_command_executed);
    }
  }

  updateSystemStatus(data) {
    // Status geral do sistema (Raspberry Pi + ESP32)
    const {
      door_sensor,
      cycle_active,
      current_step,
      esp32_connected,
      raspberry_pi_status,
      system_errors
    } = data;

    // Conexão ESP32
    if (esp32_connected === false) {
      this.app.showNotification('📡 ESP32 desconectado do Raspberry Pi!', 'error');
      this.app.updateConnectionStatus('ESP32 Offline');
    } else if (esp32_connected === true) {
      Utils.log('ESP32 conectado ao Raspberry Pi', 'success');
      this.app.updateConnectionStatus('Sistema Online + ESP32');
    }

    // Status do Raspberry Pi
    if (raspberry_pi_status) {
      Utils.log('Status Raspberry Pi:', 'info', raspberry_pi_status);
    }

    // Erros do sistema
    if (system_errors && system_errors.length > 0) {
      system_errors.forEach(error => {
        this.app.showNotification(`🚨 Erro ESP32: ${error.message}`, 'error');
      });
    }

    // Sincronização do ciclo ativo
    if (cycle_active !== undefined) {
      const isRunning = this.app.components.cycleManager.isRunning;
      
      if (cycle_active && !isRunning) {
        // Hardware diz que está ativo, mas interface não sabe
        Utils.log('Sincronizando: ciclo ativo no ESP32', 'warn');
      } else if (!cycle_active && isRunning) {
        // Interface diz que está ativo, mas hardware parou
        Utils.log('Sincronizando: ciclo parado no ESP32', 'warn');
        this.app.components.cycleManager.forceStop();
      }
    }

    // Porta (tratado também em updateSensorData, mas duplicado por segurança)
    if (door_sensor !== undefined) {
      const isDoorOpen = door_sensor === 'open' || door_sensor === true;
      
      if (isDoorOpen && this.app.components.cycleManager.isRunning) {
        this.app.components.cycleManager.pauseByDoorSensor();
      } else if (!isDoorOpen && this.app.components.cycleManager.isPaused) {
        this.app.components.cycleManager.resumeByDoorSensor();
      }
    }
  }

  async sendCommand(command, data = {}) {
    if (this.state.demoMode) {
      Utils.log(`[DEMO] Comando ESP32: ${command}`, 'warn', data);
      return;
    }

    try {
      const commandData = Utils.cleanObjectForFirebase({
        command,
        data,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        sessionId: this.app.state.sessionId,
        source: 'client'
      });

      const commandsRef = this.database.ref('commands').push();
      await commandsRef.set(commandData);
      
      Utils.log(`Comando ESP32 enviado: ${command}`, 'success', data);
      
    } catch (error) {
      Utils.log(`Erro ao enviar comando ESP32 ${command}:`, 'error', error);
    }
  }

  // ===== COMANDOS ESPECÍFICOS PARA ESP32 =====
  
  // Comandos para ESP32 via Raspberry Pi
  async startCycle() {
    await this.sendCommand('start_cycle', {
      sessionId: this.app.state.sessionId,
      steps: CONFIG.cycleSteps.length,
      hardware: {
        esp32_commands: [
          { action: 'activate_relay', relay: 'main_power', state: true },
          { action: 'read_sensors', sensors: ['door', 'temperature', 'humidity'] },
          { action: 'start_ventilation', speed: 'medium' }
        ]
      }
    });
  }

  async startStep(stepIndex) {
    const step = CONFIG.cycleSteps[stepIndex];
    
    // Comandos específicos por etapa para ESP32
    const esp32Commands = this.getESP32CommandsForStep(stepIndex);
    
    await this.sendCommand('start_step', {
      stepIndex,
      stepName: step.name,
      duration: step.duration,
      hardware: {
        esp32_commands: esp32Commands,
        expected_sensors: this.getExpectedSensorsForStep(stepIndex)
      }
    });
  }

  // Mapeia etapas para comandos ESP32
  getESP32CommandsForStep(stepIndex) {
    const stepCommands = {
      0: [ // Oxi-Sanitização
        { action: 'activate_relay', relay: 'ozone_generator', state: true },
        { action: 'set_fan_speed', fan: 'circulation', speed: 'high' },
        { action: 'monitor_sensors', sensors: ['ozone_level', 'temperature'] }
      ],
      1: [ // Resfriamento
        { action: 'activate_relay', relay: 'ozone_generator', state: false },
        { action: 'activate_relay', relay: 'cooling_fan', state: true },
        { action: 'set_fan_speed', fan: 'exhaust', speed: 'high' }
      ],
      2: [ // UV Germicida
        { action: 'activate_relay', relay: 'uv_lamps', state: true },
        { action: 'monitor_sensors', sensors: ['uv_intensity', 'temperature'] },
        { action: 'set_fan_speed', fan: 'circulation', speed: 'low' }
      ],
      3: [ // Desodorização
        { action: 'activate_relay', relay: 'fragrance_pump', state: true },
        { action: 'activate_relay', relay: 'uv_lamps', state: false },
        { action: 'set_fan_speed', fan: 'circulation', speed: 'medium' }
      ]
    };
    
    return stepCommands[stepIndex] || [];
  }

  // Define sensores esperados por etapa
  getExpectedSensorsForStep(stepIndex) {
    const expectedSensors = {
      0: ['ozone_level', 'door_sensor', 'temperature', 'humidity'],
      1: ['temperature', 'door_sensor', 'air_flow'],
      2: ['uv_intensity', 'temperature', 'door_sensor'],
      3: ['fragrance_level', 'temperature', 'door_sensor', 'humidity']
    };
    
    return expectedSensors[stepIndex] || ['door_sensor', 'temperature'];
  }

  async completeStep(stepIndex) {
    // Comandos de finalização para ESP32
    const cleanupCommands = this.getESP32CleanupCommands(stepIndex);
    
    await this.sendCommand('complete_step', {
      stepIndex,
      completedAt: Date.now(),
      hardware: {
        esp32_commands: cleanupCommands,
        sensors_final_reading: true
      }
    });
  }

  getESP32CleanupCommands(stepIndex) {
    const cleanupCommands = {
      0: [{ action: 'log_ozone_levels', timestamp: Date.now() }],
      1: [{ action: 'log_temperature_drop', timestamp: Date.now() }],
      2: [{ action: 'log_uv_exposure_time', timestamp: Date.now() }],
      3: [
        { action: 'activate_relay', relay: 'fragrance_pump', state: false },
        { action: 'log_fragrance_usage', timestamp: Date.now() }
      ]
    };
    
    return cleanupCommands[stepIndex] || [];
  }

  // Comando de parada de emergência para ESP32
  async emergencyStop() {
    await this.sendCommand('emergency_stop', {
      timestamp: Date.now(),
      reason: 'user_request',
      hardware: {
        esp32_commands: [
          { action: 'activate_relay', relay: 'all_relays', state: false },
          { action: 'emergency_ventilation', duration: 30 },
          { action: 'log_emergency_stop', timestamp: Date.now() }
        ]
      }
    });
  }

  // Comando específico para sensor de porta (ESP32)
  async doorOpened() {
    await this.sendCommand('door_opened', {
      timestamp: Date.now(),
      reason: 'sensor_triggered',
      hardware: {
        esp32_commands: [
          { action: 'pause_all_processes' },
          { action: 'activate_safety_mode' },
          { action: 'log_door_event', event: 'opened' }
        ]
      }
    });
  }

  async doorClosed() {
    await this.sendCommand('door_closed', {
      timestamp: Date.now(),
      reason: 'sensor_triggered',
      hardware: {
        esp32_commands: [
          { action: 'resume_processes' },
          { action: 'deactivate_safety_mode' },
          { action: 'log_door_event', event: 'closed' }
        ]
      }
    });
  }

  async log(event, data = {}) {
    if (this.state.demoMode) return;

    try {
      const logData = Utils.cleanObjectForFirebase({
        event,
        data,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        sessionId: this.app.state.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        hardware: 'ESP32 + Raspberry Pi'
      });

      await this.database.ref('logs').push(logData);
      
    } catch (error) {
      Utils.log('Erro ao salvar log:', 'error', error);
    }
  }

  async saveUsageStats(stats) {
    if (this.state.demoMode) return;

    try {
      const statsData = Utils.cleanObjectForFirebase({
        ...stats,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        version: CONFIG.version,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        paymentMethod: this.app.components.paymentManager?.lastPaymentId ? 'paid' : 'free',
        hardware: 'ESP32 + Raspberry Pi'
      });

      await this.database.ref('usage_stats').push(statsData);
      Utils.log('Estatísticas ESP32 salvas', 'success');
      
    } catch (error) {
      Utils.log('Erro ao salvar estatísticas:', 'error', error);
    }
  }

  async loadAndUpdateAds() {
    if (this.state.demoMode) return;

    try {
      const snapshot = await this.database.ref('anuncios').once('value');
      const data = snapshot.val();
      if (data) {
        const ads = this.convertAnunciosToAds(data);
        if (ads.length > 0) this.app.updateAdsFromFirebase(ads);
      }
    } catch (error) {
      Utils.log('Erro ao carregar anúncios:', 'error', error);
    }
  }

  convertPriority(prioridade) {
    const priorities = {
      'alta': 3,
      'high': 3,
      'media': 2,
      'medium': 2,
      'baixa': 1,
      'low': 1
    };
    return priorities[prioridade?.toLowerCase()] || 0;
  }

  convertAnunciosToAds(anunciosData) {
    const ads = [];
    const now = Date.now();
    
    Utils.log('Convertendo anúncios do Firebase:', 'info', anunciosData);
    
    Object.entries(anunciosData).forEach(([key, anuncio]) => {
      Utils.log(`Processando anúncio [${key}]:`, 'info', anuncio);
      
      if (!anuncio.ativo) {
        Utils.log(`Anúncio [${key}] inativo, pulando`, 'warn');
        return;
      }
      
      const startDate = anuncio.dataInicio ? new Date(anuncio.dataInicio).getTime() : 0;
      const endDate = anuncio.dataFim ? new Date(anuncio.dataFim).getTime() : Infinity;
      
      if (now < startDate || now > endDate) {
        Utils.log(`Anúncio [${key}] fora do período, pulando`, 'warn');
        return;
      }

              // Detecta se conteudo é URL de imagem ou texto
        const isImageUrl = anuncio.conteudo && (
          anuncio.conteudo.includes('http') || 
          anuncio.conteudo.includes('unsplash') ||
          anuncio.conteudo.includes('.jpg') ||
          anuncio.conteudo.includes('.png')
        );
        
        const convertedAd = {
          title: anuncio.titulo || 'Anúncio',
          description: isImageUrl ? 'Anúncio com imagem personalizada' : (anuncio.conteudo || 'Descrição não disponível'),
          image: isImageUrl ? anuncio.conteudo.replace(/['"]/g, '') : this.getAdIcon(anuncio.tipo || anuncio.categoria),
          gradient: this.getAdGradient(anuncio.tipo || anuncio.categoria),
          priority: this.convertPriority(anuncio.prioridade) || 0
        };
      
      Utils.log(`Anúncio [${key}] convertido:`, 'success', convertedAd);
      ads.push(convertedAd);
    });
    
    const sortedAds = ads.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    Utils.log('Anúncios finais ordenados:', 'success', sortedAds);
    
    return sortedAds;
  }

  getAdIcon(categoria) {
    const icons = { 
      capacete: '🏍️', 
      seguranca: '🛡️', 
      tecnologia: '🤖', 
      higiene: '🧼', 
      promocao: '🎉', 
      esp32: '🔌',
      servico: '⚙️',
      produto: '📦',
      oferta: '💰',
      evento: '📅',
      informacao: 'ℹ️',
      saude: '💊',
      limpeza: '🧽',
      manutencao: '🔧',
      novidade: '✨'
    };
    return icons[categoria?.toLowerCase()] || '📢';
  }

  getAdGradient(categoria) {
    const gradients = {
      capacete: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
      seguranca: 'linear-gradient(135deg, #059669, #10b981)',
      tecnologia: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
      esp32: 'linear-gradient(135deg, #dc2626, #f87171)',
      higiene: 'linear-gradient(135deg, #0891b2, #06b6d4)',
      promocao: 'linear-gradient(135deg, #f59e0b, #d97706)',
      servico: 'linear-gradient(135deg, #4338ca, #6366f1)',
      produto: 'linear-gradient(135deg, #0d9488, #14b8a6)',
      oferta: 'linear-gradient(135deg, #ea580c, #f97316)',
      evento: 'linear-gradient(135deg, #7c2d12, #a16207)',
      informacao: 'linear-gradient(135deg, #1e40af, #2563eb)',
      saude: 'linear-gradient(135deg, #be123c, #e11d48)',
      limpeza: 'linear-gradient(135deg, #0369a1, #0284c7)',
      manutencao: 'linear-gradient(135deg, #374151, #6b7280)',
      novidade: 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
    };
    return gradients[categoria?.toLowerCase()] || 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
  }

  handlePaymentUpdates(paymentData) {
    if (paymentData.status === 'approved' && paymentData.sessionId === this.app.state.sessionId) {
      this.app.showNotification('✅ Pagamento aprovado! Iniciando ciclo ESP32...', 'success');
      
      setTimeout(() => {
        this.app.components.paymentManager?.closePaymentModal();
        this.app.startCycle();
      }, 2000);
    }
  }

  disconnect() {
    this.listeners.forEach(({ ref, listener }) => ref.off('value', listener));
    this.listeners = [];
    if (!this.state.demoMode) this.auth.signOut().catch(() => {});
    this.state.connected = false;
    this.state.authenticated = false;
  }

  destroy() {
    this.disconnect();
    Utils.log('FirebaseManager + ESP32 destruído', 'warn');
  }
}

// ===== INICIALIZAÇÃO GLOBAL CORRIGIDA =====
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  // Função para remover loading
  const removeLoading = () => {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        if (loadingOverlay.parentNode) {
          loadingOverlay.remove();
        }
      }, 300);
    }
  };

  // Remove loading após timeout máximo (garante que nunca fica infinito)
  const maxLoadingTimeout = setTimeout(() => {
    Utils.log('Timeout de loading atingido, removendo overlay', 'warn');
    removeLoading();
  }, 2000); // Máximo 2 segundos

  try {
    Utils.log('Iniciando Clean Helmet Client v4.0.0 com ESP32...', 'info');
    
    // Inicializa aplicação
    window.helmetMistApp = new CleanHelmetClientApp();
    
    // Inicialização com timeout próprio
    const initPromise = window.helmetMistApp.init();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Init timeout')), 1500)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    
    Utils.log('=== CLEAN HELMET CLIENT v4.0.0 + ESP32 INICIADO ===', 'success');
    
    // Remove loading se ainda estiver presente
    clearTimeout(maxLoadingTimeout);
    removeLoading();
    
  } catch (error) {
    Utils.log('Erro na inicialização:', 'error', error);
    
    // Remove loading mesmo com erro
    clearTimeout(maxLoadingTimeout);
    removeLoading();
    
    // Tenta inicializar mesmo com erro
    if (!window.helmetMistApp) {
      window.helmetMistApp = new CleanHelmetClientApp();
      window.helmetMistApp.state.initialized = true;
      window.helmetMistApp.showNotification('Sistema iniciado com limitações', 'warning');
    }
  }
});

// ===== TRATAMENTO DE ERROS GLOBAIS =====
window.addEventListener('error', (event) => {
  Utils.log('Erro global capturado:', 'error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
  
  // Remove loading se ainda estiver presente
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  Utils.log('Promise rejeitada não tratada:', 'error', event.reason);
  
  // Remove loading se ainda estiver presente
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
});

// ===== OBJETO DEBUG PARA DESENVOLVIMENTO =====
window.DEBUG = {
  version: CONFIG.version,
  
  // Informações do sistema
  info: () => {
    return {
      version: CONFIG.version,
      initialized: window.helmetMistApp?.state.initialized || false,
      theme: window.helmetMistApp?.state.currentTheme || 'unknown',
      volume: window.helmetMistApp?.state.volume || 0,
      isRunning: window.helmetMistApp?.components.cycleManager?.isRunning || false,
      isPaused: window.helmetMistApp?.components.cycleManager?.isPaused || false,
      firebaseConnected: window.helmetMistApp?.components.firebaseManager?.state.connected || false,
      demoMode: window.helmetMistApp?.components.firebaseManager?.state.demoMode || false,
      sessionId: window.helmetMistApp?.state.sessionId || 'unknown',
      hardware: 'ESP32 + Raspberry Pi'
    };
  },
  
 // ADICIONAR ESTA FUNÇÃO NO OBJETO DEBUG:
checkComponents: () => {
  const components = {
    'App Principal': typeof window.helmetMistApp !== 'undefined',
    'CycleManager': window.helmetMistApp?.components?.cycleManager ? '✅' : '❌',
    'NotificationManager': window.helmetMistApp?.components?.notificationManager ? '✅' : '❌',
    'PaymentManager': window.helmetMistApp?.components?.paymentManager ? '✅' : '❌',
    'FirebaseManager': window.helmetMistApp?.components?.firebaseManager ? '✅' : '❌',
    'OfflineManager': typeof OfflineManager !== 'undefined' ? '✅ Classe' : '❌ Não carregado',
    'SessionManager': typeof SessionManager !== 'undefined' ? '✅ Classe' : '❌ Não carregado',
    'MercadoPagoManager': typeof MercadoPagoManager !== 'undefined' ? '✅ Classe' : '❌ Não carregado',
    'Firebase SDK': typeof firebase !== 'undefined' ? '✅' : '❌'
  };
  
  console.table(components);
  Utils.log('🔧 Status dos componentes verificado', 'info');
  return components;
},
  
  // Testa o ciclo
  testCycle: () => {
    if (window.helmetMistApp?.components.cycleManager) {
      window.helmetMistApp.startCycle();
      Utils.log('Ciclo de teste ESP32 iniciado', 'success');
    } else {
      Utils.log('CycleManager não disponível', 'error');
    }
  },
  
  // Verifica estado
  checkState: () => {
    console.table(DEBUG.info());
  },
  
  // Testa pagamento
  testPayment: () => {
    if (window.helmetMistApp?.components.paymentManager) {
      window.helmetMistApp.components.paymentManager.showPaymentModal();
      Utils.log('Modal de pagamento de teste exibido', 'success');
    } else {
      Utils.log('PaymentManager não disponível', 'error');
    }
  },
  
                // Testa autenticação Firebase
              testAuth: async () => {
                if (window.helmetMistApp?.components.firebaseManager) {
                  const manager = window.helmetMistApp.components.firebaseManager;
                  Utils.log('Estado Firebase:', 'info', {
                    connected: manager.state.connected,
                    authenticated: manager.state.authenticated,
                    demoMode: manager.state.demoMode,
                    user: manager.state.user?.uid || null
                  });
                } else {
                  Utils.log('FirebaseManager não disponível', 'error');
                }
              },

              // Verifica configuração Firebase
              checkFirebaseConfig: () => {
                Utils.log('Configuração Firebase:', 'info', {
                  apiKey: FIREBASE_CONFIG.apiKey ? '✅ Configurado' : '❌ Não configurado',
                  projectId: FIREBASE_CONFIG.projectId ? '✅ Configurado' : '❌ Não configurado',
                  authDomain: FIREBASE_CONFIG.authDomain ? '✅ Configurado' : '❌ Não configurado',
                  databaseURL: FIREBASE_CONFIG.databaseURL ? '✅ Configurado' : '❌ Não configurado',
                  status: (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === null) ? 'MODO DEMO' : 'CONFIGURADO'
                });
                
                // Status atual do sistema
                const manager = window.helmetMistApp?.components?.firebaseManager;
                if (manager) {
                  Utils.log('Status atual:', 'info', {
                    connected: manager.state.connected,
                    demoMode: manager.state.demoMode,
                    authenticated: manager.state.authenticated
                  });
                } else {
                  Utils.log('FirebaseManager não inicializado', 'warn');
                }
              },

              // Força reconexão Firebase
              reconnectFirebase: async () => {
                if (window.helmetMistApp) {
                  Utils.log('Tentando reconectar Firebase...', 'info');
                  try {
                    await window.helmetMistApp.initFirebaseWithTimeout();
                    Utils.log('Reconexão concluída', 'success');
                  } catch (error) {
                    Utils.log('Erro na reconexão:', 'error', error);
                  }
                }
              },

              // Força modo online (se Firebase estiver funcionando)
              forceOnlineMode: () => {
                const manager = window.helmetMistApp?.components?.firebaseManager;
                if (manager && manager.state.authenticated) {
                  Utils.log('🔧 Forçando modo online...', 'warn');
                  manager.state.demoMode = false;
                  manager.state.connected = true;
                  window.helmetMistApp.updateConnectionStatus('Sistema Online + ESP32');
                  window.helmetMistApp.showNotification('🔧 Modo online forçado!', 'success');
                  Utils.log('✅ Modo online ativado manualmente', 'success');
                } else {
                  Utils.log('❌ Não é possível forçar - Firebase não autenticado', 'error');
                }
              },

              // Mostra anúncios atuais na interface
              showCurrentAds: () => {
                Utils.log('🔍 Anúncios atuais na interface:', 'info');
                const slides = document.querySelectorAll('.ad-slide');
                Utils.log(`Total de slides: ${slides.length}`, 'info');
                
                slides.forEach((slide, index) => {
                  const title = slide.querySelector('h4')?.textContent;
                  const desc = slide.querySelector('p')?.textContent;
                  const image = slide.querySelector('.ad-image')?.textContent;
                  const background = slide.style.background;
                  
                  Utils.log(`Slide ${index}:`, 'info', {
                    title,
                    description: desc,
                    image,
                    background
                  });
                });
                
                Utils.log('Array demoAds atual:', 'info', demoAds);
              },

              // Testa carregamento de anúncios do Firebase
              testFirebaseAds: async () => {
                const manager = window.helmetMistApp?.components?.firebaseManager;
                if (manager && !manager.state.demoMode) {
                  Utils.log('🔍 Testando carregamento de anúncios do Firebase...', 'info');
                  try {
                    const snapshot = await manager.database.ref('anuncios').once('value');
                    const data = snapshot.val();
                    Utils.log('📊 Dados brutos do Firebase:', 'info', data);
                    
                    if (data) {
                      // Mostra cada anúncio individualmente
                      Object.entries(data).forEach(([key, anuncio]) => {
                        Utils.log(`📋 Anúncio [${key}]:`, 'info', {
                          titulo: anuncio.titulo,
                          descricao: anuncio.descricao,
                          categoria: anuncio.categoria,
                          ativo: anuncio.ativo,
                          dataInicio: anuncio.dataInicio,
                          dataFim: anuncio.dataFim
                        });
                      });
                      
                      const ads = manager.convertAnunciosToAds(data);
                      Utils.log('🎯 Anúncios convertidos:', 'success', ads);
                      
                      if (ads.length > 0) {
                        window.helmetMistApp.updateAdsFromFirebase(ads);
                        Utils.log('✅ Anúncios aplicados na interface', 'success');
                        
                        // Verifica se realmente foram aplicados
                        setTimeout(() => {
                          const slides = document.querySelectorAll('.ad-slide');
                          Utils.log(`🔍 Slides na interface: ${slides.length}`, 'info');
                          slides.forEach((slide, index) => {
                            const title = slide.querySelector('h4')?.textContent;
                            const desc = slide.querySelector('p')?.textContent;
                            Utils.log(`Slide ${index}: ${title} - ${desc}`, 'info');
                          });
                        }, 500);
                      } else {
                        Utils.log('⚠️ Nenhum anúncio ativo encontrado', 'warn');
                      }
                    } else {
                      Utils.log('❌ Nenhum dado encontrado em /anuncios', 'error');
                    }
                  } catch (error) {
                    Utils.log('❌ Erro ao carregar anúncios:', 'error', error);
                  }
                } else {
                  Utils.log('❌ Firebase não disponível ou em modo demo', 'error');
                }
              },
  
  // Limpa localStorage
  clearStorage: () => {
    localStorage.clear();
    Utils.log('localStorage limpo', 'success');
  },

  // Comandos específicos ESP32
  testESP32Connection: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('test_connection', {
        timestamp: Date.now(),
        test_type: 'manual_debug'
      });
      Utils.log('Comando de teste ESP32 enviado', 'success');
    } else {
      Utils.log('FirebaseManager não disponível para ESP32', 'error');
    }
  },

  testDoorSensor: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('test_door_sensor', {
        action: 'simulate_door_toggle',
        timestamp: Date.now()
      });
      Utils.log('Teste do sensor de porta ESP32 enviado', 'success');
    }
  },

  testAllRelays: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('test_all_relays', {
        action: 'sequential_test',
        duration: 2000,
        timestamp: Date.now()
      });
      Utils.log('Teste sequencial de todos os relés ESP32 enviado', 'success');
    }
  },

  readAllSensors: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('read_all_sensors', {
        action: 'full_sensor_reading',
        timestamp: Date.now()
      });
      Utils.log('Leitura completa de sensores ESP32 solicitada', 'success');
    }
  },

  emergencyStopESP32: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.emergencyStop();
      Utils.log('Parada de emergência ESP32 acionada', 'warn');
    }
  },

  simulateESP32Error: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('simulate_error', {
        error_type: 'sensor_failure',
        sensor: 'door_sensor',
        timestamp: Date.now()
      });
      Utils.log('Simulação de erro ESP32 enviada', 'warn');
    }
  },

  simulateESP32Recovery: () => {
    if (window.helmetMistApp?.components.firebaseManager) {
      window.helmetMistApp.components.firebaseManager.sendCommand('simulate_recovery', {
        recovery_type: 'sensor_recovery',
        timestamp: Date.now()
      });
      Utils.log('Simulação de recuperação ESP32 enviada', 'success');
    }
  },

  monitorESP32: () => {
    if (window.helmetMistApp?.components.firebaseManager && !window.helmetMistApp.components.firebaseManager.state.demoMode) {
      const database = window.helmetMistApp.components.firebaseManager.database;
      
      // Monitor em tempo real
      const monitorRef = database.ref('system/esp32_status');
      const listener = monitorRef.on('value', (snapshot) => {
        const status = snapshot.val();
        Utils.log('ESP32 Status em tempo real:', 'info', status);
      });
      
      Utils.log('Monitor ESP32 ativado - verifique o console', 'success');
      
      // Para parar o monitor: DEBUG.stopESP32Monitor()
      window.DEBUG.stopESP32Monitor = () => {
        monitorRef.off('value', listener);
        Utils.log('Monitor ESP32 desativado', 'warn');
      };
    } else {
      Utils.log('Firebase não disponível para monitoramento ESP32', 'error');
    }
  },

  // Comandos de desenvolvimento
  forceStartCycle: () => {
    if (window.helmetMistApp) {
      window.helmetMistApp.startCycle();
      Utils.log('🔧 Ciclo forçado (debug)', 'warn');
    }
  },

  resetToFirstCycle: () => {
    if (window.helmetMistApp) {
      window.helmetMistApp.state.isFirstCycle = true;
      window.helmetMistApp.saveSettings();
      Utils.log('🔧 Reset para primeiro ciclo (grátis)', 'success');
    }
  },

  simulatePaymentSuccess: (method = 'PIX') => {
    const payment = window.helmetMistApp?.components.paymentManager;
    const modal = document.querySelector('.payment-modal');
    if (payment && modal) {
      payment.handlePaymentSuccess(modal, method, 'DEBUG_' + Utils.generateId());
      Utils.log('💰 Pagamento simulado aprovado', 'success');
    }
  },

  // Help system
  help: () => {
    console.log(`
🏍️ CLEAN HELMET DEBUG v${CONFIG.version} + ESP32

            === COMANDOS GERAIS ===
            DEBUG.info()              - Informações do sistema
            DEBUG.checkState()        - Estado detalhado (tabela)
            DEBUG.testCycle()         - Teste de ciclo
            DEBUG.testPayment()       - Teste de pagamento
            DEBUG.testAuth()          - Teste Firebase
            DEBUG.checkFirebaseConfig() - Verifica config Firebase
            DEBUG.reconnectFirebase()   - Força reconexão Firebase
            DEBUG.forceOnlineMode()     - Força modo online
            DEBUG.testFirebaseAds()     - Testa anúncios Firebase
            DEBUG.showCurrentAds()      - Mostra anúncios atuais

=== COMANDOS ESP32 ===
DEBUG.testESP32Connection()  - Testa conexão ESP32
DEBUG.testDoorSensor()       - Simula sensor porta
DEBUG.testAllRelays()        - Testa todos os relés
DEBUG.readAllSensors()       - Lê todos os sensores
DEBUG.emergencyStopESP32()   - Parada de emergência
DEBUG.simulateESP32Error()   - Simula erro ESP32
DEBUG.simulateESP32Recovery()- Simula recuperação
DEBUG.monitorESP32()         - Monitor tempo real

=== DESENVOLVIMENTO ===
DEBUG.forceStartCycle()      - Força início ciclo
DEBUG.resetToFirstCycle()    - Reset para grátis
DEBUG.simulatePaymentSuccess()- Simula pagamento OK
DEBUG.clearStorage()         - Limpa localStorage

=== UTILITÁRIOS ===
DEBUG.help()                - Esta ajuda
    `);
  }
};

// ===== LOGS DE INICIALIZAÇÃO =====
Utils.log('Clean Helmet Client v4.0.0 carregado', 'success');
Utils.log('Hardware: ESP32 + Raspberry Pi + Firebase', 'info');
Utils.log('Tela otimizada: 1280x800 touch', 'info');
Utils.log('Sistema de pagamentos: PIX + Cartão físico', 'info');
Utils.log('Use DEBUG.info() para informações do sistema', 'info');
Utils.log('Use DEBUG.help() para ver todos os comandos disponíveis', 'info');



