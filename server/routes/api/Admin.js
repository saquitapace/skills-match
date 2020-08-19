const express = require('express');
const router = express.Router();
const cors = require('cors');
const log4js = require('log4js');
const config = require('../../config/config.json');
const dbSource = config.dbSource || 'mongoDB'; // Default to MongoDB if not specify (this value should match the folder name in the codebase)
const { database, getModule } = require(`../../${dbSource}/${dbSource}`);
const { getModel: mongoDBGetModel } = require('../../mongoDB/mongoDB');
const { getUserProfile } = require('./Profile');

log4js.configure(config.log4js);
const logger = log4js.getLogger('ADM');

var fs = require('fs');
router.use(cors());

const addSkillToSkillGroup = async (skillGroupDoc, skillId) => {
  return new Promise((resolve, reject) => {
    if (!skillGroupDoc.skills) {
        skillGroupDoc.skills = [];
    }

    if (typeof skillId === 'string') {
      skillGroupDoc.skills.push(getModule().Types.ObjectId(skillId));
    } else {
      skillGroupDoc.skills.push(skillId);
    }
    skillGroupDoc.markModified('skills');
    skillGroupDoc.save((err, doc) => {
      if (err || !doc) {
        const msg = `add skill ${skillId} to skill group ${skillGroupDoc.groupId} failed`;
        console.log(msg);
        console.log(err);
        reject(msg);
        return;
      }

      console.log(`successfully added skill ${skillId} to group ${skillGroupDoc.groupId}`);
      resolve();
    });
  });
};

const removeSkillFromSkillGroup = async (skillGroupDoc, skillId) => {
  return new Promise((resolve, reject) => {
    if (!skillGroupDoc.skills) {
      const msg = `no skills to remove from in the existing skill group ${skillGroupDoc.groupId}`;
      console.log(msg);
      reject(msg);
      return;
    }

    const index = skillGroupDoc.skills.findIndex(s => s.toString() === skillId);
    if (index < 0) {
      const msg = `skill ${skillId} not found in skill group ${skillGroupDoc.groupId}`;
      console.log(msg);
      reject(msg);
      return;
    }

    skillGroupDoc.skills.splice(index, 1);
    skillGroupDoc.markModified('skills');
    skillGroupDoc.save((err, doc) => {
      if (err || !doc) {
        const msg = `remove skill ${skillId} from skill group ${skillGroupDoc.groupId} failed`;
        console.log(msg);
        console.log(err);
        reject(msg);
        return;
      }

      console.log(`successfully removed skill ${skillId} from group ${skillGroupDoc.groupId}`);
      resolve();
    });
  });
};

// Protect this set of /api/admin APIs from unauthorized access by regular users
router.use(async(req, res, next) => {
  const user = await getUserProfile(req);
  if (user && user.admin) {
    next();
  } else {
    res.status(401).end();
  }
});


const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

//@route  GET /api/admin/all
//@desc   Get list of admins
//@access Public
router.get('/all', async(req, res) => {
  const adminModel = mongoDBGetModel('Admin');

  adminModel.find((err, docArray) => {
    console.log('found admins');
    if (err) {
      console.log('error');
      console.log(err);
      res.status(400).end();
      return;
    }

    if (!docArray || !docArray.length) {
      console.log('no admin found');
      res.json({});
      return;
    }

    const jsonData = {};
    docArray.forEach(adminDoc => {
      if (adminDoc && adminDoc.id) {
        jsonData[adminDoc.id] = adminDoc.toJSON();
      }
    })
    res.json(jsonData);
  });
});

router.delete('/removeAdmin', async(req, res) => {
  const {adminToDelete} = req.body;
  try {
    const AdminModel = mongoDBGetModel('Admin');
    const filter = {id: adminToDelete.id, name: adminToDelete.name};
    await AdminModel.findOneAndRemove(filter);
  } catch (err) {
    console.log(err);
    const msg = "Removing admin failed";
    res.status(400).json({ msg: msg });
    return;
  }
  console.log('Succesfully removed admin');
  res.status(200).end();
});


