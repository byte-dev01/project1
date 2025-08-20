// src/api/socket.js
import { io } from "socket.io-client";
import config from '../config';
import apiClient from './client';

// Get auth token for socket connection
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const socket = io(config.WS_URL, {
  transports: ["websocket"],
  withCredentials: true,
  auth: {
    token: getAuthToken()  // Send JWT with socket connection
  },
  // Reconnection options
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect", async () => {
  console.log("Socket connected:", socket.id);
  
  // Use the centralized API client instead of importing post
  try {
    await apiClient.post("/api/initsocket", { socketid: socket.id });
  } catch (error) {
    console.error("Failed to init socket:", error);
  }
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});

// Auto-reconnect with fresh token
socket.on("reconnect_attempt", () => {
  socket.auth.token = getAuthToken();
});

export default socket;