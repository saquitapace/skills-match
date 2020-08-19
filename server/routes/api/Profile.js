const express = require('express');
const router = express.Router();
const cors = require('cors')
const config = require('../../config/config.json');
const dbSource = config.dbSource || 'mongoDB'; // Default to MongoDB if not specify (this value should match the folder name in the codebase)
const { getModel: mongoDBGetModel } = require('../../mongoDB/mongoDB');

var fs = require('fs');
router.use(cors());



const findUserInAdminDB = async(uid) => {
  console.log("findUserInAdminDB - MongoDB");
  const adminModel = mongoDBGetModel('Admin');
  return new Promise((resolve, reject) => {
    adminModel.findOne({ id: uid }, (err, doc) => {
      if (err) {
        console.log('failed to look up admins DB for employee with id ' + uid);
        console.log(err);
        reject(err);
      } else {
        // Return the admin object if found, or return null to indicate not found
        if (doc) {
          resolve(doc.toJSON());
        } else {
          resolve(null);
        }
      }
    });
  });
};

const populateEmployeeDocWithSkills = async(employeeDoc) => {
  if (employeeDoc.skills && employeeDoc.skills.length) {
    return new Promise((resolve, reject) => {
      let promises = [];
      const employeeJson = employeeDoc.toJSON();

      if (employeeDoc.skills && employeeDoc.skills.length) {
        // Populate the skill.id field with the actual skill details from the "skill" collection
        //  Then merge the "skills" collection's skill detail with the skill fields under the "employee"
        const skillModel = mongoDBGetModel('Skill');
        promises = promises.concat(employeeDoc.skills.map((s, index) => {
          return employeeDoc.populate(`skills.${index}.skillId`).execPopulate()
            .then(populatedEmployee => {
              const { skillId: populatedSkill } = populatedEmployee.skills[index].toJSON();
              const { _id, ...populatedSkillFields } = populatedSkill;
              const convertedSkillJson = {
                ...populatedSkillFields,
                ...employeeJson.skills[index],
              };
              employeeJson.skills[index] = convertedSkillJson;
            });
        }));
      }

      if (promises && promises.length) {
        Promise.all(promises)
          .then((err, data) => {
            resolve(employeeJson);
          })
          .catch(err => {
            reject(err);
          });
      } else {
        resolve(employeeJson);
      }
    });
  } else {
    return employeeDoc.toJSON();
  }
}

const findUserInEmployeeDB = async(id) => {
  const employeeModel = mongoDBGetModel('Employee');

  return new Promise((resolve, reject) => {
    employeeModel.findOne({ id: id }, async(err, doc) => {
      console.log('found employee');
      if (err) {
        console.log('error looking up employee with id ' + id);
        console.log(err);
        reject(err);
        return;
      }
      if (!doc) {
        console.log('employee with id ' + id + ' not found');
        resolve({});
        return;
      }

      let promises = [];
      const employeeJson = doc.toJSON();
      if (doc.skills && doc.skills.length) {
        // Populate the skill.skillId field with the actual skill details from the "skill" collection
        //  Then merge the "skills" collection's skill detail with the skill fields under the "employee"
        // const employeeJson = doc.toJSON();
        const skillModel = mongoDBGetModel('Skill');
        promises = promises.concat(doc.skills.map((s, index) => {
          return doc.populate(`skills.${index}.skillId`).execPopulate()
            .then(populatedEmployee => {
              const { skillId: populatedSkill } = populatedEmployee.skills[index].toJSON();
              const { _id, ...populatedSkillFields } = populatedSkill;
              const convertedSkillJson = {
                ...populatedSkillFields,
                ...employeeJson.skills[index],
              };
              employeeJson.skills[index] = convertedSkillJson;
            });
        }));
      }

      if (promises && promises.length) {
        Promise.all(promises)
          .then((err, data) => {
            resolve(employeeJson);
          })
          .catch(err => {
            reject(err);
          });
      } else {
        resolve(employeeJson);
      }
    });
  });
};

