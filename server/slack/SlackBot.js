const axios = require('axios');

const { getModel: mongoDBGetModel } = require('../mongoDB/mongoDB');
const { getIdFromBluePagesUrl, sleepForMS } = require('./utils');
const {ChatBot} = require('./Chatbot');

/**
 * a slack bot implementation that sends out message to DM/public channels
 * duties:  manage list of employee users,
 *          parse incoming message event
 *          send reply messages back to users
 */
class SlackBot {
  /**
   * creates a slackbot instance
   */
  constructor(){
    this.authToken = process.env.SLACK_BOT_TOKEN;
    this.botAuthToken = process.env.SLACK_TOKEN;
    this.axiosPost = axios.create({
      baseURL: 'https://slack.com/api/',
      headers: {
        'Authorization': 'Bearer ' + this.authToken,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    this.axiosGet = axios.create({
      baseURL: 'https://slack.com/api/',
      headers: {
        'Content-Type': 'application/x-www-from-urlencoded'
      }
    });
    this.userList = [];
  }

  /**
   * Initializes the user list based on the channel's member list
   * @param {string} channelName 
   */
  async initUserList(channelName){
    console.log('initializing user list based on channel ', channelName);
    // first from the slack api grab all channels and all users info
    const channels = await this.getAllChannels();
    // get list of employee names from DB
    const employeesModel =  mongoDBGetModel('Employee');
    let employeeNames = await employeesModel.find().select('name').exec();
    employeeNames = employeeNames.map((obj) => obj.name);
    
    const channel = channels.filter((channel) => {
      return channel.name === channelName;
    });
    if(!channel[0]) {
      console.error('no channel specified');
      return;
    }

    const members = await this.getMembers(channel[0].id);
    // for each member in the channel, find the user info that matches that.
    const userList = members.map(async (userId) => {
      // because getting the full info from slack is heavily rate-limited,
      // we always try to match user by real name first, if that doesn't 
      // work, retrieve the full info and grab his/her Employee ID
      const profile = await this.getUserInfoSlack(userId);
      let user = {
        id: userId,
        ...profile
      };
      if(!user){
        console.log('user ' + userId + ' not found in channel');
        return null;
      }
      // first reference user in database by user real name
      if(!employeeNames.includes(user.real_name)){
        // if failed, use this.getUserInfoFullSlack() to get user's employee number.
        console.log('user real name ' + user.real_name + ' does not match in database, using employee id instead');
        const fullProfile = await this.getUserFullInfoSlack(userId);
        if(fullProfile.fields){
          let fields = {};
          Object.keys(fullProfile.fields).forEach((key) => {
            fields[fullProfile.fields[key].label] = fullProfile.fields[key].value;
          });
          // then uses his/hers bluepage profile to get the employee ID
          if(fields['Employee ID']) {
            user.empId = fields['Employee ID'].slice(0, -3);
          } else if (fields['Bluepages Profile']){
            user.empId = getIdFromBluePagesUrl(fields['Bluepages Profile']);
          }
        }
      }
      return user;
    });
    this.userList = await Promise.all(userList);
    if(userList.length === 0) {
      console.log('no user found in the channel');
    }
    this.userList = this.userList.filter((item) => item != null);
  }

  /**
   * for each user in the user list, send skill notices
   */
  async sendSkillNotices(){
    this.userList.map(async (usr) => {
      usr.chatBot = new ChatBot(usr);
      const initMessage = await usr.chatBot.bootstrap('skill');
      if(initMessage) {
        this.sendBlockMessageToChannel(usr.id, initMessage);
      }
    });
  }

  /**
   * for each user in the user list, send availability notices
   */
  async sendAvailabilityNotices(){
    this.userList.map(async (usr) => {
      usr.chatBot = new ChatBot(usr);
      const initMessage = await usr.chatBot.bootstrap('avail');
      if(initMessage) {
        this.sendBlockMessageToChannel(usr.id, initMessage);
      }
    });
  }


  /**
   * @async
   * sends a POST request to slack's api endpoint and returns the 
   * response data
   * @param {string} method - see https://api.slack.com/methods
   * @param {Object} params - see URL above
   * @return {Object} response data
   * @throw
   */
  async webAPIPost(method, params = {}){
    let response = await this.axiosPost.post(method, params);
    console.log('webapipost: ' + response.status);
    let retryAfter = 2000;
    while (response.data && response.data.error === 'rate_limited'){ // case where rate-limited
      // seems no retry-after is included in the header, we just wait for 5 seconds before 
      // trying another request
      console.log('rate limit reached, sleep for ' + retryAfter + ' ms before retry');
      await sleepForMS(retryAfter);
      response = await this.axiosPost.post(method, params);
      retryAfter = retryAfter + 2000;
    }
    return response.data;
  }

  /**
   * @async
   * sends a GET request to slack's api endpoint and returns the 
   * response data
   * @param {string} method - see https://api.slack.com/methods
   * @param {Object} params - see URL above
   * @return {Object} response data
   * @throw
   */
  async webAPIGet(method, params = {}){
    const merged = {
      token: this.authToken, 
      ...params
    };
    let response = await this.axiosGet.get(method, {params: merged});
    console.log('webapiget: ' + response.status);
    let retryAfter = 2000;
    while (response.data && response.data.error === 'ratelimited'){ 
      // seems no retry-after is included in the header, we just wait before 
      // trying another request
      console.log('rate limit reached, sleep for ' + retryAfter + ' ms before retry');
      await sleepForMS(retryAfter);
      response = await this.axiosGet.get(method, {params: merged});
      retryAfter = retryAfter + 2000;
    }
    return response.data;
  }

  /**
   * @async
   * recursively get all channels from slack api
   * @return {Array.<Object>} list of all channels
   */
  async getAllChannels(){
    let channels = [];
    try{
      let nextCursor = null;
      while(1) {
        const response = await this.webAPIGet('conversations.list', 
        nextCursor? {
          exclude_archived: true,
          limit: 1000,
          cursor: nextCursor
        }:{
          exclude_archived: true,
          limit: 1000
        });
        if(response.channels && response.channels.length) {
          channels = channels.concat(response.channels);
        } else {
          break;
        }
        if( !response.response_metadata || 
            !response.response_metadata.next_cursor) {
          break;
        }
        nextCursor = response.response_metadata.next_cursor;
        console.log('nextCursor: ' + nextCursor);
      }
      return channels;
    } catch (err) {
      console.log('getAllChannels:', err);
      return channels;
    }
  }

  /**
   * @async
   * get the list of members in the channel given it's channel id
   * @param {string} channelId 
   * @return {Array.<Object>} array of member information
   */
  async getMembers(channelId) {
    try {
      const members = await this.webAPIGet('conversations.members', {
        channel: channelId
      });
      return members.members;
    } catch (error) {
      console.log('getMembers:', error);
      return [];
    }
  }

  /**
   * @param {string} userId 
   */
  async getUserFullInfoSlack(userId) {
    try {
      const response = await this.webAPIGet('users.profile.get', {
        user: userId,
        include_labels: true,
        token: this.botAuthToken
      })
      if(!response.ok) {
        console.log('getUserFullInfoSlack: ', response.error);
      }
      return response.ok? response.profile: null;
    } catch (err) {
      console.log('getUserFullInfoSlack: ', err);
    }
  }

  /**
   * 
   * @param {string} userId 
   */
  async getUserInfoSlack(userId) {
    try {
      const response = await this.webAPIGet('users.info', {
        user: userId
      })
      if(!response.ok) {
        console.log('getUserInfoSlack: ', response.error);
      }
      return response.ok? response.user: null;
    } catch (err) {
      console.log('getUserInfoSlack: ', err);
    }
  }

  /**
   * @async
   * sends a formatted (in blocks) message to a channel based on its channel id.
   * @param {string} channel - channel id
   * @param {Array.<Object>} blocks - array of blocks
   */
  async sendBlockMessageToChannel(channel, blocks){
    this.webAPIPost('chat.postMessage', {
      'channel': channel,
      'blocks': blocks,
      'as_user': true
    }).then((val) => console.log('success sending message to channel'),
            (reason) => console.log('failed sending message to channel', 
                                    channel, reason));
  }

  /**
   * process the event, extract its user info and returns the reply
   * generated by user's chatbot
   * @param {Object} event 
   * @return {Array.<Object>}
   */
  async processMessage(event){
    // first extract information from event object.
    // if it's sent by itself that has a bot id, ignore it
    if(event.bot_id || event.subtype) return 0;
    const userId = event.user;
    const message = event.text;
    // then find the user who sent this message
    let user = this.userList.filter((user) => {
      return user.id === userId;
    });
    let reply = null;
    if(!user || !user[0]){ 
      console.log('user not found! Creating user object for ', userId); 
      // create the user and add him/her to our user list
      const profile = await this.getUserFullInfoSlack(userId);
      user = {
        id: userId,
        ...profile
      };
      user.chatBot = new ChatBot(user);
      this.userList.push(user);
      reply = await user.chatBot.bootstrap('skill');
    } else {
      user = user[0]; // b/c filter returns a list
      // then obtain the reply message
      reply = await user.chatBot.getResponse(message);
    }
    if(event.type !== 'block_action') {
      this.sendBlockMessageToChannel(userId, reply);
    }
    return reply;
  }
}


module.exports = {
  SlackBot
};