//@route  POST /api/admin/updateAdmins
//@desc   Add a new skill to an existing skill group.
//@access Private (TODO)
router.post('/updateAdmins', async(req, res) => {
  const adminsToUpdate = req.body.adminsToUpdate;
  const AdminModel = mongoDBGetModel('Admin');
  adminsToUpdate.forEach(async admin => {
    const filter = {id: admin.id, name: admin.name};
    const update = {access: admin.access};
    try {
      let doc = await AdminModel.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true // Make this update into an upsert
      });
    } catch (err) {
      const msg = "Updating admins failed";
      res.status(400).json({ msg: msg });
      return;
    }
    
  });
  console.log('Succesfully updated admins');
  res.status(200).end();
});


//@route  POST /api/admin/skill/:id/:type
//@desc   Add a new skill to an existing skill group.
//@access Public
router.post('/skill/:id/:type', async(req, res) => {
  const {
    group,
    groupId,
  } = req.body.group;
  const skill = req.body.skill;
  const { params } = req;

  const skillModel = mongoDBGetModel('Skill');
  const skillGroupModel = mongoDBGetModel('SkillGroup');

  // First look up the indicated skill group
  skillGroupModel.findOne({ groupId: groupId }, (err, skillGroupDoc) => {
    if (err) {
      const msg = `error in looking up skill group found with groupId ${groupId}`;
      console.log(err);
      res.status(400).end();
      return;
    }

    if (!skillGroupDoc) {
      const msg = `no skill group found with groupId ${groupId}`;
      console.log(msg);
      console.log(err);
      res.status(400).json({ msg: msg });
      return;
    }

    // Then check if the skill already exist or not
    skillModel.findOne(
      { skill: { $regex: new RegExp('^'+ escapeRegExp(skill) + '$', "i") } },
      (err, doc) => {
        if (err) {
          console.log('error');
          console.log(err);
          res.status(400).end();
          return;
        }

        if (doc) {
          const msg = 'skill already exists';
          console.log(msg);
          console.log(err);
          res.status(400).json({ msg: msg });
          return;
        }

        // Create the new skill
        skillModel.create({ skill, hot: false }, (err, newSkillDoc) => {
          if (err) {
            const msg = 'failed to create new skill';
            console.log(msg);
            console.log(err);
            res.status(500).json({ msg: msg });
            return;
          }

          // Add the newly created skill's _id into the respective skill group
          const newSkillId = newSkillDoc._id;
          if (!skillGroupDoc.skills) {
              skillGroupDoc.skills = [];
          }

          skillGroupDoc.skills.push(newSkillId);
          skillGroupDoc.markModified('skills');
          skillGroupDoc.save((err, doc) => {
            if (err) {
              const msg = 'add skill failed';
              console.log(msg);
              console.log(err);
              res.status(500).json({ msg: msg });
              return;
            }

            console.log(`successfully added skill ${skill} to group ${doc.group}`);
            logger.info(params.id + ' ' + params.type + " \"" + skill + "\" TO GROUP \"" + group + " (" + groupId + ")\"");
            res.status(200).end();
          });
        });
      });
  });
});

//@route  DELETE /api/admin/skill/:id/:type
//@desc   Delete a skill from an existing skill group.
//@access Public
router.delete('/skill/:id/:type', (req, res) => {
  const {
    group,
    groupId,
  } = req.body.group;
  const skill = req.body.skill;
  const { params } = req;

  const skillModel = mongoDBGetModel('Skill');
  skillModel.findByIdAndDelete(skill._id, (err, skillDocDeleted) => {
    if (err) {
      console.log('error');
      console.log(err);
      res.status(400).end();
      return;
    }

    if (!skillDocDeleted) {
      const msg = `skill with _id ${skill._id} not found for deletion`;
      console.log(msg);
      res.status(400).json({ msg: msg });
      return;
    }

    // Then also remove the reference to this skill in the skillgroups and employees collections
    const skillGroupModel = mongoDBGetModel('SkillGroup');
    const employeeModel = mongoDBGetModel('Employee');

    skillGroupModel.updateMany(
      { skills : skill._id},
      { $pull: { skills: skill._id } },
      (skillGroupErr, skillGroup) => {
        if (skillGroupErr) {
          console.log('error updating skill groups');
          console.log(skillGroupErr);
        } else if (!skillGroup) {
          console.log(`no skill group found`);
        }

        employeeModel.updateMany(
            { "skills.skillId" : skill._id },
            { $pull: { skills: { skillId: skill._id} } },
            (employeeErr, employee) => {
              if (employeeErr) {
                console.log('error updating employees');
                console.log(employeeErr);
              } else if (!employee) {
                console.log(`no employees found`);
              }

              // Can now return a successful resposne
            const msg = 'successfully deleted skill (and attempted updating existing skill group/employee)';
            console.log(msg);
            logger.info(params.id + ' ' + params.type + " \"" + skill.skill + "\" FROM GROUP \"" + group + " (" + groupId + ")\"");
            res.status(200).json({ msg: msg });
        });
    });
  });
});

