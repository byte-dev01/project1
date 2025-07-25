/*import socketIOClient from "socket.io-client";
import { post } from "./utilities";
const endpoint = window.location.hostname + ":" + window.location.port;
export const socket = socketIOClient(endpoint);
socket.on("connect", () => {
  post("/api/initsocket", { socketid: socket.id });
});
*/
import { io } from "socket.io-client";
import { post } from "./utilities";

export const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("Socket connected: ", socket.id);
  post("/api/initsocket", { socketid: socket.id });
});
