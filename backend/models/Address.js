const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
  },
  usageCount: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

// Index for text search
addressSchema.index({ address: 'text' });

module.exports = mongoose.model('Address', addressSchema);
