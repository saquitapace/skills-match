const {
  MESSAGES,
  skillOverviewMessage, 
  yesOrNoMessage, 
  skillActionsMessage, 
  selectSkillGroupAndConfirm, 
  selectSkillAndConfirm, 
  selectLevelAndConfirm,
  simpleTextMessage } = require('./message/SlackMessage');

const { getModel: mongoDBGetModel } = require('../mongoDB/mongoDB');


/** 
 * Class representing a chatbot attached to a user
 */
class ChatBot {
  /**
   * Creates a chatbot
   * @param {Object} user - slack id and real name
   */
  constructor(user) {
    /** @type {string} - slack user id */
    this.id = user.id;
    /** 
     * @type {string} - user full name
    */
    this.name = user.real_name;
    /** @type {string} user's employee ID we use to find him/her in our DB */
    this.empId = user.empId;
    /** @type {string} - to store the user input passed in */
    this.message = '';
    this.rollOffDate = '';
    this.currentProject = '';

    /** @constant {string} */
    this.greeting = 'Hello ' + (user.first_name? user.first_name: user.real_name) + '! ' +
                    MESSAGES.GREETINGS;
    this.notAvailable = MESSAGES.NOT_AVAIL;

    /** @type {async generator | null} */
    this._main = null;

    /** @type {boolean} */
    this.done = false;

    /** @type {Array.<skillGroup> */
    this.skills = [];
      
    /** @type {Promise.<boolean>} */
    this.existInDB = this.fetchEmployeeInfo();
  }

  /** 
   * Bootstraps the chatbot and returns an initial message
   * cannot fit in constructor b/c it's async
   * @return {Array.Object} 
   * @param {('skill'|'avail')} mode - type of notification
   */
  async bootstrap(mode = 'skill'){
    this.mode = mode;
    await this.fetchEmployeeInfo();
    if(mode === 'skill') {
      this._main = this._main_skill();
    } else {
      this._main = this._main_avail();
    }
    const msg = await this._main.next();
    return msg.value;
  }

  /** 
   * retrieves all skills from our database's skill table
   * @return {Array.<Object>}
   * @throws db error
   */
  async getSkillSet(){
    const skills = mongoDBGetModel('Skill');
    return await skills.find().select('skill hot').lean();
  }

  async getSkillGroups() {
    const skillGroupsModel = mongoDBGetModel('SkillGroup');
    try {
      mongoDBGetModel('Skill');
      return await skillGroupsModel
          .find({})
          .select('group groupId skills')
          .populate('skills')
          .exec();
    } catch (error) {
      console.log('Mongodb error fetching all skills ', this.name);
      console.log(error);
      throw error;
    }
  }

  /** 
   * retrieves employee info from our database's employees table
   * and fills classes fields with the info
   * if cannot find employee directly in our database, use bluepages api
   * modifies: {skills, rollOffDate, currProject}
   * @returns {Promise.<boolean>}
   */
  async fetchEmployeeInfo() {
    const employees = mongoDBGetModel('Employee');
    const skillGroupsModel = mongoDBGetModel('SkillGroup');

    let employee;
    let skillGroups;
    try{
      mongoDBGetModel('Skill');
      employee = await employees
        .findOne({
          $or: [
            {
              id: this.empId
            },
            {
              name: this.name
            }
          ]
        }).select('rollOffDate currentProject skills')
        .populate('skills.skillId')
        .exec();
      skillGroups = await skillGroupsModel
        .find({})
        .select('group groupId skills')
        .populate('skills')
        .exec();
    } catch (error) {
      console.log('Mongodb error looking for employee ', this.name);
      console.log(error);
    }
    if(!employee) {
      console.log('employee ' + this.name + ' not found');
    } else {
      this.skills = skillGroups.map((group) => {
        return {
          group: group.group,
          skills: employee.skills.reduce((acc, skill, i) => {
            if(group.skills.map((s) => s.skill).includes(skill.skillId.skill)){
              return acc.concat({
                skill: skill.skillId.skill,
                hot: skill.skillId.hot,
                rating: skill.rating
              });
            } else {
              return acc;
            }
          }, [])
        };
      });
      this.rollOffDate = employee.rollOffDate;
      this.currentProject = employee.currentProject;
    }
  }

