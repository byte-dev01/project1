const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: false,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: true 
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic"
  },
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role"
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  refreshToken: {
    type: String,
    select: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if user has a specific role
UserSchema.methods.hasRole = function(roleName) {
  return this.roles.some(role => role.name === roleName);
};

// Method to get user data without sensitive fields
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", UserSchema);

