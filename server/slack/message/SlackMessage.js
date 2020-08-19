
const TEXT_TYPE_MARKDOWN = 'mrkdwn';
const TEXT_TYPE_PLAIN_TEXT = 'plain_text';
const BLOCK_TYPE_SECTION = 'section';
const BLOCK_TYPE_ACTIONS = 'actions';
const ACTION_TYPE_SELECT = 'static_select';
const ACTION_TYPE_BUTTON = 'button';
const STAR_EMOJI = ':star:'
const EMPTY_STAR = ':starempty:'
const SKILL_LEVEL_DESC = {
  1: 'Acquiring Skill',
  2: 'Some Experience',
  3: 'Proficient',
  4: 'Highly Skilled',
  5: 'Expert'
};

const MESSAGES = {
  GREETINGS: 'This is SkillMatch :slightly_smiling_face:\n',
  NOT_AVAIL: 'Hello there, SkillMatch bot is not available right now, please come back later',
  EMPLOYEE_NOT_FOUND: 'I could not find your profile in our database',
  URL_TO_PROD: 'To manage your skills and more, please go to: http://skill-match.mybluemix.net',
  PARSE_ERROR: 'Sorry I do not understand this message:disapointed_relieved:',
  ERROR_UPDATE: 'Oops, it appears something wrong happened when updating your skill set:dissapointed_relieved:',
  UPDATE_AVAILABILITY: 'Please follow the link to update your information\nhttps://w3-01.ibm.com/services/tools/marketplace/displayMyHoursPlan.wss',
};

// text message: {text: "blah", attachments: [list of attachment objects]}

// block message: {blocks: [list of block objects]}

// block: {type, block_id, text, accessory}

// skillGroup: {skills: [{skill, rating}, ...], group}
// returns list of block objects
/**
 * generate a formatted slack message object based on the list 
 * of skill groups
 * @param {Array.<Object.SkillGroup>} skillGroups 
 * @return {Array.<Object.Block>}
 */
const skillOverviewMessage = (skillGroups) => {
  const blocks = skillGroups
            .filter((group) => (group.skills && group.skills.length > 0))
            .map((group, index) => {
    const retval = {
      type: BLOCK_TYPE_SECTION,
      block_id: 'skillgroup-'+index,
      text: {
        type: TEXT_TYPE_MARKDOWN,
        text: group.skills.reduce((acc, skill) => {
          return  acc + '\n- *' + skill.skill + '*\t '+ 
                  STAR_EMOJI.repeat(skill.rating) + 
                  (process.env.NODE_ENV === 'local'? 
                    '': EMPTY_STAR.repeat(5 - skill.rating)) +
                   '\t[' + SKILL_LEVEL_DESC[skill.rating] + ']';
        }, '*' + group.group + '*')
      }
    };
    return retval;
  });
  if(blocks.length > 0) {
    return blocks;
  } else {
    return [{
      type: BLOCK_TYPE_SECTION,
      text:{
        type: TEXT_TYPE_MARKDOWN,
        text: 'I cannot find any skills that you have in the database.'
      }
    }];
  }
}

/**
 * returns simple yes or no buttons
 * @param {string} message 
 * @return {Array.<Object.Block>}
 */
const yesOrNoMessage = (message = 'Is this correct?') => {
  return [
    {
      type: BLOCK_TYPE_SECTION,
      text: {
        type: TEXT_TYPE_MARKDOWN,
        text: message
      }
    },
    {
      type: BLOCK_TYPE_ACTIONS,
      elements: [
        {
          type: ACTION_TYPE_BUTTON,
          text: {
            type: TEXT_TYPE_PLAIN_TEXT,
            text: 'Yes'
          },
          value: 'yes'
        },{
          type: ACTION_TYPE_BUTTON,
          text: {
            type: TEXT_TYPE_PLAIN_TEXT,
            text: 'No'
          },
          value: 'no'
        }
      ]
    }
  ];
}

/**
 * returns a select menu contains three actions
 * @param {string} message 
 * @return {Array.<Object.Block>}
 */
const skillActionsMessage = (message = 'Would you like to:') => {
  return [
    {
      type: BLOCK_TYPE_SECTION,
      text: {
        type: TEXT_TYPE_MARKDOWN,
        text: message
      }
    },
    {
      type: BLOCK_TYPE_ACTIONS,
      elements: [
        {
          type: ACTION_TYPE_BUTTON,
          text: {
            type: TEXT_TYPE_PLAIN_TEXT,
            text: 'Add a Skill'
          },
          value: 'add'
        },{
          type: ACTION_TYPE_BUTTON,
          text: {
            type: TEXT_TYPE_PLAIN_TEXT,
            text: 'Update a Skill'
          },
          value: 'update'
        },{
          type: ACTION_TYPE_BUTTON,
          text: {
            type: TEXT_TYPE_PLAIN_TEXT,
            text: 'Thanks, I\'m good'
          },
          value: 'no'
        }
      ]
    }
  ];
}


