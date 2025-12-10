const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For Direct Messages
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },   // For Group Messages
  content: { type: String },
  fileUrl: { type: String },
  type: { type: String, default: 'text', enum: ['text', 'image', 'audio', 'video'] },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
