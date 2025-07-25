const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const db = {};

db.mongoose = mongoose;

db.user = require("./user.model");
db.role = require("./role.model");
db.clinic = require("./clinic.model");

db.ROLES = ['user', 'doctor', 'staff', 'admin', 'clinic_admin', 'moderator'];

module.exports = db;
