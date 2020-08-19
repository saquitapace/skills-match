const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const AdminSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  access: {
    setupAccess: Boolean,
    writeAccess: Boolean,
    practices: [{
      type: String,
    }],
  }
});

module.exports = Admins = mongoose.model('admins', AdminSchema);
