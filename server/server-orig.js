// const express = require('express')
// const path = require('path')
// const port = process.env.PORT || 8080
// const app = express()

// const PUBLIC_DIR = process.cwd() + '/public';

// // serve static assets normally
// app.use(express.static(PUBLIC_DIR));
// app.get('/*', (req, res) => {
//     res.sendFile(path.join(`${PUBLIC_DIR}`, `/index.html`), (err) => {
//         if (err) {
//           res.status(500).send(err)
//         }
//     })
// })

// app.listen(port)
// console.log("server started on port " + port)





// // // Uncomment following to enable zipkin tracing, tailor to fit your network configuration:
// // // var appzip = require('appmetrics-zipkin')({
// // //     host: 'localhost',
// // //     port: 9411,
// // //     serviceName:'frontend'
// // // });

// // require('appmetrics-dash').attach();
// // require('appmetrics-prometheus').attach();
// // const appName = require('./../package').name;
// // const http = require('http');
// // const express = require('express');
// // const log4js = require('log4js');
// // const localConfig = require('./config/local.json');
// // const path = require('path');

// // const logger = log4js.getLogger(appName);
// // const app = express();
// // const server = http.createServer(app);

// // app.enable('trust proxy');

// // app.use(log4js.connectLogger(logger, { level: process.env.LOG_LEVEL || 'info' }));
// // const serviceManager = require('./services/service-manager');
// // require('./services/index')(app);
// // require('./routers/index')(app, server);

// // // Add your code here



// // const port = process.env.PORT || localConfig.port;
// // server.listen(port, function(){
// //   logger.info(`NodejsWebAppwithExpressjsandReactVJVHT listening on http://localhost:${port}/appmetrics-dash`);
// //   logger.info(`NodejsWebAppwithExpressjsandReactVJVHT listening on http://localhost:${port}`);
// // });

// // app.use (function (req, res, next) {
// //   if (req.secure || process.env.BLUEMIX_REGION === undefined) {
// //     console.log('failed--');
// //     next();
// //   } else {
// //     console.log('redirecting to https');
// //     res.redirect('https://' + req.headers.host + req.url);
// //   }
// // });

// // app.use(function (req, res, next) {
// //   res.sendFile(path.join(__dirname, '../public', '404.html'));
// // });

// // app.use(function (err, req, res, next) {
// //   res.sendFile(path.join(__dirname, '../public', '500.html'));
// // });