  /** 
   * updates employee info to our database's employees table
   * and adds a skill
   * @param {string} skillId - ObjectId in MongoDB
   * @param {number[1-5]} rating - skill rating for the skill
   * @throws db error
   */
  async addSkill(skillId, rating) {
    const employees = mongoDBGetModel('Employee');
    try{
      const result = await employees.updateOne({
        name: this.name
      }, {
        $push: {
          skills: {
            rating: rating,
            skillId: skillId
          }
        }
      });
      return result;
    } catch(err) {
      console.log('add Skill: ', err);
      throw err;
    }
    return 0;
  }

  /** 
   * updates employee info to our database's employees table
   * and update the skill with skillId with a new skill rating
   * @param {string} skillId - ObjectId in MongoDB
   * @param {number[1-5]} rating - new skill rating for the skill
   * @throws db error
   */
  async updateSkill(skillId, rating){
    const employees = mongoDBGetModel('Employee');
    try {
      const result = await employees.updateOne({
        name: this.name,
        'skills.skillId' : skillId
      }, {
        $set: {
          'skills.$.rating': rating
        }
      });
      return result;
    } catch (err) {
      console.log('add Skill: ', err);
      throw err;
    }
    return 0;
  }

  /**
   * generates sequence of replies according to this.message
   * must used with this.getResponse
   * @private
   * @generator
   * @yeilds {Array.<Object.Block>}
   */
  async* _main_skill() {
    // get initial message
    try{
      if(this.skills === [] && 
        this.rollOffDate === '' && 
        this.currentProject === '') {

        const reply = this.greeting + MESSAGES.EMPLOYEE_NOT_FOUND;
        yield simpleTextMessage(reply);
        return;
      }
      const initMessage = simpleTextMessage(this.greeting + 
                'Let\'s review your skills today. Your current skills: ');
      const skillsMessage = initMessage.concat(skillOverviewMessage(this.skills))
                                       .concat(skillActionsMessage());
      yield skillsMessage;
      while(1){
        console.log('ChatBot: waiting for messages');
        yield null; // means we're waiting for messages
        console.log('ChatBot: got incoming message ' + this.message);
        if(this.message.toUpperCase().includes('ADD')) {
          yield* this._sub_gen_add_skill_with_select();
          console.log('add skill complete');
        } else if(this.message.toUpperCase().includes('UPDATE')) {
          yield* this._sub_gen_update_skill_with_select();
          console.log('update skill complete');
        } else if(this.message.toUpperCase().includes('NO')){
          yield simpleTextMessage('Have a good day!')
                    .concat(simpleTextMessage(MESSAGES.URL_TO_PROD));
        } else {
          await this.fetchEmployeeInfo();
          const initMessage = simpleTextMessage(this.greeting + 
                    'Let\'s review your skills today. Your current skills: ');
          yield initMessage.concat(skillOverviewMessage(this.skills))
                            .concat(skillActionsMessage());
        }
      }
    } catch (error) {
      console.log('chatbot: error connecting to mongoDB', error);
      return '';
    }
  }

  /**
   * generates sequence of replies according to this.message
   * must used with this.getResponse
   * @private
   * @generator
   * @yeilds {Array.<Object.Block>}
   */
  async* _main_avail() {
    try{
      if(this.skills === [] && 
        this.rollOffDate === '' && 
        this.currentProject === '') {

        const reply = this.greeting + MESSAGES.NOT_AVAIL;
        yield simpleTextMessage(reply);
        return;
      }
      const availMessage = simpleTextMessage(this.greeting)
                            .concat(simpleTextMessage('Currently your availability date is: *' + this.rollOffDate + '*'))
                            .concat(simpleTextMessage('Your current project is *' + this.currentProject + '*'))
                            .concat(yesOrNoMessage());
      yield availMessage;
      while(1){
        console.log('ChatBot: waiting for messages');
        yield null; // means we're waiting for messages
        console.log('ChatBot: got incoming message ' + this.message);
        if(this.message.includes('hello')){
          yield simpleTextMessage('greetings:)');
        } else if(this.message.toUpperCase().includes('YES')) {
          yield simpleTextMessage('Thanks for confirming!');
        } else if(this.message.toUpperCase().includes('NO')){
          yield simpleTextMessage(MESSAGES.UPDATE_AVAILABILITY);
        } else {
          yield simpleTextMessage('???');
        }
      }
    } catch (error) {
      console.log('chatbot: error connecting to mongoDB', error);
      return null;
    }
  }

