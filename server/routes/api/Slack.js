const express = require('express');
const cors = require('cors');
const axios = require('axios');
const {SlackBot} = require('../../slack/SlackBot');
const bot = new SlackBot();

const onMessage = async (data) => {
  const result = await bot.processMessage(data);
  return result;
}

const router = express.Router();
router.use(cors());

// slack dm messages are sent to this endpoint
router.get('/', function(req, res) {
  res.status(200).end();   
  const type = req.param('value');
  const channel = req.param('channel');
  if(type === 'skill') {
    bot.initUserList(channel).then(() => {
      bot.sendSkillNotices();
    });
  } else if (type === 'avail') {
    bot.initUserList(channel).then(() => {
      bot.sendAvailabilityNotices();
    });
  }
});

router.get('/channels', function(req, res) {
  const slackConfig = require(`../../slack/config-${process.env.NODE_ENV}`);
  res.json({
    channels: slackConfig.subscriptions
  });
});

// when setting up event subscription, this post endpoint
// must be enabled see https://api.slack.com/events/url_verification
router.post('/', (req, res) => {
  const body = req.body;
  if(body.challenge) {
    res.json({ challenge: body.challenge } );
    console.log(body);
    return;
  }
  console.log('body type: ', body.type);
  if(body.type === 'event_callback') {
    console.log('event callback received: ', body.event.type);
    onMessage(body.event);
    res.sendStatus(200);
    return;
  }
});


router.post('/interactive', (req, res) => {
  const body = req.body;
  const payload = body.payload? JSON.parse(body.payload): null;
  if (payload && payload.type === 'block_actions') {
    // reply immediately, then use response url to incrementally update message or reply
    res.status(200).end();

    const action = payload.actions[0];
    const selectedOption = action.type === 'static_select'? action.selected_option : action;
    
    const event = {
      type: 'block_action',       // if it's block action we do not need to 
                                  // send response back to the channel, use 
                                  // the response url instead
      bot_id: payload.bot_id,
      user: payload.user.id,      // note: we assume callback_id is user id, 
                                  // which is defined in code in Chatbot.js
      text: selectedOption.value
    };
    onMessage(event).then(
      (result) => {
        if(result) {
          const blockIndex = payload.message.blocks.
                                findIndex((blk) => blk.block_id === action.block_id);
          const blocks = payload.message.blocks.slice(0, selectedOption.value === 'back'? blockIndex-1: blockIndex).map(block => {
            // disable previous buttons because in the generator multi-level break
            // is not defined
            if(block.type !== 'section') {
              return block;
            }
            return {
              type: block.type,
              block_id: block.block_id,
              text: block.text
            };
          });
          // send the confirmation for the action to the response url
          // logic: get 'block_id' from action object,
          // remove everything after (including) that block and append result to it
          axios.post(payload.response_url, {
            blocks: blocks.concat(result)
          }).then((val) => {
            // ignore if succeed
          }, (err) => {
            console.log(err);
          });
        }
      }, (error) => {
        console.log('POST api/slack/: ', error);
      });
  } else {
    console.log('post request unidentified, body: ', body);
    res.sendStatus(200);
  }
});

module.exports = {
  router
};