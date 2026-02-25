// ===== CLEAN HELMET - SISTEMA DE ID ÚNICO E ANTI-BURLA v5.0 =====
// Sistema completo para prevenir burlas e controlar ciclos grátis

class CleanHelmetDeviceManager {
  constructor() {
    this.deviceId = null;
    this.fingerprint = null;
    this.isInitialized = false;
    this.config = {
      maxFreeCycles: 1,
      maxDailyGlobalLimit: 50,
      antiBurlaEnabled: true,
      fingerprintChangeThreshold: 0.8,
      suspiciousActivityThreshold: 3,
      cooldownPeriod: 300000, // 5 minutos
      maxIpAttempts: 5
    };
    
    this.storage = {
      local: localStorage,
      session: sessionStorage,
      indexedDB: null
    };
    
    this.init();
  }

  // Inicialização do sistema
  async init() {
    try {
      console.log('🔧 Inicializando Sistema de ID Único...');
      
      // Inicializar IndexedDB
      await this.initIndexedDB();
      
      // Gerar ou recuperar ID do dispositivo
      await this.generateOrRetrieveDeviceId();
      
      // Gerar fingerprint do dispositivo
      await this.generateDeviceFingerprint();
      
      // Verificar status do dispositivo
      await this.checkDeviceStatus();
      
      // Configurar listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Sistema de ID Único inicializado com sucesso');
      console.log('📱 Device ID:', this.deviceId);
      console.log('🔍 Fingerprint:', this.fingerprint.substring(0, 16) + '...');
      
      // Notificar inicialização
      this.dispatchEvent('deviceInitialized', {
        deviceId: this.deviceId,
        fingerprint: this.fingerprint
      });
      
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de ID único:', error);
      this.handleError('INIT_ERROR', error);
    }
  }

  // Inicializar IndexedDB para armazenamento persistente
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CleanHelmetDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.storage.indexedDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store para dispositivos
        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
          deviceStore.createIndex('fingerprint', 'fingerprint', { unique: false });
          deviceStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Store para logs de atividade
        if (!db.objectStoreNames.contains('activity')) {
          const activityStore = db.createObjectStore('activity', { keyPath: 'id', autoIncrement: true });
          activityStore.createIndex('deviceId', 'deviceId', { unique: false });
          activityStore.createIndex('timestamp', 'timestamp', { unique: false });
          activityStore.createIndex('type', 'type', { unique: false });
        }
        
