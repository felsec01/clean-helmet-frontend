const socket = io("https://server-hibrido-js-1.onrender.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function registerSocketListeners(onEmergency, onDeviceAction, onPaymentStatus) {
  socket.on("emergency-stop", (data) => {
    console.log("🚨 Emergência recebida:", data);
    if (onEmergency) onEmergency(data);
  });

  socket.on("device-action", (data) => {
    console.log("⚙️ Ação recebida:", data);
    if (onDeviceAction) onDeviceAction(data);
  });

  socket.on("payment-status-update", (data) => {
    console.log("💳 Status de pagamento:", data);
    if (onPaymentStatus) onPaymentStatus(data);
  });

  // Extras
  socket.on("connect", () => console.log("✅ Conectado:", socket.id));
  socket.on("disconnect", () => console.warn("⚠️ Desconectado"));
  socket.on("reconnect_attempt", (attempt) => console.log("🔄 Tentando reconectar:", attempt));

  socket.on("sensor-update", (data) => console.log("🌡️ Sensores:", data));
  socket.on("cycle-progress", (step) => console.log("🔄 Ciclo:", step));
  socket.on("system-log", (msg) => console.log("📝 Log:", msg));
}

window.socket = socket;
window.registerSocketListeners = registerSocketListeners;
