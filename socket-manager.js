import io from "socket.io-client";

const socket = io("https://server-hibrido-js-1.onrender.com");

// Funções para registrar listeners
export function registerSocketListeners(onEmergency, onDeviceAction, onPaymentStatus) {
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
}
