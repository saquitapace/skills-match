const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const xlstojson = require("xls-to-json-lc");
const xlsxtojson = require("xlsx-to-json-lc");
const os = require("os");
const log4js = require("log4js");
const config = require("../../config/config.json");
const { getModel: mongoDBGetModel } = require("../../mongoDB/mongoDB");
const { addLeadingZeros } = require("../../util/formatHelper");

const router = express.Router();
log4js.configure(config.log4js);
const logger = log4js.getLogger("ADM");

// Source Excel file column headers (NOTE: need to be defined/converted into all lower cases)

const headersDict = {
  FILE_COLUMN_SERIAL: ["serial"], // REQUIRED
  FILE_COLUMN_CNUM: ["cnum"], // REQUIRED
  FILE_COLUMN_NAME: ["name", "practitioner name"], // REQUIRED
  FILE_COLUMN_BAND: ["band"], // REQUIRED
  FILE_COLUMN_JRSS: ["job role specialty", "jr/s", "jrs"], // REQUIRED
  FILE_COLUMN_JR: ["job role"], // JOB ROLE ALT
  FILE_COLUMN_SPECIALTY: ["specialty"], // SPECIALTY ALT
  FILE_COLUMN_SSA: ["service- service area"], // REQUIRED
  FILE_COLUMN_SERVICE: ["service"], // SERVICE ALT
  FILE_COLUMN_SA: ["service area"], // SERVICE AREA ALT
  FILE_COLUMN_AVAILABLE_DATE: [
    "availability date",
    "find prof avail date",
    "avail date",
    "avail"
  ],
  FILE_COLUMN_CURRENT_ASSIGNMENT: [
    "current assignment",
    "project",
    "current client name",
    "clients"
  ],
  FILE_COLUMN_CITY: ["city", "resource work city"],
  FILE_COLUMN_COUNTRY: ["country"],
  FILE_COLUMN_YTD_BU: [
    "ytd billable util %",
    "bill ytd %",
    "ytd billable %",
    "ute bill"
  ],
  FILE_COLUMN_YTD_CU: [
    "ytd charge util %",
    "chg ytd %",
    "ytd charge %",
    "ute chg"
  ],
  FILE_COLUMN_YTD_PU: [
    "ytd prod util %",
    "prod ytd %",
    "ytd prod %",
    "ut prod"
  ],
  FILE_COLUMN_STATUS: ["status"],
  FILE_COLUMN_SRM: ["srm"],
  FILE_TARGET_SHEET: ["Results", "Resources", "Sheet1"]
};

router.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const datetimestamp = Date.now();
    cb(
      null,
      `${file.fieldname}-${datetimestamp}.${
        file.originalname.split(".")[file.originalname.split(".").length - 1]
      }`
    );
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (
      ["xls", "xlsx", "xlsm"].indexOf(
        file.originalname.split(".")[file.originalname.split(".").length - 1]
      ) === -1
    ) {
      return callback(new Error("Wrong extension type"));
    }
    return callback(null, true);
  }
}).single("file");

const queryExistingData = async () => {
  // MongoDB Integration
  const employeeModel = mongoDBGetModel("Employee");
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line array-callback-return
    employeeModel.find((err, docArray) => {
      if (err) {
        logger.error("failed to retrieve existing records before clear/save");
        logger.error(err);
        reject(err);
        return;
      }

      if (!docArray || !docArray.length) {
        logger.info("no existing employee records found");
        resolve();
        return;
      }

      const jsonData = {};
      docArray.forEach(obj => {
        if (obj && obj.cnum) {
          jsonData[obj.cnum] = obj;
        }
      });
      resolve(jsonData);
    });
  });
};

const rollbackDatabase = async recoveryData =>
  new Promise((resolve, reject) => {
    // TODO: MongoDB Integration
    // First build an array from the recovery data's map object structure
    const employeesArray = [];

    Object.values(recoveryData).forEach(val => {
      employeesArray.push(val);
    });

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
          logger.error("failed to rollback the database");
          logger.error(err);
          reject(err);
        } else {
          resolve(docArray);
        }
      }
    );
  });

