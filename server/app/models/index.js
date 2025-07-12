const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const db = {};

db.mongoose = mongoose;

db.user = require("./user.model");
db.role = require("./role.model");

db.ROLES = ['patient', 'doctor', 'nurse', 'admin', 'clinic_admin', 'moderator'];

module.exports = db;
