const User = require("./app/models/user.model");
const socketManager = require("./server-socket");
const jwt = require("jsonwebtoken");
const config = require("./app/config/auth.config");
require('dotenv').config();

// Populate current user from JWT token or session
function populateCurrentUser(req, res, next) {
  // Check for JWT token first
  const token = req.headers["x-access-token"] || req.headers.authorization?.split(' ')[1];
  
  if (token) {
    jwt.verify(token, config.secret, async (err, decoded) => {
      if (!err && decoded) {
        try {
          const user = await User.findById(decoded.id)
            .populate("roles", "-__v")
            .populate("clinicId", "name");
          
          if (user && user.isActive) {
            req.user = user;
            req.userId = user._id;
          }
        } catch (error) {
          console.error("Error populating user:", error);
        }
      }
      next();
    });
  } else if (req.session.user) {
    // Fall back to session
    req.user = req.session.user;
    req.userId = req.session.user._id;
    next();
  } else {
    next();
  }
}

function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    return res.status(401).send({ err: "Not logged in" });
  }
  next();
}

function logout(req, res) {
  if (req.user) {
    const userSocket = socketManager.getSocketFromUserID(req.user._id);
    if (userSocket) {
      socketManager.removeUser(req.user, userSocket);
    }
  }
  req.session.user = null;
  res.send({ success: true });
}

module.exports = {
  populateCurrentUser,
  ensureLoggedIn,
  logout
};



