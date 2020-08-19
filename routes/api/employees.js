const express = require("express");
const router = express.Router();

// @route   GET api/employees/test
// @desc    Tests employees route
// @access  Public
router.get("/test", (req, res) =>
  res.json({
    msg: "Employees Works"
  })
);

module.exports = router;