/**
 * returns formatted drop down select for skills
 * @param {Array.<Object.Skill>} skills 
 * @param {false|string} goBack
 * @return {Array.<Object.Block>}
 */
const selectSkillAndConfirm = (skills, message = 'Please select the skill you are looking for', goBack = false) => {

  const list = skills.slice(0, 99);
  const messageBlock = goBack? [{
    type: BLOCK_TYPE_SECTION,
    text: {
      type: TEXT_TYPE_MARKDOWN,
      text: message 
    },
    accessory: {
      type: ACTION_TYPE_BUTTON,
      action_id: 'skills-goback',
      type: ACTION_TYPE_BUTTON,
      text: {
        type: TEXT_TYPE_PLAIN_TEXT,
        text: goBack
      },
      value: 'back'
    }
  }] : simpleTextMessage(message);
  const selectAction =  [{
    type: BLOCK_TYPE_ACTIONS, 
    elements: [
      {
        type: ACTION_TYPE_SELECT,
        action_id: 'skills',
        placeholder: {
          type: TEXT_TYPE_PLAIN_TEXT,
          text: 'Select a skill'
        },
        options: list.map((skill) => {
          return {
            text: {
              type: TEXT_TYPE_PLAIN_TEXT,
              text: skill.skill
            },
            value: skill.skill
          };
        })
      }
    ]
  }];
  
  return messageBlock.concat(selectAction);
}

/**
 * returns a dropdown list message that contains a skill group select
 * @param {string} message 
 * @param {false|string} goBack - if defined, will display string as go back option 
 * @return {Array.<Object.Block>}
 */
const selectSkillGroupAndConfirm = (skillGroups, message = 'Please select the type of skill you are looking for: ', goBack = false) => {
  const groups = skillGroups.slice(0, 99);
  const messageBlock = goBack? [{
    type: BLOCK_TYPE_SECTION,
    text: {
      type: TEXT_TYPE_MARKDOWN,
      text: message 
    },
    accessory: {
      type: ACTION_TYPE_BUTTON,
      action_id: 'skillgroups-goback',
      type: ACTION_TYPE_BUTTON,
      text: {
        type: TEXT_TYPE_PLAIN_TEXT,
        text: goBack
      },
      value: 'back'
    }
  }] : simpleTextMessage(message);
  const selectAction = [{
    type: BLOCK_TYPE_ACTIONS, 
    elements: [
      {
        type: ACTION_TYPE_SELECT,
        action_id: 'skillgroups',
        placeholder: {
          type: TEXT_TYPE_PLAIN_TEXT,
          text: 'Select a type'
        },
        options: groups.map((group) => {
          return {
            text: {
              type: TEXT_TYPE_PLAIN_TEXT,
              text: group.group
            },
            value: group.group
          };
        })
      }
    ]
  }];
  return messageBlock.concat(selectAction);
}

/**
 * returns formatted message that contains a skill level select.
 * @param {string} message 
 * @param {false|string} goBack
 * @return {Array.<Object.Block>}
 */
const selectLevelAndConfirm = (message = 'Please select the type of skill you are looking for: ', goBack = false) => {
  const levels = [1,2,3,4,5];
  const messageBlock = goBack? [{
    type: BLOCK_TYPE_SECTION,
    text: {
      type: TEXT_TYPE_MARKDOWN,
      text: message 
    },
    accessory: {
      type: ACTION_TYPE_BUTTON,
      action_id: 'level-goback',
      type: ACTION_TYPE_BUTTON,
      text: {
        type: TEXT_TYPE_PLAIN_TEXT,
        text: goBack
      },
      value: 'back'
    }
  }] : simpleTextMessage(message);
  const selectButtons = [{
    type: BLOCK_TYPE_ACTIONS,
    elements: levels.map((num) => {
      return {
        type: ACTION_TYPE_BUTTON,
        action_id: 'skilllevel' + num,
        text: {
          type: TEXT_TYPE_PLAIN_TEXT,
          text: `${STAR_EMOJI.repeat(num)}${process.env.NODE_ENV === 'local'? 
                '': EMPTY_STAR.repeat(5 - num)} [${SKILL_LEVEL_DESC[num]}]`
        },
        value: num.toString()
      };
    })
  }];
  return messageBlock.concat(selectButtons);
}
/**
 * returns a simple formatted slack text message
 * @param {string} message 
 * @return {Array.<Object.Block>}
 */
const simpleTextMessage = (message = '') => {
  return [{
    type: BLOCK_TYPE_SECTION,
    text: {
      type: TEXT_TYPE_MARKDOWN,
      text: message 
    }
  }];
}

module.exports = {
  MESSAGES,
  skillOverviewMessage,
  yesOrNoMessage,
  skillActionsMessage,
  simpleTextMessage,
  selectSkillGroupAndConfirm,
  selectSkillAndConfirm,
  selectLevelAndConfirm
}