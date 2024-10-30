const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  tokenExpiry: {
    type: Date,
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);