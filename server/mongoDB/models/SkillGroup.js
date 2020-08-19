const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const SkillGroupSchema = new Schema({
  group: {
    type: String,
    required: true,
  },
  skills: [{
    type: Schema.Types.ObjectId,
    ref: 'skills',
  }],
  ratingType: {
    type: String,
    default: null,
  }
});

module.exports = SkillGroup = mongoose.model('skillgroups', SkillGroupSchema);
