"use strict";

var fs    = require('fs'),
    path  = require('path'),
    nconf = require('nconf');

// nconf should use command-line args, then env vriables. 
nconf.argv().env();

global.env = process.env.NODE_ENV || 'production';

var configFile = path.join(__dirname, '/config.json');
// these would have been passed on the command line or env
if(nconf.get("setup")) {
  setup();
} else {
  start();
}


function loadConfig() {
  nconf.file({
    file: configFile
  });

  // default ir2 settings.
  nconf.defaults({
    base_dir: __dirname,                                  // just where everything is at.
    files_location: path.join(__dirname, 'uploads'),      // path to store uploaded files for analysis in
    views_dir: path.join(__dirname, 'src/views')          // handlebars templates to render
  });
}


function start() {
  loadConfig();

  var templates = require("./src/templates"),
      webserver = require("./src/webserver"),
      sockets = require("./src/socket.io"),
      r2piper   = require("r2piper");

  templates.setGlobal('relative_path', nconf.get('relative_path'));


  r2piper.init(function(err) {
    if (err) {
      winston.error("[app] r2piper failed to initialize.");
      winston.error(err);
      return;
    }

    // Continue app init
    sockets.init(webserver.server);

    nconf.set('url', nconf.get('base_url') +
                    (nconf.get('use_port') ? ':'+nconf.get('port') : '') +
                     nconf.get('relative_path') );

    templates.compile();
    webserver.listen();

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}


function shutdown(code) {
  winston.info('[app] Shutdown initialized.');

  _.each(require('./src/webserver').servers, function(server) {
    server.close();
  });

  // TODO: handle killing r2pipe stuff

  winston.info('[app] Shutdown complete.');

  process.exit(code || 0);
}

function setup() {

}
