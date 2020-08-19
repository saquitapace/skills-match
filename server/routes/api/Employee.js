const express = require("express");
const router = express.Router();
const cors = require("cors");
const log4js = require("log4js");
const { getModel } = require("../../mongoDB/mongoDB");
const config = require("../../config/config.json");
const {
  getSkillsMap,
  populateEmployeeDocWithSkills,
  getAccessiblePractices
} = require("./Profile");
var fs = require("fs");

log4js.configure(config.log4js);
const talentLogger = log4js.getLogger("TAL");
const profileLogger = log4js.getLogger("PRO");

router.use(cors());

const getEmployeeById = async (id, accessiblePractices) => {
  if (accessiblePractices && accessiblePractices.length) {
    const isAllAccessible =
      accessiblePractices && accessiblePractices.includes("*");

    const employeeModel = getModel("Employee");
    const practiceCondition = isAllAccessible
      ? {
          SSA: { $nin: [null, ""] }
        }
      : {
          SSA: { $in: accessiblePractices }
        };
    return new Promise((resolve, reject) => {
      const conditions = {
        id: id,
        $or: [practiceCondition, { SSA: { $exists: false } }]
      };
      employeeModel.findOne(conditions, null, null, async (err, doc) => {
        console.log("found employee");
        if (err) {
          console.log("error looking up employee with id " + id);
          console.log(err);
          reject(err);
          return;
        }
        if (!doc) {
          console.log("employee with id " + id + " not found");
          resolve({});
          return;
        }

        // Populate reference id fields
        try {
          const employee = await populateEmployeeDocWithSkills(doc);
          resolve(employee);
        } catch (e) {
          reject(e);
        }
      });
    });
  } else {
    throw "No practices provided";
  }
};

//@route  GET /api/employee/
//@desc   Return a list of all employees
//@access Public
router.get("/all", async (req, res) => {
  const accessiblePractices = await getAccessiblePractices(req);

  if (!accessiblePractices || !accessiblePractices.length) {
    res.status(403).json({ msg: "not authorized to access any practices" });
  } else {
    const isAllAccessible =
      accessiblePractices && accessiblePractices.includes("*");

    const employeeModel = getModel("Employee");
    const practiceCondition = isAllAccessible
      ? {
          SSA: { $nin: [null, ""] }
        }
      : {
          SSA: { $in: accessiblePractices }
        };
    const conditions = {
      $or: [practiceCondition, { SSA: { $exists: false } }]
    };
    employeeModel.find(conditions, null, null, async (err, docArray) => {
      console.log("found employees");
      if (err) {
        console.log("error");
        console.log(err);
        res.status(400).end();
        return;
      }

      if (!docArray || !docArray.length) {
        console.log("no employees found");
        res.json({});
        return;
      }

      const jsonData = {};
      docArray.forEach(employeeDoc => {
        if (employeeDoc && employeeDoc.id) {
          jsonData[employeeDoc.id] = employeeDoc.toJSON();
        }
      });
      res.json(jsonData);
    });
  }
});

//@route  GET /api/employee/:id
//@desc   Return a specific employee by id
//@access Public
router.get("/:id", async (req, res) => {
  const accessiblePractices = await getAccessiblePractices(req);
  if (!accessiblePractices || !accessiblePractices.length) {
    res.status(403).json({ msg: "not authorized to access any practices" });
    return;
  }

  getEmployeeById(req.params.id, accessiblePractices)
    .then(data => {
      res.json(data || {});
    })
    .catch(err => {
      res.status(400).end();
    });
});

//@route DELETE /api/employee/removeEmployee
//@desc  Delete employee
//@access Public

router.delete("/removeEmployee", async (req, res) => {
  const { employeeToDelete } = req.body;
  try {
    const EmployeeModel = getModel("Employee");
    const filter = { id: employeeToDelete.id, name: employeeToDelete.name };
    await EmployeeModel.findOneAndRemove(filter);
  } catch (err) {
    console.log(err);
    const msg = "Removing employee failed";
    res.status(400).json({ msg: msg });
  }
  console.log("Successfully removed employee");
  res.status(200).end();
});

//@route  POST /api/employee/skills/:id/:type
//@desc   Update an existing employee by id
//@access Public
router.post("/skills/:id/:type", (req, res) => {
  const { uid, skills, name } = req.body;
  const { params } = req;

  let skillsString = "SKILLS:";
  skills.forEach(
    skill =>
      (skillsString = skillsString.concat(
        " ",
        skill.skill,
        " (",
        skill.rating,
        "),"
      ))
  );
  skillsString = skillsString.slice(0, -1);

  const employeeModel = getModel("Employee");
  const modelUpdateOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  };
  const employeesModel = getModel("Employee");
  employeesModel.findOneAndUpdate(
    { id: params.id },
    {
      $set: {
        skills,
        lastModified: new Date().getTime(),
        lastModifiedBy: name
      }
    },
    modelUpdateOptions,
    async (err, doc) => {
      if (err) {
        console.log("error");
        console.log(err);
        res.status(400).end();
        return;
      }
      console.log(uid + " updated employee with id " + params.id);
      if (uid === params.id)
        profileLogger.info(uid + " " + params.type + " " + skillsString);
      else
        talentLogger.info(
          uid + " " + params.type + " " + params.id + " " + skillsString
        );

      try {
        const jsonData = await populateEmployeeDocWithSkills(doc);
        res.json(jsonData);
      } catch (e) {
        console.log("failed to populate employee with skills details");
        res.json(doc.toJSON());
      }
    }
  );

});

module.exports = {
  router
};
