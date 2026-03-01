// ===== SESSION MANAGER v4.0.0 - GERENCIAMENTO DE SESSÃO =====
// Gerencia sessões de usuário e renovação automática

class SessionManager {
  constructor(app) {
    this.app = app;
    this.state = {
      isActive: false,
      sessionId: null,
      userId: null,
      startTime: null,
      lastActivity: Date.now(),
      expiresAt: null,
      warningShown: false,
      renewalCount: 0
    };
    
    this.config = {
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 horas
      warningTime: 5 * 60 * 1000, // Avisar 5 minutos antes
      checkInterval: 60 * 1000, // Verificar a cada minuto
      maxRenewals: 10, // Máximo de renovações automáticas
      inactivityTimeout: 30 * 60 * 1000, // 30 minutos
    };
    
    this.timers = new Map();
    this.init();
  }

  init() {
    this.setupActivityListeners();
    this.loadSessionData();
    this.startSessionMonitoring();
    
    Utils.log('SessionManager inicializado', 'success');
  }

  setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
    
    // Monitora mudanças de visibilidade
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });
  }

  updateActivity() {
    this.state.lastActivity = Date.now();
    this.saveSessionData();
    
    // Reset warning se usuário está ativo
    if (this.state.warningShown) {
      this.state.warningShown = false;
      this.hideExpirationWarning();
    }
  }

  startSessionMonitoring() {
    const monitorInterval = setInterval(() => {
      this.checkSession();
    }, this.config.checkInterval);
    
    this.timers.set('sessionMonitor', monitorInterval);
  }

  checkSession() {
    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivity;
    const timeUntilExpiration = this.config.sessionTimeout - timeSinceActivity;
    
    // Verifica se deve mostrar aviso
    if (timeUntilExpiration <= this.config.warningTime && !this.state.warningShown) {
      this.showExpirationWarning();
    }
    
    // Verifica se deve expirar sessão
    if (timeSinceActivity >= this.config.sessionTimeout) {
      this.expireSession();
    }
    
    // Atualiza indicador de sessão
    this.updateSessionIndicator();
  }

  showExpirationWarning() {
    this.state.warningShown = true;
    
    const timeRemaining = this.getTimeRemaining();
    const message = `⏰ Sua sessão expirará em ${this.getTimeRemainingFormatted()}. Deseja renovar?`;
    
    if (this.app.showNotification) {
      this.app.showNotification(message, 'warning');
    }
    
    // Auto-renovação se o usuário estiver ativo
    if (Date.now() - this.state.lastActivity < 60000) { // Ativo nos últimos 60s
      setTimeout(() => this.renewSession(), 2000);
    }
    
    Utils.log('Aviso de expiração de sessão mostrado', 'warn');
  }

  hideExpirationWarning() {
    // Remove avisos de expiração se existirem
    Utils.log('Aviso de expiração removido - usuário ativo', 'info');
  }

  async renewSession() {
    try {
      // Tenta renovar token Firebase se disponível
      if (this.app.components.firebaseManager?.auth?.currentUser) {
        await this.app.components.firebaseManager.auth.currentUser.getIdToken(true);
      }
      
      this.state.lastActivity = Date.now();
      this.state.renewalCount++;
      this.state.warningShown = false;
      
      this.saveSessionData();
      this.showRenewalSuccess();
      
      Utils.log('Sessão renovada com sucesso', 'success');
      
    } catch (error) {
      Utils.log('Erro ao renovar sessão:', 'error', error);
      this.app.showNotification('❌ Erro ao renovar sessão', 'error');
    }
  }

  showRenewalSuccess() {
    if (this.app.showNotification) {
      this.app.showNotification('✅ Sessão renovada automaticamente!', 'success');
    }
  }

  expireSession() {
    Utils.log('Sessão expirada por inatividade', 'warn');
    
    this.state.isActive = false;
    this.clearSessionData();
    
    if (this.app.showNotification) {
      this.app.showNotification('⏰ Sessão expirada por inatividade. Recarregue a página.', 'error');
    }
    
    // Para todos os timers
    this.stop();
  }

  updateSessionIndicator() {
    const indicator = document.getElementById('sessionIndicator');
    if (!indicator) return;
    
    const timeRemaining = this.getTimeRemaining();
    const isWarning = timeRemaining <= this.config.warningTime;
    
    indicator.className = `session-indicator ${isWarning ? 'warning' : 'active'}`;
    
    const timeText = this.getTimeRemainingFormatted();
    const statusText = indicator.querySelector('.session-time');
    if (statusText) {
      statusText.textContent = timeText;
    }
  }

  getTimeRemaining() {
    const timeSinceActivity = Date.now() - this.state.lastActivity;
    return Math.max(0, this.config.sessionTimeout - timeSinceActivity);
  }

  getTimeRemainingFormatted() {
    const remaining = this.getTimeRemaining();
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  startSession(userId = null) {
    this.state.isActive = true;
    this.state.sessionId = Utils.generateId();
    this.state.userId = userId;
    this.state.startTime = Date.now();
    this.state.lastActivity = Date.now();
    this.state.renewalCount = 0;
    
    this.saveSessionData();
    Utils.log('Nova sessão iniciada', 'success', { sessionId: this.state.sessionId });
  }

  saveSessionData() {
    Utils.safeLocalStorage.set('session-data', {
      sessionId: this.state.sessionId,
      userId: this.state.userId,
      startTime: this.state.startTime,
      lastActivity: this.state.lastActivity,
      renewalCount: this.state.renewalCount
    });
  }

  loadSessionData() {
    const saved = Utils.safeLocalStorage.get('session-data', {});
    
    if (saved.sessionId) {
      Object.assign(this.state, saved, { isActive: true });
      Utils.log('Dados de sessão carregados', 'info');
    }
  }

  clearSessionData() {
    localStorage.removeItem('session-data');
    
    this.state = {
      isActive: false,
      sessionId: null,
      userId: null,
      startTime: null,
      lastActivity: Date.now(),
      expiresAt: null,
      warningShown: false,
      renewalCount: 0
    };
  }

  stop() {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
    
    Utils.log('SessionManager parado', 'warn');
  }

  // Métodos públicos
  isSessionActive() {
    return this.state.isActive;
  }

  getSessionInfo() {
    return {
      isActive: this.state.isActive,
      sessionId: this.state.sessionId,
      userId: this.state.userId,
      startTime: this.state.startTime,
      lastActivity: this.state.lastActivity,
      timeRemaining: this.getTimeRemaining(),
      renewalCount: this.state.renewalCount
    };
  }

  forceRenew() {
    this.renewSession();
  }

  destroy() {
    this.stop();
    this.clearSessionData();
    Utils.log('SessionManager destruído', 'warn');
  }
}

// Disponibiliza globalmente

window.SessionManager = SessionManager;