const validateExcelRow = (record, headers, index) => {
  if (!record[headers.FILE_COLUMN_SERIAL]) {
    return {
      message: `"Serial" value missing for the record at index ${index} (Excel row ${index +
        2})`
    };
  }
  if (!record[headers.FILE_COLUMN_CNUM]) {
    return {
      message: `"CNUM" value missing for the record at index ${index} (Excel row ${index +
        2})`
    };
  }
  if (record[headers.FILE_COLUMN_CNUM].length !== 9) {
    return {
      message: `"CNUM" value is not 9 digits at index ${index} (Excel row ${index +
        2})`
    };
  }
  if (!record[headers.FILE_COLUMN_NAME]) {
    return {
      message: `"Name" value missing for the record at index ${index} (Excel row ${index +
        2})`
    };
  }
  if (!record[headers.FILE_COLUMN_BAND]) {
    return {
      message: `"Band" value missing for ${record.name} (${record.cnum}) at index ${index}`
    };
  }
  if (
    !record[headers.FILE_COLUMN_JRSS] &&
    !(record[headers.FILE_COLUMN_JR] && record[headers.FILE_COLUMN_SPECIALTY])
  ) {
    return {
      message: `"JRSS" value missing for ${record.name} (${record.cnum}) at index ${index}`
    };
  }
  if (
    !record[headers.FILE_COLUMN_SSA] &&
    !(record[headers.FILE_COLUMN_SERVICE] && record[headers.FILE_COLUMN_SA])
  ) {
    return {
      message: `"SSA" value missing for ${record.name} (${record.cnum}) at index ${index}`
    };
  }
  return null;
};

