const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const multer = require("multer");
const xlstojson = require("xls-to-json-lc");
const xlsxtojson = require("xlsx-to-json-lc");
const os = require("os");
const config = require("../../config/config.json");
const dbSource = config.dbSource || "mongoDB"; // Default to MongoDB if not specify (this value should match the folder name in the codebase)
const { getModel: mongoDBGetModel } = require("../../mongoDB/mongoDB");

router.use(bodyParser.json());

const storage = multer.diskStorage({
  //multers disk storage settings
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const datetimestamp = Date.now();
    cb(
      null,
      file.fieldname +
        "-" +
        datetimestamp +
        "." +
        file.originalname.split(".")[file.originalname.split(".").length - 1]
    );
  }
});

const upload = multer({
  //multer settings
  storage: storage,
  fileFilter: (req, file, callback) => {
    //file filter
    if (
      ["xls", "xlsx"].indexOf(
        file.originalname.split(".")[file.originalname.split(".").length - 1]
      ) === -1
    ) {
      return callback(new Error("Wrong extension type"));
    }
    callback(null, true);
  }
}).single("file");

const queryExistingData = async () => {
  const employeeModel = mongoDBGetModel("Employee");
  return new Promise((resolve, reject) => {
    employeeModel.find((err, docArray) => {
      if (err) {
        console.log("failed to retrieve existing records before clear/save");
        console.log(err);
        reject(err);
        return;
      }

      if (!docArray || !docArray.length) {
        console.log("no existing employee records found");
        resolve();
        return;
      }

      const jsonData = {};
      docArray.forEach(obj => {
        if (obj && obj.id) {
          jsonData[obj.id] = obj;
        }
      });
      resolve(jsonData);
    });
  });
};

const clearDatabase = async () => {
  return new Promise((resolve, reject) => {
    const employeesModel = mongoDBGetModel("Employee");
    employeesModel.remove(err => {
      if (err) {
        console.log("failed to clear the database before saving");
        console.log(err);
        reject(err);
      } else {
        resolve(0);
      }
    });
  });
};

const rollbackDatabase = async recoveryData => {
  return new Promise((resolve, reject) => {
    // First build an array from the recovery data's map object structure
    const employeesArray = [];
    for (const key in recoveryData) {
      employeesArray.push(recoveryData[key]);
    }

    const modelInsertOptions = {
      new: true,
      upsert: true,
      sort: { id: "asc" },
      setDefaultsOnInsert: true,
      ordered: false
    };
    const employeesModel = mongoDBGetModel("Employee");
    employeesModel.insertMany(
      employeesArray,
      modelInsertOptions,
      (err, docArray) => {
        if (err || !docArray) {
          console.log("failed to rollback the dtabase");
          console.log(err);
          reject(err);
        } else {
          resolve(docArray);
        }
      }
    );
  });
};

const saveToDatabase = async (fileData, existingData) => {
  return new Promise((resolve, reject) => {
    let dataObj = {};

    const promiseArrays = fileData.map(async x => {
      const availableDate = x["available date"]
        ? new Date(x["available date"])
        : null;
      const todayDate = new Date();
      const availableDateString = availableDate
        ? availableDate.toString().substring(4, 15)
        : null;
      let availableIn = Math.ceil((availableDate - todayDate) / 86400000);
      availableIn = availableIn < 0 ? 0 : availableIn;

      var name = x.name;
      var nameStringArray = name.replace(/\s+/g, " ").split(" ");
      var firstName = nameStringArray[1];
      var lastName = nameStringArray[0];
      var convertedName = firstName + " " + lastName;

      var skills = [];
      if (
        existingData &&
        existingData[x.serial] &&
        existingData[x.serial].skills
      ) {
        // Populate the skills array with the existing skills data because they would not
        //  be in the uploaded spreadsheet file
        skills = existingData[x.serial].skills;
      }

      dataObj = {
        id: x.serial,
        name: convertedName,
        band: x.band,
        currentProject: x["current assignment"],
        rollOffDate: availableDateString,
        location: x.city,
        country: x.country,
        jobRole: x.jrss,
        availableIn: availableIn,
        skills: skills,
        BU: x["ytd billable util %"],
        CU: x["ytd charge util %"],
        PU: x["ytd prod util %"],
        SSA: x["service- service area"]
      };

      const modelUpdateOptions = {
        new: true,
        upsert: true,
        sort: { id: "asc" },
        setDefaultsOnInsert: true
      };
      const employeesModel = mongoDBGetModel("Employee");
      return new Promise((res, rej) => {
        employeesModel.findOneAndUpdate(
          { id: x.serial },
          dataObj,
          modelUpdateOptions,
          (err, doc) => {
            // employeesModel.create(dataObj, modelUpdateOptions, (err, doc) => {
            // console.log('findOneAndUpdate done');
            if (err || !doc) {
              console.log("failed to update employee with id " + x.serial);
              console.log(err);
              rej(dataObj);
            } else {
              res(doc);
            }
          }
        );
      });
    });

    // Use Promise.all to wait for all the update command completes for each record in the map
    Promise.all(promiseArrays)
      .then(data => {
        console.log(
          "successfully retrieved updated mongoDB database record after update"
        );
        // console.log(data);
        resolve(data);
      })
      .catch(err => {
        console.log("update failed for some record");
        console.log(err);
        reject(err);
      });
  });
};

