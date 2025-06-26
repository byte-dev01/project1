// Simplified demo-only auth - no Google OAuth needed for now
const User = require("./models/user"); // ← MUST be uncommented for database operations
const socketManager = require("./server-socket");

// accepts a login token from the frontend, and verifies that it's legit
function verify(token) {
  // Only handle demo token for now
  if (token === "demo-token-12345") {
    console.log("🎭 Demo token detected, skipping Google verification");
    return Promise.resolve({
      sub: "demo-user-12345",
      name: "Demo User",
      email: "demo@example.com"
    });
  }
  
  // Reject any non-demo tokens
  console.log("❌ Non-demo token rejected:", token);
  return Promise.reject(new Error("Only demo tokens are supported right now"));
}

// gets user from DB, or makes a new account if it doesn't exist yet
function getOrCreateUser(user) {
  // the "sub" field means "subject", which is a unique identifier for each user
  return User.findOne({ googleid: user.sub }).then((existingUser) => {
    if (existingUser) {
      console.log(`✅ Found existing user: ${existingUser.name}`);
      return existingUser;
    }

    console.log(`👤 Creating new user: ${user.name}`);
    const newUser = new User({
      name: user.name,
      googleid: user.sub,
    });

    return newUser.save();
  });
}

function login(req, res) {
  console.log(`🔑 Login attempt with token: ${req.body.token?.substring(0, 20)}...`);
  
  verify(req.body.token)
    .then((user) => {
      console.log(`✅ Token verified for user: ${user.name}`);
      return getOrCreateUser(user);
    })
    .then((user) => {
      // persist user in the session
      req.session.user = user;
      console.log(`🎉 User logged in successfully: ${user.name} (ID: ${user._id})`);
      res.send(user);
    })
    .catch((err) => {
      console.log(`❌ Failed to log in: ${err.message || err}`);
      res.status(401).send({ err: err.message || err });
    });
}

function logout(req, res) {
  if (req.user) {
    const userSocket = socketManager.getSocketFromUserID(req.user._id);
    if (userSocket) {
      // delete user's socket if they logged out
      socketManager.removeUser(req.user, userSocket);
    }
    console.log(`👋 User logged out: ${req.user.name}`);
  }

  req.session.user = null;
  res.send({});
}

function populateCurrentUser(req, res, next) {
  // simply populate "req.user" for convenience
  req.user = req.session.user;
  next();
}

function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    return res.status(401).send({ err: "not logged in" });
  }

  next();
}

module.exports = {
  login,
  logout,
  populateCurrentUser,
  ensureLoggedIn,
};