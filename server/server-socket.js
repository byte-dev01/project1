let io;
const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object

const getAllConnectedUsers = () => Object.values(socketToUserMap);
const getSocketFromUserID = (userid) => userToSocketMap[userid];
const getUserFromSocketID = (socketid) => socketToUserMap[socketid];

// FIXED: Updated to work with newer Socket.io versions
const getSocketFromSocketID = (socketid) => {
  if (!io || !io.sockets) return null;
  
  // Try newer Socket.io API first
  if (io.sockets.sockets && typeof io.sockets.sockets.get === 'function') {
    return io.sockets.sockets.get(socketid);
  }
  
  // Fallback for older versions
  if (io.sockets.connected) {
    return io.sockets.connected[socketid];
  }
  
  // Manual search as last resort
  const allSockets = Array.from(io.sockets.sockets.values());
  return allSockets.find(socket => socket.id === socketid) || null;
};

const addUser = (user, socket) => {
  const oldSocket = userToSocketMap[user._id];
  if (oldSocket && oldSocket.id !== socket.id) {
    // there was an old tab open for this user, force it to disconnect
    oldSocket.disconnect();
    delete socketToUserMap[oldSocket.id];
  }

  userToSocketMap[user._id] = socket;
  socketToUserMap[socket.id] = user;
  io.emit("activeUsers", { activeUsers: getAllConnectedUsers() });
};

const removeUser = (user, socket) => {
  if (user) delete userToSocketMap[user._id];
  delete socketToUserMap[socket.id];
  io.emit("activeUsers", { activeUsers: getAllConnectedUsers() });
};

module.exports = {
init: (http) => {
  io = require("socket.io")(http, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:5000"], // ✅ Allow both ports
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Socket connected: ${socket.id}`);
    socket.on("disconnect", (reason) => {
      const user = getUserFromSocketID(socket.id);
      removeUser(user, socket);
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });
},

  addUser: addUser,
  removeUser: removeUser,

  getSocketFromUserID: getSocketFromUserID,
  getUserFromSocketID: getUserFromSocketID,
  getSocketFromSocketID: getSocketFromSocketID,
  getAllConnectedUsers: getAllConnectedUsers,
  getIo: () => io,
};