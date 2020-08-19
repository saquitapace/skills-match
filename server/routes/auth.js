// var express = require('express');


// module.exports = function(app) {
//   var router = express.Router();

//   // START OF CHANGE
//   var session = require('express-session');
//   var passport = require('passport');
//   var cookieParser = require('cookie-parser');
//   var fs = require('fs');
//   var https = require('https');
//     // END OF CHANGE

//     // cfenv provides access to your Cloud Foundry environment
//     // for more info, see: https://www.npmjs.com/package/cfenv
//     var cfenv = require('cfenv');

//     // read settings.js
//     var settings = require('../settings.js');

//     // work around intermediate CA issue
//   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//   // Uncomment the following section if running locally
//   // https.createServer({
//   //     key: fs.readFileSync('key.pem'),
//   //     cert: fs.readFileSync('cert.pem')
//   // }, app).listen(443);
  
//   // START OF CHANGE
//     app.use(cookieParser());
//     app.use(session({resave: 'true', saveUninitialized: 'true' , secret: 'keyboard cat'}));
//     app.use(passport.initialize());
//     app.use(passport.session());

//     passport.serializeUser(function(user, done) {
//         done(null, user);
//       });
    
//       passport.deserializeUser(function(obj, done) {
//         done(null, obj);
//       });
    
//       var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
//       var Strategy = new OpenIDConnectStrategy({
//           authorizationURL : settings.authorization_url,
//           tokenURL : settings.token_url,
//           clientID : settings.client_id,
//           scope: 'openid',
//           response_type: 'code',
//           clientSecret : settings.client_secret,
//           callbackURL : settings.callback_url,
//           skipUserProfile: true,
//           issuer: settings.issuer_id,
//           addCACert: true,
//           CACertPathList: [
//             '/verisign-root-ca.pem',
//             '/symantec.pem',
//             '/blueidSSL.pem',
//             '/prepiam.toronto.ca.ibm.com.pem']
//         },
//         function(iss, sub, profile, accessToken, refreshToken, params, done)  {
//           process.nextTick(function() {
//             profile.accessToken = accessToken;
//             profile.refreshToken = refreshToken;
//             done(null, profile);
//           })
//         });
    
//       passport.use(Strategy);

//       app.get('/login', passport.authenticate('openidconnect', {}));

//       function ensureAuthenticated(req, res, next) {
//         if (!req.isAuthenticated()) {
//           req.session.originalUrl = req.originalUrl;
//           res.redirect('/login');
//         } else {
//           return next();
//         }
//       }

//       // handle callback, if authentication succeeds redirect to
// // original requested url, otherwise go to /failure
//   app.get('/auth/sso/callback',function(req, res, next) {
//     var redirect_url = req.session.originalUrl;
//     passport.authenticate('openidconnect', {
//       successRedirect: redirect_url,
//       failureRedirect: '/failure',
//     })(req,res,next);
//   });

// // failure page
//   app.get('/failure', function(req, res) {
//     res.send('login failed'); });


//   app.get('/logout', function(req,res) {
//     req.session.destroy();
//     req.logout();
//     fs.readFile("public/slo.html", function(err,data) {
//       res.writeHead(200, {'Content-Type':'text/html'});
//       res.write(data);
//       res.end();
//     });
//   });
//   app.use("/", ensureAuthenticated, router);
// }


// // const { Router } = require('express');

// // module.exports = (handler) => {

// //     let api = Router();

// //     api.post('/', (req, res) => {
// //         let username = req.body.username.toLowerCase();
// //         let password = req.body.password.toLowerCase();
// //         if (username == 'test' && password == 'user') {
// //             return res.status(200).json({ login: true, error: 'none' });
// //         } else {
// //             return res.status(200).json({
// //                 login: false,
// //                 error: 'Unable to login. Please check your credentials.'
// //             });
// //         }
// //    });
// //    return api;
// // };