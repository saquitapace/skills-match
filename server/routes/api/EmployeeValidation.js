const express = require("express");
const router = express.Router();
const cors = require("cors");
const { getModel } = require("../../mongoDB/mongoDB");

router.use(cors());

router.post("/", async (req, res) => {
  const { previousEmployees } = req.body;
  savePreviousEmployees(previousEmployees).catch(error => {
    console.log(error);
    res.status(200).end();
  });
  res.status(200).end();
});

module.exports = {
  router
};

const savePreviousEmployees = async previousEmployees =>
  new Promise(() => {
    const previousEmployeeModel = getModel("PreviousEmployee");
      let bulkUpdate = previousEmployeeModel.collection.initializeUnorderedBulkOp();
      previousEmployees.forEach(item => {
          if (item !== null) {
              bulkUpdate.find({ id: item.id }).upsert().updateOne(item);
          }
      });

      bulkUpdate.execute();
  });
