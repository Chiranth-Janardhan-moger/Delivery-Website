const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  phone: {
    type: String,
    required: true,
  },
  houseFlatNumber: {
    type: String,
    default: '',
  },
  address: {
    type: String,
    default: '',
  },
  orderCount: {
    type: Number,
    default: 1,
  },
  lastOrderAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for fast name search
customerSchema.index({ name: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
