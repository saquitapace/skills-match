const url = require('url');

/**
 * get the uid param from the url (CNUM) and butcher off the last 3 digits
 * @param {string} url - has to be a valid bluepages profile page URL
 */
const getIdFromBluePagesUrl = (url) => {
  if(!url) return '';
  try {
    const urlObj = new URL(url);
    const cnum = urlObj.searchParams.get('uid');
    return cnum.slice(0, -3);
  } catch (err) {
    console.log('getIdFromURL', err);
    return null;
  }
}

const sleepForMS = (time) => {
  return new Promise((resolve)=>{
    setTimeout(resolve,time);
  });
}

module.exports = {
  getIdFromBluePagesUrl,
  sleepForMS
}