const express = require('express');
const router = express.Router();
const log4js = require('log4js');
const cors = require('cors');
const config = require('../../config/config.json');

/**
 * Configure logger
 */
log4js.configure(config.log4js);
const logger = log4js.getLogger('APP');

router.use(cors());

//@route  POST /api/logger/:id/:type
//@desc   Logger
//@access Public
router.post('/:id/:type', (req, res) => {
  const { params } = req;
  logger.info(params.id + ' ' + params.type);
  res.status(200);
  res.json("DATA");
  return;
});

module.exports = {
  router
};