  /**
   * generates sequence of replies according to this.message
   * must used inside _main_skills
   * @private
   * @generator
   * @yeilds {Array.<Object.Block>}
   */
  async* _sub_gen_add_skill_with_select() {
    // first lets grab all the skill groups
    let allSkills = await this.getSkillGroups();
    const flattenedMySkills = this.skills.reduce((acc, group, index) =>{
      return acc.concat(group.skills.map(skill => skill.skill));
    }, []);
    allSkills = allSkills.map(group => {
      const skillsNotHave = group.skills.filter((skill) => !flattenedMySkills.includes(skill.skill))
      return {
        group: group.group,
        skills: skillsNotHave
      };
    }).filter(group => group.skills.length > 0);
    let skillGroup = null;
    let skill = null;
    let level = null;
    // rare case when user cannot add any more skills
    if(allSkills.length === 0) {
      yield simpleTextMessage('Cannot add more skills')
                .concat(yesOrNoMessage('Do you want to modify any skill?'));
      yield null;
      if(this.message === 'yes') {
        yield* this._sub_gen_update_skill_with_select();
      } else {
        yield simpleTextMessage(MESSAGES.URL_TO_PROD)
                  .concat(skillActionsMessage('What else can I help you for?'));
      }
      return;
    }
    while(!skillGroup){
      // ask what skills are they adding, we have two slots to fill.
      // skill(string) and level(string/int1-5).
      yield selectSkillGroupAndConfirm(
                allSkills, MESSAGES.PROMPT_SKILL_GROUP);
      // wait for user input
      yield null;
      // try to parse skill group
      const group = allSkills.filter((group) => 
                group.group.toUpperCase() === this.message.toUpperCase());
      if(group[0]) {
        skillGroup = group[0];
      } else {
        console.log('Cannot find this skill group.');
        continue;
      }
      while(!skill) {
        yield selectSkillAndConfirm(group[0].skills, 
                  'Please select the skill you want to add in *' + 
                  group[0].group + '*', 
                  'Choose from another skill group');
        yield null;
        if(this.message === 'back') {
          skillGroup = null;
          break;
        } else {
          const skillFromMessage = skillGroup.skills.filter((skill) => 
                    skill.skill.toUpperCase() === this.message.toUpperCase());
          if(skillFromMessage[0]) {
            skill = skillFromMessage[0];
          } else {
            console.log('Cannot parse this skill.');
            continue;
          }
        }
        while(!level) {
          yield selectLevelAndConfirm('Please select a level you want to add with *' + 
                    skill.skill + '*', 
                    'Choose another skill');
          yield null;
          if(this.message === 'back') {
            skill = null;
            break;
          } else if (this.message >= 1 && this.message <= 5) {
            level = this.message;
            const allSkills = await this.getSkillSet();
            const skillToAdd = allSkills.filter((s) => s.skill === skill.skill);
            if(skillToAdd[0]) {
              try{
                const result = await this.addSkill(skillToAdd[0]._id, level);
                let resultMessage;
                if(result.n && result.nModified) {
                  resultMessage = simpleTextMessage(`We have successfully added *${skill.skill}* to your skill set with level *${level}*!:white_check_mark:`);
                } else if (result.n) {
                  resultMessage = simpleTextMessage(`Unsuccessfully added *${skill.skill}* to your skill set with level *${level}*`);
                } else {
                  resultMessage = simpleTextMessage(`Sorry we are not able to match your profile in our database, please try again later.`);
                }
                yield resultMessage.concat(simpleTextMessage(MESSAGES.URL_TO_PROD))
                          .concat(skillActionsMessage('What else can I help you for?'));
                this.fetchEmployeeInfo();
              } catch (err) {
                console.log('error updating skill');
                yield simpleTextMessage(MESSAGES.ERROR_UPDATE)
                          .concat(skillActionsMessage('What else can I help you for?'));
              }
              return;
            } else {
              console.log('Cannot find the skill in the database');
            }
          } else {
            console.log('cannot parse skill level');
          }
        }
      }
    }
  }