const getUserId = async(req) => {
  return new Promise((resolve, reject) => {
    if (req.user) {
      console.log("getUserId / req user exists ");
      var uid = req.user['_json']['uid'].substring(0, 6);
      console.log("uid = " + uid);
      resolve(uid);
    } else {
      console.log("getUserId / req user DOES NOT exists ");
      fs.readFile(__dirname + '/w3idResponse.json', 'utf8', (err, data) => {
        if (err || !data) {
          console.log("failed to read user id info from file /w3idResponse.json");
          reject(err);
        }

        try {
          // console.log(JSON.parse(data)['_json']['uid'])
          var uid = JSON.parse(data)['_json']['uid'].substring(0, 6);
          console.log("uid = " + uid);
          resolve(uid);
        } catch (ex) {
          console.log("exception encountered while parsing for the user id from file /w3idResponse.json");
          console.log(ex);
          reject(ex);
        }
      });
    }
  });
};
const getPeopleLikeYou = async(user) => {
  let skillMap = {};
  let hotSkills = {};
  // get skill-name-populated employees
  const employeesModel = mongoDBGetModel('Employee');
  try {
    const employees = await employeesModel.find({
      $or: [
        {
          SSA: user.SSA
        },
        {
          jobRole: user.jobRole
        }
      ]
    }).select("skills").populate("skills.skillId").exec();

    // for each skill count how many employees have
    employees.forEach((emp) => {
      emp.skills.forEach((s) => {
        if(!s.skillId || s.rating <= 3) {
          return;
        }
        if(!hotSkills[s.skillId.skill]) {
          hotSkills[s.skillId.skill] = s.skillId.hot;
        }
        if(skillMap[s.skillId.skill] == undefined) {
          skillMap[s.skillId.skill] = 1;
        } else {
          skillMap[s.skillId.skill] += 1;
        }
      });
    });

    // sort keys based on count
    const keys = Object.keys(skillMap).sort((a, b) => {
      return skillMap[b] - skillMap[a];
    });

    return keys.filter((key) => {
      return !user.skills.filter(skill => skill.rating >= 3)
                        .map(skill => skill.skill)
                        .includes(key);
    }).slice(0,10).map(key => {
      return {skill: key, hot: hotSkills[key]};
    });
  } catch (error) {
    console.log('error getting people like you informtion');
    return [];
  }
}
const getUserProfile = async(req) => {
  return getUserId(req)
    .then(async(uid) => {
      let returnVal = { uid: uid, admin: false, practitioner: false };

      // Check if user is a practitioner (in the employee db) or not
      try {
        const user = await findUserInEmployeeDB(uid);
        if (user) {
          user.uid = returnVal.uid;
          user.admin = returnVal.admin;
          user.practitioner = true;
          user.peopleLikeYou = await getPeopleLikeYou(user);
          returnVal = user;
        }
      } catch (e) {
        // Do Nothing
      }

      try {
        // Check if user is an admin/superuser or not
        const adminUser = await findUserInAdminDB(uid);
        if (adminUser) {
          returnVal.admin = true;
          returnVal.access = adminUser.access;
        }
      } catch (e) {
        // Do Nothing
      }

      return returnVal;
    })
    .catch((err) => {
      throw(err);
    });
};

// Get list of accessible  practices for the current signed in user
const getAccessiblePractices = async(req) => {
  const user = await getUserProfile(req);

  if (user && user.admin && user.access && user.access.practices) {
    const practices = user.access.practices;

    if (user.SSA && !practices.find(p => p.toLowerCase() === user.SSA.toLowerCase())) {
      practices.push(user.SSA);
    }
    return practices;
  } else if (user.SSA) {
    console.log('Not an admin user, just allow access to your own practice by default');
    return [user.SSA];
  } else {
    console.log('No practice information found');
    return null;
  }
};

const getSkills = async(req) => {
  return new Promise((resolve, reject) => {
    const skillGroupModel = mongoDBGetModel('SkillGroup');

    skillGroupModel.find((err, docArray) => {
      if (err) {
        console.log('error');
        console.log(err);
        reject(err);
        return;
      }

      if (!docArray || !docArray.length) {
        console.log('no skill groups found');
        resolve({});
        return;
      }

      // Populate the skill detail into the skills array of the skill group object
      const skillModel = mongoDBGetModel('Skill');
      const promises = docArray.map(async(doc) => {
        return doc.populate('skills').execPopulate();
      });
      Promise.all(promises)
        .then(populatedSkillGroups => {
          resolve(populatedSkillGroups.map(sg => sg.toJSON()));
        })
        .catch(err => {
          reject(err);
        });
    });
  });
};

