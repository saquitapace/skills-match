/********************************
Dependencies
********************************/

const express = require('express'),
      log4js = require('log4js'),
      mongoose = require('mongoose'),// MongoDB connection library
      path = require('path'),
      bodyParser = require('body-parser'),
      compression = require('compression'),
      io = require('socket.io')(server),
      session = require('express-session'),
      passport = require('passport'),// Authentication framework
      cookieParser = require('cookie-parser'),
      expressValidator = require('express-validator'), // validation tool for processing user input
      MongoStore = require('connect-mongo')(session), // store sessions in MongoDB for persistence
      cfenv = require('cfenv'),// Cloud Foundry Environment Variables
      { router: fileUpload } = require('./routes/api/FileUpload'),
      { router: employeeValidation } = require('./routes/api/EmployeeValidation'),
      { router: profile } = require('./routes/api/Profile'),
      { router: employee } = require('./routes/api/Employee'),
      { router: admin } = require('./routes/api/Admin'),
      { router: excel } = require('./routes/api/Excel'),
      { router: slack } = require('./routes/api/Slack'),
      { router: logger } = require('./routes/api/Logger');

      cors = require('cors'),
      appEnv = cfenv.getAppEnv(), // Grab environment variables
      config = require('./config/config.json'),
      dbSource = config.dbSource || 'mongoDB', // Default to MongoDB if not specify (this value should match the folder name in the codebase)
      { connect: connectDatabase, getUrl: getDatabaseUrl } = require(`./${dbSource}/${dbSource}`);

const appName = require('./../package').name;

if (config.cluster) {
  // Run NodeJs in in cluster
  const cluster = require('cluster');
  if (cluster.isMaster) {
    // Code to run if we're in the master process

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }
    // Return and stops here for the master cluster, and let Node run the rest of the code in the forked cluster
    return;
  }
}

var sessionDB = getDatabaseUrl();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.cwd() + '/public';

/********************************
Local Environment Variables
 ********************************/
if(appEnv.isLocal){
  require('dotenv').load();// Loads .env file into environment
}

/********************************
 MongoDB Connection
 ********************************/
connectDatabase();

/********************************
Express Settings
********************************/
const app = express();
app.enable('trust proxy');

// Use SSL connection provided by Bluemix. No setup required besides redirecting all HTTP requests to HTTPS
if (!appEnv.isLocal) {
  app.use(function (req, res, next) {
      if (req.secure) // returns true is protocol = https
          next();
      else
          res.redirect('https://' + req.headers.host + req.url);
  });
}
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(expressValidator()); // must go directly after bodyParser
app.use(cookieParser());
app.use(compression());
app.use(session({
    secret: process.env.SESSION_SECRET || 'this_is_a_default_session_secret_in_case_one_is_not_defined',
    resave: true,
    store: (
      new MongoStore({
        url: sessionDB,
        autoReconnect: true
      })
    ),
    saveUninitialized : true,
    cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());

// TODO: Do we want an HTTP logger?
//app.use(log4js.connectLogger(logger, { level: process.env.LOG_LEVEL || 'info' }));

// app.use(cors());

/********************************
 Passport Middleware Configuration
  ********************************/

passport.serializeUser(function(user, done) {
   done(null, user);
});

passport.deserializeUser(function(obj, done) {
   done(null, obj);
});

// read settings.js
var settings = require('./settings.js');

var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var Strategy = new OpenIDConnectStrategy({
    authorizationURL: settings.authorization_url,
    tokenURL: settings.token_url,
    clientID: settings.client_id,
    scope: 'openid',
    response_type: 'code',
    clientSecret: settings.client_secret,
    callbackURL: settings.callback_url,
    skipUserProfile: true,
    issuer: settings.issuer_id,
    addCACert: true,
    CACertPathList: ['/oidc_w3id_prod.cer']
  },
  function(iss, sub, profile, done) {
    process.nextTick(function() {
      done(null, profile);
    });
  });

passport.use(Strategy);


function ensureAuthenticated(req, res, next) {
	if (!req.isAuthenticated()) {
	  req.session.originalUrl = req.originalUrl;
		res.redirect('/login');
	} else {
		return next();
	}
}

/********************************
 Routing
 ********************************/

app.get('/auth/sso/callback', function(req, res, next) {
  var redirect_url = req.session.originalUrl;
  passport.authenticate('openidconnect', {
          successRedirect: redirect_url,
          failureRedirect: '/failure',
  })(req, res, next);
});

app.get('/', ensureAuthenticated, function(req, res) {
  res.sendFile(path.join(`${PUBLIC_DIR}`, `/index.html`), (err) => {
    if (err) {
      res.status(500).send(err)
    }
  })
});

app.get('/login', passport.authenticate('openidconnect', {}));


app.get('/hello', ensureAuthenticated, function(req, res) {
  res.send(req.user);
});

// failure page
app.get('/failure', function(req, res) {
    res.send('login failed'); });


app.get('/logout', function(req,res) {
  req.session.destroy();
  req.logout();
  res.redirect("https://w3.ibm.com");
});


var HandlerModule = require('./handler/handler');
//var serverAPI = require('./routes/api');

let handler = new HandlerModule(io);
//app.use('/api', serverAPI(handler));
app.use('/api/file', fileUpload);
app.use('/api/employeeValidation', employeeValidation);
app.use('/api/profile', profile);
app.use('/api/employee', employee);
app.use('/api/admin', admin);
app.use('/api/excel', excel);
app.use('/api/slack', slack);
app.use('/api/logger', logger);

app.use(express.static(PUBLIC_DIR));
app.get('*', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(`${PUBLIC_DIR}`, `/index.html`), (err) => {
      if (err) {
        res.status(500).send(err)
      }
  })
})

var server = app.listen(PORT, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('App listening at port:' + port);
});