const saveToDatabase = async (fileData, existingData) => {
  const headers = { ...headersDict };
  Object.keys(headers).forEach(key => {
    headers[key] = "";
  });
  const fileKeys = {};

  return new Promise((resolve, reject) => {
    let dataObj = {};

    Object.keys(fileData[0]).forEach(key => {
      fileKeys[key] = key;
    });

    Object.values(fileKeys).forEach(fileKey => {
      Object.entries(headersDict).forEach(([key, arr]) => {
        if (arr.includes(fileKey.trim())) {
          headers[key] = fileKey;
        }
      });
    });

    const promiseArrays = fileData.map(async (x, i) => {
      const warningMessage = validateExcelRow(x, headers, i);
      if (warningMessage != null) {
        return warningMessage;
      }

      let availableDate = null;
      if (new Date(x[headers.FILE_COLUMN_AVAILABLE_DATE])) {
        availableDate = new Date(x[headers.FILE_COLUMN_AVAILABLE_DATE]);
      } else if (new Date(x[headers.FILE_COLUMN_AVAILABLE_DATE_2])) {
        availableDate = new Date(x[headers.FILE_COLUMN_AVAILABLE_DATE_2]);
      }
      const todayDate = new Date();
      const availableDateString = Number.isNaN(availableDate.getTime())
        ? null
        : availableDate.toString().substring(4, 15);
      let availableIn = Math.ceil((availableDate - todayDate) / 86400000);
      availableIn = availableIn < 0 ? 0 : availableIn;

      const serial = addLeadingZeros(x[headers.FILE_COLUMN_SERIAL], 6);
      const cnum = x[headers.FILE_COLUMN_CNUM];
      const name = x[headers.FILE_COLUMN_NAME];
      const nameStringArray = name.replace(/\s+/g, " ").split(" ");
      // Assumption: first part is the first name, and rest is the last name. TODO: Make sure assumption is valid for future input
      const firstName = nameStringArray[0];
      const lastName = nameStringArray
        .slice(1, nameStringArray.length)
        .join(" ");
      const convertedName = `${firstName} ${lastName.replace(",", "")}`;
      let jobRole = x[headers.FILE_COLUMN_JRSS];
      if (!jobRole) {
        jobRole = `${x[headers.FILE_COLUMN_JR]}-${
          x[headers.FILE_COLUMN_SPECIALTY]
        }`;
      }
      let SSA = x[headers.FILE_COLUMN_SSA];
      if (!SSA) {
        SSA = `${x[headers.FILE_COLUMN_SERVICE]} - ${
          x[headers.FILE_COLUMN_SA]
        }`;
      }

      let existingSkills = [];
      if (existingData && existingData[cnum] && existingData[cnum].skills) {
        // Populate the skills array with the existing skills data because they would not
        //  be in the uploaded spreadsheet file
        existingSkills = existingData[cnum].skills;
      }

      dataObj = {
        id: serial,
        cnum,
        name: convertedName,
        band: x[headers.FILE_COLUMN_BAND],
        currentProject: x[headers.FILE_COLUMN_CURRENT_ASSIGNMENT],
        rollOffDate: availableDateString,
        status: x[headers.FILE_COLUMN_STATUS],
        location: x[headers.FILE_COLUMN_CITY],
        country: x[headers.FILE_COLUMN_COUNTRY],
        jobRole,
        availableIn,
        BU: x[headers.FILE_COLUMN_YTD_BU],
        CU: x[headers.FILE_COLUMN_YTD_CU],
        PU: x[headers.FILE_COLUMN_YTD_PU],
        SSA,
        SRM: x[headers.FILE_COLUMN_SRM]
      };
      if (existingData) {
        // Only update the skills field if existingData has been passed in
        dataObj.skills = existingSkills;
      }
      if (
        !existingData[cnum] ||
        existingData[cnum].lastModified === "0" ||
        !existingData[cnum].lastModifiedBy
      ) {
        dataObj.lastModifiedBy = "IX NA Survey 2019";
        dataObj.lastModified = "1559361600000";
      }

      // MongoDB Integration
      let fields = "";
      Object.keys(dataObj).forEach(key => {
        // Only update the fields defined in the dataObj
        // (skills field may or may not required to be changed)
        fields += `${key} `;
      });
      const modelUpdateOptions = {
        new: true,
        upsert: true,
        sort: { id: "asc" },
        setDefaultsOnInsert: true,
        fields
      };
      if (!availableDateString) {
        delete dataObj.availableIn;
        delete dataObj.rollOffDate;
      }
      const employeesModel = mongoDBGetModel("Employee");
      return new Promise((res, rej) => {
        employeesModel.findOneAndUpdate(
          { cnum },
          dataObj,
          modelUpdateOptions,
          (err, doc) => {
            if (err || !doc) {
              logger.error(`failed to update employee with cnum ${cnum}`);
              logger.error(err);
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
        logger.info(
          "successfully retrieved updated mongoDB database record after update"
        );
        resolve(data);
      })
      .catch(err => {
        logger.error("update failed for some record");
        logger.error(err);
        reject(err);
      });
  });
};

const cleanRecords = results => {
  const data = results;
  const nullString = "no value available";
  results.forEach((record, index) => {
    Object.entries(record).forEach(([key, val]) => {
      if (val.toLowerCase().includes(nullString)) {
        data[index][key] = null;
      }
    });
  });
  logger.info(`cleaned data has ${data.length} entries`);
  return data;
};

const convertExcelToJSON = (excelFunc, sheet, req, res) => {
  excelFunc(
    {
      input: req.file.path,
      output: null, // since we don't need output.json
      lowerCaseHeaders: true,
      sheet
    },
    (exceltojsonErr, result) => {
      if (exceltojsonErr) {
        return res.status(400).json({
          error_code: 1,
          err_desc: exceltojsonErr.message,
          data: null
        });
      }
      if (Object.entries(result[0]).length === 0) {
        const sheetNames = headersDict.FILE_TARGET_SHEET;
        if (sheetNames.indexOf(sheet) === sheetNames.length - 1) {
          const noSheetErr =
            "Could not find a sheet named Resources, Sheet1, or Results in Excel file";
          logger.error(new Error(noSheetErr));
          return res
            .status(400)
            .json({ error_code: 1, err_desc: noSheetErr, data: null });
        }
        const nextSheet = sheetNames[sheetNames.indexOf(sheet) + 1];
        logger.info(`Could not find sheet ${sheet}, trying ${nextSheet}...`);
        return convertExcelToJSON(excelFunc, nextSheet, req, res);
      }
      const filteredResult = result.filter(
        record =>
          !!record[headersDict.FILE_COLUMN_CNUM[0]] &&
          record[headersDict.FILE_COLUMN_CNUM[0]].toLowerCase().indexOf("n/a") <
            0
      );
      if (!filteredResult || filteredResult.length === 0) {
        const errMsg = "Could not find any rows with CNUM";
        logger.error(new Error(errMsg));
        return res
          .status(400)
          .json({ error_code: 1, err_desc: errMsg, data: null });
      }
      const cleanedResults = cleanRecords(filteredResult);
      // 1) First get all existing records from the database
      return queryExistingData().then(existingData => {
        // 2) Then update with the merge of the new file data and the existing data
        saveToDatabase(cleanedResults, existingData)
          .then(data => {
            // Successfully updated the database
            // Convert the "data" array into an object in the json response
            const jsonData = {};
            let failedRows = 0;
            const warnings = [""];
            data.forEach(obj => {
              if (!obj.message) {
                jsonData[obj.cnum] = obj;
              } else {
                failedRows += 1;
                warnings.push(obj.message);
              }
            });
            if (failedRows > 0) {
              warnings[0] = `Warning: ${failedRows} row(s) had missing required fields and were skipped.`;
              jsonData.messages = warnings;
            }
            res.json(jsonData);
          })
          .catch(saveErr => {
            // 3b) In case of save failure, try to recovery with the previously existing data
            rollbackDatabase(existingData)
              .then(() => {
                if (saveErr) {
                  return res.json({
                    error_code: 1,
                    err_desc:
                      "Some updates failed, recovered with previous data.",
                    data: saveErr
                  });
                }
                return res.json({
                  error_code: 1,
                  err_desc: "Update failed, recovered with previous data."
                });
              })
              .catch(() => {
                if (saveErr) {
                  return res.json({
                    error_code: 1,
                    err_desc: "Some updates failed, and recovery also failed",
                    data: saveErr
                  });
                }
                return res.json({
                  error_code: 1,
                  err_desc: "Update failed, and recovery also failed"
                });
              });
          });
      });
    }
  );
};

/** API path that will upload the files */
router.post("/upload", (req, res) => {
  let exceltojson;
  upload(req, res, err => {
    if (err) {
      res
        .status(400)
        .json({ error_code: 1, err_desc: err.message || err.toString() });
      return;
    }
    /** Multer gives us file info in req.file object */
    if (!req.file) {
      res.status(400).json({ error_code: 1, err_desc: "No file passed" });
      return;
    }
    /** Check the extension of the incoming file and
     *  use the appropriate module
     */
    const extension = req.file.originalname.split(".")[
      req.file.originalname.split(".").length - 1
    ];
    if (extension === "xlsx" || extension === "xlsm") {
      exceltojson = xlsxtojson;
    } else {
      exceltojson = xlstojson;
    }
    try {
      convertExcelToJSON(
        exceltojson,
        headersDict.FILE_TARGET_SHEET[0],
        req,
        res
      );
    } catch (e) {
      res.status(400).json({ error_code: 1, err_desc: "Corrupted excel file" });
    }
  });
});

router.get("/testExcel", (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

module.exports = {
  router
};