  /**
   * generates sequence of replies according to this.message
   * must used with this.getResponse
   * @private
   * @generator
   * @yeilds {Array.<Object.Block>}
   */
  async* _sub_gen_update_skill_with_select() {
    let skillGroup = null;
    let skill = null;
    let level = null;
    const mySkillGroups = this.skills.filter((group) => {
      return group.skills && group.skills.length > 0;
    });
    if(mySkillGroups.length === 0) {
      yield simpleTextMessage('You do not have any skills')
                .concat(yesOrNoMessage('Do you want to add any skill?'));
      yield null;
      if(this.message === 'yes') {
        yield* this._sub_gen_add_skill_with_select();
      } else {
        yield simpleTextMessage(MESSAGES.URL_TO_PROD)
                  .concat(skillActionsMessage('What else can I help you for?'));
      }
      return;
    }
    while(!skillGroup){
      // ask what skills are they adding, we have two slots to fill.
      // skill(string) and level(string/int1-5).
      yield selectSkillGroupAndConfirm(
                this.skills.filter((group) => group.skills && group.skills.length > 0), 
                'Please select the type of skill you want to update');
      // wait for user input
      yield null;
      // try to parse skill group
      const group = this.skills.filter((group) => 
                group.group.toUpperCase() === this.message.toUpperCase());
      if(group[0]) {
        skillGroup = group[0];
      } else {
        yield simpleTextMessage('Cannot find this skill group.');
        continue;
      }
      while(!skill) {
        yield selectSkillAndConfirm(skillGroup.skills, 
                  'Please select the skill you want to update in *' + 
                  skillGroup.group + '*', 
                  'Choose from other skill groups');
        yield null;
        if(this.message === 'back') {
          skillGroup = null;
          break;
        } else {
          const skillFromMessage = skillGroup.skills.filter((skill) => 
                    skill.skill.toUpperCase() === this.message.toUpperCase());
          if(skillFromMessage[0]) {
            skill = skillFromMessage[0];
          } else {
            console.log('cannot parse skill');
            continue;
            // otherwise the response is undefined, we just prompt user to re-input
          }
        }
        while(!level) {
          yield selectLevelAndConfirm('Please select a level you want to modify for *' + 
                                      skill.skill + '*', 
                    'Choose another skill');
          yield null;
          if(this.message === 'back') {
            skill = null;
            break;
          } else if (this.message >= 1 && this.message <= 5) {
            level = this.message;
            const allSkills = await this.getSkillSet();
            const skillId = allSkills.filter((s) => s.skill === skill.skill);
            try{
              const result = await this.updateSkill(skillId, level);
              let resultMessage;
              if(result.n && result.nModified) {
                resultMessage = simpleTextMessage(`We have successfully changed your *${skill.skill}* skill from level *${skill.rating}* to level *${level}*!:white_check_mark:`);
              } else if (result.n) {
                resultMessage = simpleTextMessage(`Unsuccessfully changed *${skill.skill}* in your skill set.`);
              } else {
                resultMessage = simpleTextMessage(`Sorry we are not able to match your profile in our database, please try again later.`);
              }
              yield resultMessage.concat(simpleTextMessage(MESSAGES.URL_TO_PROD))
                        .concat(skillActionsMessage('What else can I help you for?'));
              this.fetchEmployeeInfo();
            } catch (err) {
              console.log('error updating skill');
              yield simpleTextMessage(MESSAGES.ERROR_UPDATE)
                        .concat(skillActionsMessage('What else can I help you for?'));
            }
            return;
          } else {
            console.log('cannot parse skill level');
          }
        }
      }
    }
  }

  /**
   * returns the reply according to input message
   * @param {string} message
   * @return {Array.<Object.Block>} 
   */
  async getResponse(message) {
    if(typeof message !== 'string'){
      this.message = '';
      console.log('invalid message input!');
      return;
    }
    if(this.done){
      console.log('bot process already finished');
      const response = await this.bootstrap(this.mode);
      return response.value;
    }
    this.message = message;
    // first next is to tell bot to proceed after we passed in the input message. 
    const botmsg = await this._main.next();
    if(botmsg.done){
      this.done = true;
      console.log('bot process already finished');
      const response = await this.bootstrap(this.mode);
      return response.value;
    }
    if(botmsg.value !== null) {
      console.log(botmsg);
      console.error('I don\'t know wat to do, i think i\'m gonna die......');
      const response = await this.bootstrap(this.mode);
      return response.value;
    }
    // second next is to retrieve bots response
    const response = await this._main.next();
    return response.value ;
  }

};

module.exports = {
  ChatBot
};