        // Store para configurações
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };
    });
  }

  // Gerar ou recuperar ID único do dispositivo
  async generateOrRetrieveDeviceId() {
    // Tentar recuperar de múltiplas fontes
    let deviceId = 
      this.storage.local.getItem('cleanHelmet_deviceId') ||
      this.storage.session.getItem('cleanHelmet_deviceId') ||
      this.getCookieValue('cleanHelmet_deviceId') ||
      await this.getFromIndexedDB('config', 'deviceId');

    if (!deviceId) {
      // Gerar novo ID único
      deviceId = this.generateUniqueId();
      
      // Armazenar em múltiplos locais
      this.storage.local.setItem('cleanHelmet_deviceId', deviceId);
      this.storage.session.setItem('cleanHelmet_deviceId', deviceId);
      this.setCookie('cleanHelmet_deviceId', deviceId, 365);
      await this.saveToIndexedDB('config', { key: 'deviceId', value: deviceId });
      
      console.log('🆕 Novo dispositivo registrado:', deviceId);
    } else {
      console.log('🔄 Dispositivo existente encontrado:', deviceId);
    }

    this.deviceId = deviceId;
    return deviceId;
  }

  // Gerar fingerprint único do dispositivo
  async generateDeviceFingerprint() {
    const components = {
      // Hardware
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory || 'unknown',
      
      // Browser
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      
      // Canvas fingerprint
      canvas: await this.getCanvasFingerprint(),
      
      // WebGL fingerprint
      webgl: await this.getWebGLFingerprint(),
      
      // Audio fingerprint
      audio: await this.getAudioFingerprint(),
      
      // Plugins
      plugins: Array.from(navigator.plugins).map(p => p.name).sort().join(','),
      
      // Fonts
      fonts: await this.getFontFingerprint(),
      
      // Local Storage
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined'
    };

    // Gerar hash do fingerprint
    const fingerprintString = JSON.stringify(components);
    this.fingerprint = await this.generateHash(fingerprintString);
    
    // Verificar se o fingerprint mudou (possível tentativa de burla)
    await this.checkFingerprintChange();
    
    return this.fingerprint;
  }

  // Canvas fingerprint
  async getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 200;
      canvas.height = 50;
      
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Clean Helmet 🧠', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Clean Helmet 🧠', 4, 17);
      
      return canvas.toDataURL();
    } catch (error) {
      return 'canvas_error';
    }
  }

  // WebGL fingerprint
  async getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'no_webgl';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      return `${vendor}~${renderer}`;
    } catch (error) {
      return 'webgl_error';
    }
  }

  // Audio fingerprint
  async getAudioFingerprint() {
    return new Promise((resolve) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        
        oscillator.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(0);
        
        setTimeout(() => {
          const data = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatFrequencyData(data);
          
          oscillator.stop();
          audioContext.close();
          
          const hash = Array.from(data).slice(0, 30).join(',');
          resolve(hash);
        }, 100);
        
      } catch (error) {
        resolve('audio_error');
      }
    });
  }

  // Font fingerprint
  async getFontFingerprint() {
    const testFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact', 'Tahoma', 'Calibri'
    ];
    
    const availableFonts = [];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Baseline com fonte padrão
    context.font = `${testSize} monospace`;
    const baselineWidth = context.measureText(testString).width;
    
    testFonts.forEach(font => {
      context.font = `${testSize} ${font}, monospace`;
      const width = context.measureText(testString).width;
      
      if (width !== baselineWidth) {
        availableFonts.push(font);
      }
    });
    
    return availableFonts.sort().join(',');
  }

  // Verificar mudança de fingerprint (possível burla)
  async checkFingerprintChange() {
    const storedFingerprint = await this.getFromIndexedDB('config', 'fingerprint');
    
    if (storedFingerprint && storedFingerprint !== this.fingerprint) {
      const similarity = this.calculateSimilarity(storedFingerprint, this.fingerprint);
      
      if (similarity < this.config.fingerprintChangeThreshold) {
        console.warn('⚠️ Fingerprint significativamente alterado - possível tentativa de burla');
        
        await this.logActivity('FINGERPRINT_CHANGE', {
          oldFingerprint: storedFingerprint.substring(0, 16) + '...',
          newFingerprint: this.fingerprint.substring(0, 16) + '...',
          similarity: similarity,
          suspicious: true
        });
        
        // Marcar como suspeito
        await this.markSuspiciousActivity();
      }
    }
    
    // Atualizar fingerprint armazenado
    await this.saveToIndexedDB('config', { key: 'fingerprint', value: this.fingerprint });
  }

  // Verificar status do dispositivo
  async checkDeviceStatus() {
    const deviceData = await this.getFromIndexedDB('devices', this.deviceId);
    
    if (!deviceData) {
      // Primeiro acesso - criar registro
      const newDevice = {
        id: this.deviceId,
        fingerprint: this.fingerprint,
        createdAt: new Date().toISOString(),
        freeCyclesUsed: 0,
        freeCyclesAvailable: this.config.maxFreeCycles,
        lastFreeCycle: null,
        isBlocked: false,
        suspiciousActivity: 0,
        totalCycles: 0,
        lastAccess: new Date().toISOString(),
        ipHistory: [this.getClientIP()],
        status: 'active'
      };
      
      await this.saveToIndexedDB('devices', newDevice);
      console.log('✅ Novo dispositivo registrado no banco');
    } else {
      // Dispositivo existente - atualizar último acesso
      deviceData.lastAccess = new Date().toISOString();
      deviceData.fingerprint = this.fingerprint;
      
      // Adicionar IP se não existir
      const currentIP = this.getClientIP();
      if (!deviceData.ipHistory.includes(currentIP)) {
        deviceData.ipHistory.push(currentIP);
        
        // Se muitos IPs diferentes, pode ser suspeito
        if (deviceData.ipHistory.length > this.config.maxIpAttempts) {
          await this.markSuspiciousActivity();
        }
      }
      
      await this.saveToIndexedDB('devices', deviceData);
    }
    
    // Resetar ciclos grátis diariamente
    await this.resetDailyFreeCycles();
  }

  // Resetar ciclos grátis diariamente
  async resetDailyFreeCycles() {
    const lastReset = await this.getFromIndexedDB('config', 'lastDailyReset');
    const today = new Date().toDateString();
    
    if (!lastReset || lastReset !== today) {
      // Reset diário
      const devices = await this.getAllFromIndexedDB('devices');
      
      for (const device of devices) {
        device.freeCyclesUsed = 0;
        device.freeCyclesAvailable = this.config.maxFreeCycles;
        device.dailyPromoSent = 0;
        await this.saveToIndexedDB('devices', device);
      }
      
      await this.saveToIndexedDB('config', { key: 'lastDailyReset', value: today });
      
      console.log('🔄 Reset diário de ciclos grátis realizado');
      await this.logActivity('DAILY_RESET', { date: today, devicesReset: devices.length });
    }
  }

  // Verificar se pode usar ciclo grátis
  async canUseFreeClean() {
    if (!this.isInitialized) {
      console.warn('⚠️ Sistema não inicializado');
      return false;
    }

    const deviceData = await this.getFromIndexedDB('devices', this.deviceId);
    
    if (!deviceData) {
      console.error('❌ Dados do dispositivo não encontrados');
      return false;
    }

    // Verificar se está bloqueado
    if (deviceData.isBlocked) {
      console.warn('🚫 Dispositivo bloqueado');
      await this.logActivity('BLOCKED_ATTEMPT', { reason: 'Device blocked' });
      return false;
    }

    // Verificar limite de ciclos grátis
    if (deviceData.freeCyclesUsed >= this.config.maxFreeCycles) {
      console.warn('⚠️ Limite de ciclos grátis atingido para hoje');
      await this.logActivity('FREE_CYCLE_LIMIT_REACHED', { 
        used: deviceData.freeCyclesUsed,
        limit: this.config.maxFreeCycles 
      });
      return false;
    }

    // Verificar limite global diário
    const totalUsedToday = await this.getTotalFreeCyclesUsedToday();
    if (totalUsedToday >= this.config.maxDailyGlobalLimit) {
      console.warn('⚠️ Limite global diário de ciclos grátis atingido');
      await this.logActivity('GLOBAL_LIMIT_REACHED', { 
        totalUsed: totalUsedToday,
        globalLimit: this.config.maxDailyGlobalLimit 
      });
      return false;
    }

    // Verificar cooldown
    if (deviceData.lastFreeCycle) {
      const lastCycle = new Date(deviceData.lastFreeCycle);
      const timeSince = Date.now() - lastCycle.getTime();
      
      if (timeSince < this.config.cooldownPeriod) {
        const remainingTime = Math.ceil((this.config.cooldownPeriod - timeSince) / 1000);
        console.warn(`⏰ Cooldown ativo. Aguarde ${remainingTime} segundos`);
        await this.logActivity('COOLDOWN_ACTIVE', { remainingSeconds: remainingTime });
        return false;
      }
    }

    return true;
  }

  // Usar ciclo grátis
  async useFreeClean() {
    if (!await this.canUseFreeClean()) {
      return false;
    }

    const deviceData = await this.getFromIndexedDB('devices', this.deviceId);
    
    // Atualizar dados
    deviceData.freeCyclesUsed += 1;
    deviceData.freeCyclesAvailable = this.config.maxFreeCycles - deviceData.freeCyclesUsed;
    deviceData.lastFreeCycle = new Date().toISOString();
    deviceData.totalCycles += 1;
    
    await this.saveToIndexedDB('devices', deviceData);
    
    // Log da atividade
    await this.logActivity('FREE_CYCLE_USED', {
      cyclesUsed: deviceData.freeCyclesUsed,
      cyclesRemaining: deviceData.freeCyclesAvailable,
      totalCycles: deviceData.totalCycles
    });
    
    console.log('✅ Ciclo grátis utilizado com sucesso');
    console.log(`📊 Ciclos restantes: ${deviceData.freeCyclesAvailable}`);
    
    // Notificar uso
    this.dispatchEvent('freeCycleUsed', {
      cyclesUsed: deviceData.freeCyclesUsed,
      cyclesRemaining: deviceData.freeCyclesAvailable
    });
    
    return true;
  }

  // Obter informações do dispositivo atual
  async getDeviceInfo() {
    if (!this.isInitialized) {
      return null;
    }

    const deviceData = await this.getFromIndexedDB('devices', this.deviceId);
    
    return {
      deviceId: this.deviceId,
      fingerprint: this.fingerprint,
      freeCyclesUsed: deviceData?.freeCyclesUsed || 0,
      freeCyclesAvailable: deviceData?.freeCyclesAvailable || this.config.maxFreeCycles,
      totalCycles: deviceData?.totalCycles || 0,
      isBlocked: deviceData?.isBlocked || false,
      lastAccess: deviceData?.lastAccess || new Date().toISOString(),
      createdAt: deviceData?.createdAt || new Date().toISOString(),
      suspiciousActivity: deviceData?.suspiciousActivity || 0
    };
  }

  // Marcar atividade suspeita
  async markSuspiciousActivity() {
    const deviceData = await this.getFromIndexedDB('devices', this.deviceId);
    
    if (deviceData) {
      deviceData.suspiciousActivity += 1;
      
      // Bloquear se muita atividade suspeita
      if (deviceData.suspiciousActivity >= this.config.suspiciousActivityThreshold) {
        deviceData.isBlocked = true;
        console.warn('🚫 Dispositivo bloqueado por atividade suspeita');
        
        await this.logActivity('DEVICE_BLOCKED', {
          reason: 'Suspicious activity threshold reached',
          suspiciousCount: deviceData.suspiciousActivity
        });
      }
      
      await this.saveToIndexedDB('devices', deviceData);
    }
  }

  // Funções administrativas
  async adminResetDevice(deviceId) {
    const deviceData = await this.getFromIndexedDB('devices', deviceId);
    
    if (deviceData) {
      deviceData.freeCyclesUsed = 0;
      deviceData.freeCyclesAvailable = this.config.maxFreeCycles;
      deviceData.suspiciousActivity = 0;
      deviceData.isBlocked = false;
      
      await this.saveToIndexedDB('devices', deviceData);
      await this.logActivity('ADMIN_RESET', { targetDevice: deviceId });
      
      console.log('🔄 Dispositivo resetado pelo administrador:', deviceId);
      return true;
    }
    
    return false;
  }

  async adminBlockDevice(deviceId) {
    const deviceData = await this.getFromIndexedDB('devices', deviceId);
    
    if (deviceData) {
      deviceData.isBlocked = true;
      await this.saveToIndexedDB('devices', deviceData);
      await this.logActivity('ADMIN_BLOCK', { targetDevice: deviceId });
      
      console.log('🚫 Dispositivo bloqueado pelo administrador:', deviceId);
      return true;
    }
    
    return false;
  }

  async adminUnblockDevice(deviceId) {
    const deviceData = await this.getFromIndexedDB('devices', deviceId);
    
    if (deviceData) {
      deviceData.isBlocked = false;
      await this.saveToIndexedDB('devices', deviceData);
      await this.logActivity('ADMIN_UNBLOCK', { targetDevice: deviceId });
      
      console.log('✅ Dispositivo desbloqueado pelo administrador:', deviceId);
      return true;
    }
    
    return false;
  }

  async adminSendFreeCycle(deviceId) {
    const deviceData = await this.getFromIndexedDB('devices', deviceId);
    
    if (deviceData) {
      deviceData.freeCyclesAvailable += 1;
      deviceData.dailyPromoSent = (deviceData.dailyPromoSent || 0) + 1;
      
      await this.saveToIndexedDB('devices', deviceData);
      await this.logActivity('ADMIN_FREE_CYCLE_SENT', { targetDevice: deviceId });
      
      console.log('🎁 Ciclo grátis promocional enviado:', deviceId);
      return true;
    }
    
    return false;
  }

  // Obter total de ciclos grátis usados hoje
  async getTotalFreeCyclesUsedToday() {
    const devices = await this.getAllFromIndexedDB('devices');
    return devices.reduce((total, device) => total + (device.freeCyclesUsed || 0), 0);
  }

  // Log de atividades
  async logActivity(type, data = {}) {
    const logEntry = {
      deviceId: this.deviceId,
      type: type,
      timestamp: new Date().toISOString(),
      data: data,
      userAgent: navigator.userAgent,
      ip: this.getClientIP(),
      fingerprint: this.fingerprint?.substring(0, 16) + '...'
    };
    
    await this.saveToIndexedDB('activity', logEntry);
  }

  // Utilitários
  generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const performance = (window.performance?.now() || Math.random()).toString(36);
    
    return `CH_${timestamp}_${random}_${performance}`.toUpperCase();
  }

  async generateHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  getClientIP() {
    // Placeholder - em produção seria obtido do servidor
    return 'client_ip_placeholder';
  }

  // Funções de armazenamento
  async saveToIndexedDB(storeName, data) {
    if (!this.storage.indexedDB) return;
    
    const transaction = this.storage.indexedDB.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getFromIndexedDB(storeName, key) {
    if (!this.storage.indexedDB) return null;
    
    const transaction = this.storage.indexedDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFromIndexedDB(storeName) {
    if (!this.storage.indexedDB) return [];
    
    const transaction = this.storage.indexedDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Funções de cookies
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }

  getCookieValue(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    
    return null;
  }

  // Event system
  setupEventListeners() {
    // Detectar tentativas de manipulação
    window.addEventListener('beforeunload', () => {
      this.logActivity('BEFORE_UNLOAD', { timestamp: Date.now() });
    });
    
    // Detectar mudanças na janela
    window.addEventListener('focus', () => {
      this.logActivity('WINDOW_FOCUS', { timestamp: Date.now() });
    });
    
    window.addEventListener('blur', () => {
      this.logActivity('WINDOW_BLUR', { timestamp: Date.now() });
    });
  }

  dispatchEvent(eventName, data) {
    const event = new CustomEvent(`cleanHelmet:${eventName}`, { detail: data });
    window.dispatchEvent(event);
  }

  handleError(type, error) {
    console.error(`CleanHelmet Error [${type}]:`, error);
    this.logActivity('ERROR', { type, message: error.message, stack: error.stack });
  }
}

// Inicializar sistema global
window.cleanHelmetDeviceManager = new CleanHelmetDeviceManager();

// API pública
window.CleanHelmetDevice = {
  // Verificar se pode usar ciclo grátis
  canUseFreeClean: () => window.cleanHelmetDeviceManager.canUseFreeClean(),
  
  // Usar ciclo grátis
  useFreeClean: () => window.cleanHelmetDeviceManager.useFreeClean(),
  
  // Obter informações do dispositivo
  getDeviceInfo: () => window.cleanHelmetDeviceManager.getDeviceInfo(),
  
  // Verificar se está inicializado
  isInitialized: () => window.cleanHelmetDeviceManager.isInitialized,
  
  // Obter ID do dispositivo
  getDeviceId: () => window.cleanHelmetDeviceManager.deviceId,
  
  // Obter fingerprint
  getFingerprint: () => window.cleanHelmetDeviceManager.fingerprint,
  
  // Funções administrativas
  admin: {
    resetDevice: (deviceId) => window.cleanHelmetDeviceManager.adminResetDevice(deviceId),
    blockDevice: (deviceId) => window.cleanHelmetDeviceManager.adminBlockDevice(deviceId),
    unblockDevice: (deviceId) => window.cleanHelmetDeviceManager.adminUnblockDevice(deviceId),
    sendFreeCycle: (deviceId) => window.cleanHelmetDeviceManager.adminSendFreeCycle(deviceId)
  }
};

console.log('🚀 Sistema de ID Único Clean Helmet carregado');