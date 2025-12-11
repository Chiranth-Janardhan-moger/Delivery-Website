const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['money_given', 'money_pending', 'reminder', 'general'],
    default: 'general'
  },
  amount: {
    type: Number,
    default: 0
  },
  personName: {
    type: String,
    trim: true
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Note', noteSchema);
