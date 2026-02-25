<!-- 🆕 FUNÇÕES DE TESTE DO SISTEMA ANTI-BURLA - VERSÃO CORRIGIDA -->
  <script>
  // Aguardar sistema de ID único
  async function waitForDeviceSystem() {
    return new Promise((resolve) => {
      const checkDevice = () => {
        if (window.CleanHelmetDevice && window.CleanHelmetDevice.isInitialized()) {
          console.log('✅ Sistema de ID único pronto');
          updateSystemIndicator('deviceIdStatus', 'online', 'Ativo');
          resolve();
        } else {
          setTimeout(checkDevice, 500);
        }
      };
      checkDevice();
    });
  }

  // Verificar status do dispositivo
  window.verificarStatusDispositivo = async function() {
    const resultsDiv = document.getElementById('testeResults');
    resultsDiv.style.display = 'block';
    
    try {
      if (!window.CleanHelmetDevice) {
        throw new Error('Sistema de dispositivos não inicializado');
      }
      
      // FORÇAR ATUALIZAÇÃO DOS DADOS
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const deviceInfo = await window.CleanHelmetDevice.getDeviceInfo();
      const canUse = await window.CleanHelmetDevice.canUseFreeClean();
      
      console.log('🔍 Device Info:', deviceInfo);
      console.log('🔍 Can Use:', canUse);
      
      resultsDiv.innerHTML = `
        <div><strong>🔍 STATUS DO DISPOSITIVO</strong></div>
        <div>ID: ${deviceInfo?.deviceId || 'N/A'}</div>
        <div>Fingerprint: ${(deviceInfo?.fingerprint || 'N/A').substring(0, 16)}...</div>
        <div>Ciclos Grátis Usados: ${deviceInfo?.freeCyclesUsed || 0}/1</div>
        <div>Ciclos Disponíveis: ${deviceInfo?.freeCyclesAvailable || 0}</div>
        <div>Status: ${deviceInfo?.isBlocked ? '🚫 Bloqueado' : '✅ Ativo'}</div>
        <div style="color: ${canUse ? 'var(--cor-sucesso)' : 'var(--cor-erro)'};">
          Pode Usar Ciclo: ${canUse ? '✅ Sim' : '❌ Não'}
        </div>
        <div>Total de Ciclos: ${deviceInfo?.totalCycles || 0}</div>
        <div>Último Acesso: ${deviceInfo?.lastAccess ? new Date(deviceInfo.lastAccess).toLocaleString() : 'N/A'}</div>
      `;
      
    } catch (error) {
      resultsDiv.innerHTML = `<div style="color: var(--cor-erro);">❌ Erro: ${error.message}</div>`;
    }
  };

  // Resetar dispositivo atual - VERSÃO CORRIGIDA
  window.resetarDispositivoAtual = async function() {
    if (!confirm('🔄 Resetar o dispositivo atual?\n\nIsso irá zerar os ciclos grátis usados.')) {
      return;
    }
    
    try {
      const deviceId = window.CleanHelmetDevice?.getDeviceId();
      if (!deviceId) {
        throw new Error('ID do dispositivo não encontrado');
      }
      
      console.log('🔄 Iniciando reset do dispositivo:', deviceId);
      
      const success = await window.CleanHelmetDevice.admin.resetDevice(deviceId);
      
      if (success) {
        console.log('✅ Reset realizado com sucesso');
        
        // Mostrar notificação
        if (window.mostrarNotificacao) {
          window.mostrarNotificacao({
            tipo: 'sucesso',
            titulo: '🔄 Reset Realizado',
            mensagem: 'Dispositivo resetado com sucesso!'
          });
        }
        
        // AGUARDAR MAIS TEMPO E FORÇAR MÚLTIPLAS ATUALIZAÇÕES
        console.log('⏳ Aguardando atualização dos dados...');
        
        // Atualizar em etapas com delays maiores
        setTimeout(async () => {
          console.log('🔄 Primeira atualização...');
          if (window.updateCurrentDeviceInfo) {
            await window.updateCurrentDeviceInfo();
          }
        }, 500);
        
        setTimeout(async () => {
          console.log('🔄 Segunda atualização...');
          await verificarStatusDispositivo();
        }, 1500);
        
        setTimeout(async () => {
          console.log('🔄 Terceira atualização (final)...');
          if (window.updateCurrentDeviceInfo) {
            await window.updateCurrentDeviceInfo();
          }
          await verificarStatusDispositivo();
        }, 3000);
        
      } else {
        throw new Error('Reset falhou - função retornou false');
      }
      
    } catch (error) {
      console.error('❌ Erro no reset:', error);
      if (window.mostrarNotificacao) {
        window.mostrarNotificacao({
          tipo: 'erro',
          titulo: '❌ Erro no Reset',
          mensagem: error.message
        });
      }
    }
  };

  // Testar ciclo grátis - VERSÃO CORRIGIDA
  window.testarCicloGratis = async function(deviceId) {
    try {
      if (!window.CleanHelmetDevice) {
        throw new Error('Sistema de dispositivos não inicializado');
      }
      
      // VERIFICAR STATUS ATUAL PRIMEIRO
      const canUseBefore = await window.CleanHelmetDevice.canUseFreeClean();
      console.log('🎁 Pode usar ciclo antes:', canUseBefore);
      
      if (canUseBefore) {
        const success = await window.CleanHelmetDevice.useFreeClean();
        
        if (success) {
          console.log('✅ Ciclo grátis usado com sucesso');
          
          if (window.mostrarNotificacao) {
            window.mostrarNotificacao({
              tipo: 'sucesso',
              titulo: '🎁 Ciclo Grátis Usado',
              mensagem: 'Ciclo grátis utilizado com sucesso!'
            });
          }
          
          // ATUALIZAR COM DELAY MAIOR
          setTimeout(async () => {
            if (window.updateCurrentDeviceInfo) {
              await window.updateCurrentDeviceInfo();
            }
            await verificarStatusDispositivo();
          }, 1500);
        }
      } else {
        if (window.mostrarNotificacao) {
          window.mostrarNotificacao({
            tipo: 'aviso',
            titulo: '⚠️ Ciclo Não Disponível',
            mensagem: 'Nenhum ciclo grátis disponível para este dispositivo'
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao usar ciclo grátis:', error);
      if (window.mostrarNotificacao) {
        window.mostrarNotificacao({
          tipo: 'erro',
          titulo: '❌ Erro',
          mensagem: error.message
        });
      }
    }
  };

  // Função auxiliar para updateSystemIndicator
  function updateSystemIndicator(elementId, status, text) {
    const indicator = document.getElementById(elementId);
    if (indicator) {
      indicator.textContent = text;
      indicator.className = `indicator-status ${status}`;
    }
  }

  // 🆕 FUNÇÃO PARA FORÇAR ATUALIZAÇÃO COMPLETA
  window.forcarAtualizacaoCompleta = async function() {
    console.log('🔄 Forçando atualização completa...');
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Atualizar info do dispositivo
    if (window.updateCurrentDeviceInfo) {
      await window.updateCurrentDeviceInfo();
    }
    
    // Verificar status
    await verificarStatusDispositivo();
    
    console.log('✅ Atualização completa finalizada');
  };
  </script>