//@route  PATCH /api/admin/skill/:id/:type
//@desc   Update the details of an existing skill
//@access Public
router.patch('/skill/:id/:type', (req, res) => {
  const { skill } = req.body;
  const {
    group,
    groupId,
  } = req.body.group;
  const { id, type } = req.params;
  const { _id, ...fields } = skill;

  const skillModel = mongoDBGetModel('Skill');
  // Then check if the skill already exist or not
  skillModel.findOne(
    { skill: { $regex: new RegExp('^'+ escapeRegExp(skill.skill) + '$', "i") } },
    (err, doc) => {
      if (err) {
        console.log('error');
        console.log(err);
        res.status(400).end();
        return;
      }

      if (doc) {
        const msg = 'skill already exists';
        console.log(msg);
        console.log(err);
        res.status(400).json({ msg: msg });
        return;
      }

      skillModel.findByIdAndUpdate(skill._id, { ...fields }, (err, doc) => {
        if (err) {
          const msg = `failed to look up skill with _id ${skill._id}`;
          console.log(msg);
          res.status(400).end({ msg: msg });
          return;
        }

        if (!doc) {
          const msg = `skill with _id ${skill._id} not found`;
          console.log(msg);
          res.status(400).json({ msg: msg });
          return;
        }

        console.log(`successfully updated skill ${skill.skill} with fields ${fields}`);
        logger.info(id + ' ' + type + " \"" + skill.skill + "\" IN GROUP \"" + group + " (" + groupId + ")\"");
        res.status(200).end();
      });
  })
});

//@route  PATCH /skill/:skillId/:oldSkillId/:id/:type
//@desc   Update the details of an existing skill
//@access Public
router.patch('/skill/:skillId/:oldSkillId/:id/:type', (req, res) => {
  const { skillId, oldSkillId, id, type } = req.params;

  const skillModel = mongoDBGetModel('Skill');
  const employeesModel = mongoDBGetModel('Employee');

  employeesModel.find({ "skills.skillId": oldSkillId }, (err, doc) => {
    if (err) {
      const msg = `failed to find employee`;
      console.log(msg);
      res.status(400).end({ msg: msg });
      return;
    }

    if (!doc) {
      const msg = `skill with _id ${oldSkillId} not found`;
      console.log(msg);
      res.status(400).json({ msg: msg });
      return;
    }

    doc.forEach(employee => {
      const employeeId = employee.id;
      let maxRating = 0;
      employee.skills.forEach(skill => {
        if (skill.skillId.toString() === skillId || skill.skillId.toString() === oldSkillId) {
          maxRating = skill.rating ? Math.max(parseInt(maxRating), parseInt(skill.rating)) : maxRating;
        }
      })
      
      employeesModel.update({ "id": employeeId }, { $pull: { skills: { skillId: { $in: [skillId, oldSkillId]}}}}, (err,doc) => {
        if (err) {
          const msg = `failed to merge skill`;
          console.log(msg);
          res.status(400).end({ msg: msg });
          return;
        }
  
        if (!doc) {
          const msg = `no practitioner with skills found`;
          console.log(msg);
          res.status(400).json({ msg: msg });
          return;
        }

        const newSkill = {
          skillId,
          rating : maxRating > 0 ? maxRating : null,
        }

        employeesModel.update({ "id": employeeId }, { $push: { skills: newSkill}}, (err, doc) => {
          if (err) {
            const msg = `failed to merge skill`;
            console.log(msg);
            res.status(400).end({ msg: msg });
            return;
          }
        });
      });
    });

    skillModel.findOneAndDelete({_id : oldSkillId}, (err, doc) => {
      if (err) {
        const msg = `failed to delete old skill`;
        console.log(msg);
        res.status(400).end({ msg: msg });
        return;
      }

      if (!doc) {
        const msg = `skill ${oldSkillId} not found`;
        console.log(msg);
        res.status(400).json({ msg: msg });
        return;
      }

      console.log(`successfully merged skill ${oldSkillId} with skill ${skillId}`);
      logger.info(id + ' ' + type + " \"" + oldSkillId + "\" WITH \"" + skillId);
      res.status(200).end();
    })
  })
});

