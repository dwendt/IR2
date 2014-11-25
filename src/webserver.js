// abstraction for the middleware so we can switch off express if necessary

var _ = require('underscore'),
    express = require('express'),
    server,
    logger = require('./logger'),
    nconf = require('nconf'),
    winston = require('winston');


servers = [];
servers.push(require('http').createServer(express));

if (nconf.get('https')) {
  servers.push(require('https').createServer({
    key: "todo",
    cert: "todo"
  }, express))
}

(function(app) {
  "use strict";
  
  var port = nconf.get('port');

  logger.init(app);

  // handle turning on minification/cache/etc here
  
  // todo: async?
  _.each(servers, function(server){
    server.on('error', function(err) {
      winston.error(err.stack);
      console.log(err.stack);

      if (err.code === 'EADDRINUSE') {
        winston.error('Desired address in use, something is probably using the desired port. Exiting.');

        process.exit(0);
      } else {
        throw err;
      }
    });
  });

  

  module.exports.servers = servers;
  module.exports.listen = function(cb) {
    var bind_with_port = (nconf.get('bind_address') ? nconf.get('bind_address') + port : '0.0.0.0' + port);

    _.each(servers, function(server){
      servers.listen(port, nconf.get('bind_address'), function(err) {
        if (err) {
          winston.error('Could not bind on: ' + bind_with_port);
          return cb(err);
        }

        winston.info("IR2 is now listening on " + bind_with_port);
      });
    });

  };
}(express));