//@route  GET api/file/test
//@desc   Testing the file upload route
//@access Public
router.get("/test", (req, res) => res.json({ msg: "File Upoad works!" }));

//@route  POST /api/file/upload
//@desc   Uploading Skills spreadsheet
//@access Public
/** API path that will upload the files */
router.post("/upload", (req, res) => {
  console.log("UPPLLLOOADDD -------- SABIN ");
  let exceltojson;
  upload(req, res, err => {
    if (err) {
      res.json({ error_code: 1, err_desc: err });
      return;
    }
    /** Multer gives us file info in req.file object */
    if (!req.file) {
      res.json({ error_code: 1, err_desc: "No file passed" });
      return;
    }
    /** Check the extension of the incoming file and
     *  use the appropriate module
     */
    if (
      req.file.originalname.split(".")[
        req.file.originalname.split(".").length - 1
      ] === "xlsx"
    ) {
      exceltojson = xlsxtojson;
    } else {
      exceltojson = xlstojson;
    }
    try {
      exceltojson(
        {
          input: req.file.path,
          output: null, //since we don't need output.json
          lowerCaseHeaders: true
        },
        (err, result) => {
          if (err) {
            return res.json({ error_code: 1, err_desc: err, data: null });
          }
          // 1) First get all existing records from the database
          queryExistingData()
            .then(existinData => {
              // 2) Then clear the database first to start fresh
              clearDatabase()
                .then(() => {
                  // 3) Save the file content into the database
                  saveToDatabase(result, existinData)
                    .then(data => {
                      // Successfully updated the database
                      // Convert the "data" array into an object in the json response
                      const jsonData = {};
                      data.forEach(obj => (jsonData[obj.id] = obj));
                      res.json(jsonData);
                    })
                    .catch(saveErr => {
                      // 3b) In case of save failure, try to recovery with the previously existing data
                      rollbackDatabase(existinData)
                        .then(recoveredData => {
                          if (saveErr) {
                            return res.json({
                              error_code: 1,
                              err_desc:
                                "Some updates failed, recovered with previous data.",
                              data: saveErr
                            });
                          } else {
                            return res.json({
                              error_code: 1,
                              err_desc:
                                "Update failed, recovered with previous data."
                            });
                          }
                        })
                        .catch(rollbackErr => {
                          if (saveErr) {
                            return res.json({
                              error_code: 1,
                              err_desc:
                                "Some updates failed, and recovery also failed",
                              data: saveErr
                            });
                          } else {
                            return res.json({
                              error_code: 1,
                              err_desc:
                                "Update failed, and recovery also failed"
                            });
                          }
                        });
                    });
                })
                .catch(err => {
                  res.json({
                    error_code: 1,
                    err_desc: "Failed to clear database before saving",
                    data: err
                  });
                });
            })
            .catch(err => {
              res.json({
                error_code: 1,
                err_desc:
                  "Failed to query existing database records before clear/saving",
                data: err
              });
            });
        }
      );
    } catch (e) {
      res.json({ error_code: 1, err_desc: "Corrupted excel file" });
    }
  });
});

module.exports = {
  router
};