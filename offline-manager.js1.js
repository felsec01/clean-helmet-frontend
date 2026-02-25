// ===== OFFLINE MANAGER v4.0.0 - SISTEMA HÍBRIDO =====
// Gerencia operação offline/online para Clean Helmet

class OfflineManager {
  constructor(app) {
    this.app = app;
    this.state = {
      isOnline: navigator.onLine,
      lastSyncTime: null,
      syncInProgress: false,
      queueSize: 0,
      offlineStartTime: null
    };
    
    this.syncQueue = [];
    this.localData = {
      cycles: [],
      payments: [],
      logs: [],
      sensorData: [],
      commands: [],
      ads: [],
      settings: {}
    };
    
    this.timers = new Map();
    this.maxQueueSize = 100;
    this.syncInterval = 30000; // 30 segundos
    this.connectionCheckInterval = 5000; // 5 segundos
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadLocalData();
    this.startConnectionCheck();
    this.showConnectionStatus();
    
    Utils.log('OfflineManager inicializado', 'success');
  }

  setupEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.state.isOnline = true;
    this.showConnectionStatus();
    this.startSyncProcess();
    Utils.log('Conexão restaurada - iniciando sincronização', 'success');
  }

  handleOffline() {
    this.state.isOnline = false;
    this.state.offlineStartTime = Date.now();
    this.showConnectionStatus();
    Utils.log('Modo offline ativado', 'warn');
  }

  showConnectionStatus() {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
      indicator.className = this.state.isOnline ? 'status-indicator online' : 'status-indicator offline';
    }
  }

  startConnectionCheck() {
    const checkInterval = setInterval(() => {
      this.checkConnection();
    }, this.connectionCheckInterval);
    
    this.timers.set('connectionCheck', checkInterval);
  }

  async checkConnection() {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      
      if (!this.state.isOnline) {
        this.handleOnline();
      }
    } catch (error) {
      if (this.state.isOnline) {
        this.handleOffline();
      }
    }
  }

  saveLog(type, data) {
    const logEntry = {
      id: Utils.generateId(),
      type,
      data,
      timestamp: Date.now(),
      synced: false
    };
    
    this.localData.logs.push(logEntry);
    this.addToSyncQueue('log', logEntry);
    
    // Limita logs locais
    if (this.localData.logs.length > 1000) {
      this.localData.logs = this.localData.logs.slice(-500);
    }
    
    this.saveLocalData();
  }

  addToSyncQueue(type, data) {
    if (this.syncQueue.length >= this.maxQueueSize) {
      this.syncQueue.shift(); // Remove o mais antigo
    }
    
    this.syncQueue.push({
      id: Utils.generateId(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0
    });
    
    this.state.queueSize = this.syncQueue.length;
    this.saveSyncQueue();
    
    if (this.state.isOnline && !this.state.syncInProgress) {
      this.startSyncProcess();
    }
  }

  async startSyncProcess() {
    if (this.state.syncInProgress || this.syncQueue.length === 0) return;
    
    this.state.syncInProgress = true;
    Utils.log(`Iniciando sincronização de ${this.syncQueue.length} itens`, 'info');
    
    while (this.syncQueue.length > 0 && this.state.isOnline) {
      const item = this.syncQueue.shift();
      
      try {
        await this.syncItem(item);
        Utils.log(`Item sincronizado: ${item.type}`, 'success');
      } catch (error) {
        item.retries++;
        if (item.retries < 3) {
          this.syncQueue.push(item); // Recoloca na fila
        }
        Utils.log(`Erro na sincronização: ${error.message}`, 'error');
      }
      
      // Pequena pausa entre sincronizações
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.state.syncInProgress = false;
    this.state.lastSyncTime = Date.now();
    this.state.queueSize = this.syncQueue.length;
    this.saveSyncQueue();
    
    Utils.log('Sincronização concluída', 'success');
  }

  async syncItem(item) {
    // Implementação básica - expandir conforme necessário
    switch (item.type) {
      case 'log':
        return this.syncLog(item.data);
      case 'cycle':
        return this.syncCycle(item.data);
      case 'payment':
        return this.syncPayment(item.data);
      default:
        Utils.log(`Tipo de sincronização não implementado: ${item.type}`, 'warn');
    }
  }

  async syncLog(logData) {
    // Implementação para sincronizar logs
    if (this.app.components.firebaseManager && !this.app.components.firebaseManager.state.demoMode) {
      await this.app.components.firebaseManager.log(logData.type, logData.data);
    }
  }

  async syncCycle(cycleData) {
    // Implementação para sincronizar ciclos
    if (this.app.components.firebaseManager && !this.app.components.firebaseManager.state.demoMode) {
      await this.app.components.firebaseManager.saveUsageStats(cycleData);
    }
  }

  async syncPayment(paymentData) {
    // Implementação para sincronizar pagamentos
    Utils.log('Sincronizando pagamento:', 'info', paymentData);
  }

  saveLocalData() {
    Utils.safeLocalStorage.set('offline-data', this.localData);
  }

  loadLocalData() {
    const saved = Utils.safeLocalStorage.get('offline-data', {});
    this.localData = { ...this.localData, ...saved };
  }

  saveSyncQueue() {
    Utils.safeLocalStorage.set('sync-queue', this.syncQueue);
  }

  loadSyncQueue() {
    this.syncQueue = Utils.safeLocalStorage.get('sync-queue', []);
    this.state.queueSize = this.syncQueue.length;
  }

  // Métodos públicos para uso pela aplicação
  isConnected() {
    return this.state.isOnline;
  }

  getPendingSyncCount() {
    return this.syncQueue.length;
  }

  forceSync() {
    if (this.state.isOnline) {
      this.startSyncProcess();
    } else {
      Utils.log('Não é possível sincronizar - offline', 'warn');
    }
  }

  clearLocalData() {
    this.localData = {
      cycles: [],
      payments: [],
      logs: [],
      sensorData: [],
      commands: [],
      ads: [],
      settings: {}
    };
    this.syncQueue = [];
    this.state.queueSize = 0;
    
    localStorage.removeItem('offline-data');
    localStorage.removeItem('sync-queue');
    
    Utils.log('Dados offline limpos', 'success');
  }

  destroy() {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    Utils.log('OfflineManager destruído', 'warn');
  }
}

// Disponibiliza globalmente
window.OfflineManager = OfflineManager;