//@route  PATCH /api/admin/skill/:skillId/group/:groupId/:id/:type
//@desc   Move/assign a skill to a skill group
//@access Public
router.patch('/skill/:skillId/group/:groupId/:id/:type', (req, res) => {
  const { skillId, group, groupId, id, type } = req.params;
  const { group: originGroup, fromGroup, fromGroupId, skill: skillMoved} = req.body;

  const skillModel = mongoDBGetModel('Skill');
  skillModel.findById(skillId, (err, skill) => {
    if (err) {
      const msg = `failed to look up skill with _id ${skillId}`;
      console.log(msg);
      res.status(400).end({ msg: msg });
      return;
    }

    if (!skill) {
      const msg = `skill with _id ${skillId} not found`;
      console.log(msg);
      res.status(400).json({ msg: msg });
      return;
    }

    // Confirmed skill exists, so look up the target skill group now
    const skillGroupModel = mongoDBGetModel('SkillGroup');
    skillGroupModel.findOne({ groupId: groupId }, async (err, skillGroup) => {
      if (err) {
        const msg = `failed to look up skill group with id ${groupId}`;
        console.log(msg);
        res.status(400).end({ msg: msg });
        return;
      }

      if (!skillGroup) {
        const msg = `skill group with id ${groupId} not found`;
        console.log(msg);
        res.status(400).json({ msg: msg });
        return;
      }

      // Confirmed target skill group is found
      // Check if skill is already in the target skill group
      if (skillGroup.skills && !!skillGroup.skills.find(s => s.toString() === skillId)) {
        const msg = `skill with _id ${skill._id} already exist in group with id ${groupId}`;
        console.log(msg);
        res.status(400).json({ msg: msg });
        return;
      }

      if (fromGroupId) {
        const skillGroupModel2 = mongoDBGetModel('SkillGroup');
        skillGroupModel2.findOne({ groupId: fromGroupId }, async (err, previousSkillGroup) => {
          if (err) {
            const msg = `failed to look up the previous skill group with id ${fromGroupId}`;
            console.log(msg);
            res.status(400).end({ msg: msg });
            return;
          }

          if (!previousSkillGroup) {
            const msg = `previous skill group with id ${fromGroupId} not found`;
            console.log(msg);
            res.status(400).json({ msg: msg });
            return;
          }

          try {
            await addSkillToSkillGroup(skillGroup, skillId);
          } catch(err) {
            res.status(500).json({ msg: err });
            return;
          };

          try {
            await removeSkillFromSkillGroup(previousSkillGroup, skillId);
            res.status(200).end();
          } catch(err) {
            // Still treat as successful operation
            res.status(200).end({ msg: err });
            return;
          };
          logger.info(id + ' ' + type + " \"" + skillMoved + "\" FROM GROUP \"" + fromGroup + " (" + fromGroupId + ")\" TO \"" + originGroup+ " (" + groupId + ")\"");
        });
      } else {
        try {
          await addSkillToSkillGroup(skillGroup, skillId);
          res.status(200).end();
        } catch(err) {
          res.status(500).json({ msg: err });
        };
      }
    });
  });
});

module.exports = {
  router
};
