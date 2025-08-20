const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const db = {};

db.mongoose = mongoose;

db.user = require("./models/user.model");
db.role = require("./models/role.model");
db.clinic = require("./models/clinic.model");

// Updated roles to include all 5 types
db.ROLES = ["user", "staff", "moderator", "doctor", "admin", "clinic_admin"];

module.exports = db;