const getSkillsMap = async() => {
  return new Promise((resolve, reject) => {
    getSkills()
      .then(skillGroupsArray => {
        // Go through each skill the employee has, and add the skill details into the response
        const skillsMap = {};
        skillGroupsArray.forEach(skillGroup => {
          if (skillGroup.skills && skillGroup.skills.length) {
            skillGroup.skills.forEach(skill => {
              skillsMap[skill.skill.toLowerCase()] = { ...skill, group: skillGroup.group };
            });
          }
        });

        resolve(skillsMap);
      })
      .catch(err => {
        resolve(null);
      });
  });
};

const getPractices = async(req, accessiblePractices) => {
  return new Promise((resolve, reject) => {
    const isAllAccessible = accessiblePractices && accessiblePractices.includes('*');

    const employeesModel = mongoDBGetModel('Employee');
    const condition = isAllAccessible ?
      {
        SSA: { $nin: [ null, '' ] },
      } : {
        SSA: { $in: accessiblePractices },
      };
    employeesModel.distinct('SSA', condition, (err, array) => {
      if (err) {
        console.log('error');
        console.log(err);
        reject(err);
        return;
      }

      if (!array || !array.length) {
        console.log('No practices found');
        resolve(null);
        return;
      }

      resolve(array);
      return;
    });
  });
};

router.get('/logout', (req, res)=> {
  console.log("SERVER: logging out")
  req.session.destroy();
  req.logout();
  res.redirect("/")
})

//@route  GET api/profile/test
//@desc   Testing the profile route
//@access Public
router.get('/test', (req, res) => res.json({ msg: "File Upoad works!" }));

//@route  GET api/profile/user
//@desc   Return User Profile
//@access Public
router.get('/user', (req, res) => { res.json({ user: req }); console.log("---------") });

//@route  GET /api/profile/
//@desc   Return User Profile
//@access Public
router.get('/', (req, res) => {
  getUserProfile(req)
    .then((user) => {
      res.send(user);
    })
    .catch((err) => {
      console.log('getUserProfileFromReq failed');
      console.log(err);
      res.status(500).end();
    });
});

//@route  GET /api/profile/skills
//@desc   Return list of available skill groups and skills
//@access Public
router.get('/skills', (req, res) => {
  getSkills(req)
    .then((user) => {
      res.json(user);
    })
    .catch((err) => {
      console.log('getSkills failed');
      console.log(err);
      res.status(500).end();
    });
});

//@route  GET /api/profile/practices
//@desc   Return list of available practices
//@access Public
router.get('/practices', async(req, res) => {
  const accessiblePractices = await getAccessiblePractices(req);
  getPractices(req, accessiblePractices)
    .then((practices) => {
      res.json(practices || []);
    })
    .catch((err) => {
      console.log('getPractices failed');
      console.log(err);
      res.status(500).end();
    });
});

//@route  PATCH /api/profile/goal/:id
//@desc   Add goals for the current skill id
//@access Public
router.patch('/goal/:id', (req, res) => {
  const { id: skillId } = req.params;
  const { goal } = req.body;
  const employeeModel = mongoDBGetModel('Employee');

  getUserId(req)
    .then(async(uid) => {
      try {
        const user = await findUserInEmployeeDB(uid);
        if (user) {
          if (goal) {
            employeeModel.updateOne({ id: uid, 'skills.skillId': skillId }, { $set: { 'skills.$.goal': goal } }, (err) => {
              if (err) {
                res.status(400).end();
                return;
              }
              res.end();
            })
          } else {
            employeeModel.updateOne({ id: uid, 'skills.skillId': skillId }, { $unset: { 'skills.$.goal': '' } }, (err) => {
              if (err) {
                res.status(400).end();
                return;
              }
              res.end();
            })
          }
        }
      } catch (e) {
        res.status(400).end();
      }
    })
    .catch((err) => {
      res.status(400).end();
    });
});

module.exports = {
  router,
  getUserId,
  getUserProfile,
  getAccessiblePractices,
  getSkills,
  getSkillsMap,
  populateEmployeeDocWithSkills,
  getPractices,
};
