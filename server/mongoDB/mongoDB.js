const mongoose = require('mongoose');

// Cloud Foundry Enviroment
const cfenv = require('cfenv'); // Cloud Foundry Environment Variables
const appEnv = cfenv.getAppEnv(); // Grab environment variables

// Config Files
let configFileName = process.env.NODE_ENV ? `${process.env.NODE_ENV}.json` : 'dev.json';
console.log('ENV === ', process.env.NODE_ENV)
const config = require(`../config/mongoDB/${configFileName}`);
const dbURL = `mongodb://${config.username ? (config.username + ':' + config.password + '@') : ''}${config.uri}`;

const DEFAULT_POOL_SIZE = 5;

let database = null;

const getDatabase = () => database;

const getUrl = () => {
  let mongoDbUrl = dbURL;

  // //Detects environment and connects to appropriate DB
  // if(appEnv.isLocal){
  //   if (process.env.LOCAL_MONGODB_URL) {
  //     mongoDbUrl = `${process.env.LOCAL_MONGODB_URL}/${config.dbName}`;
  //   }
  // }
  // // Connect to MongoDB Service on Bluemix
  // else if(!appEnv.isLocal) {
  //   const mongoDbCredentials = appEnv.services["compose-for-mongodb"][0].credentials;
  //   console.log('MONGO Creds = ', mongoDbCredentials);
  //   if (mongoDbCredentials && mongoDbCredentials.uri) {
  //     mongoDbUrl = `${mongoDbCredentials.uri}/${config.dbName}`;
  //   }
  // }

  return mongoDbUrl;
};

const connect = () => {
  let mongoDbUrl = getUrl();
  let mongoDbOptions = {};

  if(!appEnv.isLocal) {
    mongoDbOptions = {
      mongos: {
        ssl: true,
        sslValidate: true,
        // sslCA: ca,
        poolSize: 1,
        reconnectTries: 1
      }
    };
  }

  if (!mongoDbUrl) {
    console.log('Unable to connect to MongoDB.');
  }

  const options = {
    poolSize: config.poolSize || DEFAULT_POOL_SIZE,
  };
  mongoose.connect(mongoDbUrl, options);
  console.log('Your MongoDB is running at ' + mongoDbUrl);

  mongoose.connection.on('connected', function(){
    console.log("Mongoose default connection is open to " + mongoDbUrl);
    database = mongoose.connection;
  });

  mongoose.connection.on('error', function(err){
    console.log("Mongoose default connection has occured "+err+" error");
  });

  mongoose.connection.on('disconnected', function(){
    console.log("Mongoose default connection is disconnected");
    database = null;
  });
};

const getModel = (name) => {
  const model = require(`./models/${name}`);
  return model;
};

const getModule = () => mongoose;

module.exports = {
  database: database,
  getDatabase: getDatabase,
  connect: connect,
  getModel: getModel,
  getUrl: getUrl,
  getModule: getModule,
}
