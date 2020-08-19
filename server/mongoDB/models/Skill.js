const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const SkillSchema = new Schema({
  skill: {
    type: String,
    required: true,
  },
  skillId: {
    type: String,
  },
  hot: {
    type: Boolean,
  }
});

SkillSchema.path('skillId').get(function() {
    return this._id;
});
SkillSchema.set('toJSON', { getters: true, virtuals: false });

module.exports = Skill = mongoose.model('skills', SkillSchema);
