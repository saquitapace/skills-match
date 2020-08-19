const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const PreviousEmployeeSchema = new Schema({
  availableIn: {
    type: Number
  },
  band: {
    type: String
  },
  currentProject: {
    type: String
  },
  id: {
    type: String,
    required: true
  },
  cnum: {
    type: String,
    required: true
  },
  jobRole: {
    type: String
  },
  status: {
    type: String
  },
  location: {
    type: String
  },
  country: {
    type: String
  },
  name: {
    type: String,
    required: true
  },
  rollOffDate: {
    type: String
  },
  skillAdding: {
    rating: {
      type: String
    },
    skill: {
      type: String
    }
  },
  skills: [
    {
      rating: {
        type: String
      },
      goal: {
        rating: {
          type: String
        },
        quarter: {
          type: String
        },
        year: {
          type: String
        }
      },
      skillId: {
        type: Schema.Types.ObjectId,
        ref: "skills"
      }
    }
  ],
  lastModified: {
    type: String
  },
  lastModifiedBy: {
    type: String
  },
  BU: {
    type: String
  },
  CU: {
    type: String
  },
  PU: {
    type: String
  },
  SSA: {
    type: String
  },
  SRM: {
    type: String
  }
});

module.exports = PreviousEmployee = mongoose.model("previousEmployees", PreviousEmployeeSchema);
