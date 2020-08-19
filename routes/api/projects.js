const express = require("express");
const router = express.Router();

// @route   GET api/projects/test
// @desc    Tests projects route
// @access  Public
router.get("/test", (req, res) =>
  res.json({
    msg: "Projects Works"
  })
);

module.exports = router;
