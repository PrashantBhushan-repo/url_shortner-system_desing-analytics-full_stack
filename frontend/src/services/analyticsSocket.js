import { io } from 'socket.io-client';
import { getSocketOrigin } from './apiConfig.js';

export function createAnalyticsSocket(apiBaseUrl, pageOrigin, token) {
  const socket = io(getSocketOrigin(apiBaseUrl, pageOrigin), {
    auth: { token },
    autoConnect: false,
    transports: ['polling', 'websocket'],
    closeOnBeforeunload: true,
  });
  // StrictMode immediately cleans up its first effect. Do not open a transport
  // until that pass has finished; cancel the pending connect on quick navigation.
  const connectTimer = setTimeout(() => socket.connect(), 0);
  return {
    socket,
    close() {
      clearTimeout(connectTimer);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
