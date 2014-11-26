
var SocketIO = require('socket.io'),
    socketioWildcard = require('socket.io-wildcard'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    nconf = require('nconf'),
    socketCookieParser = require('cookie-parser')(nconf.get('secret')),
    winston = require('winston'),
    logger = require('../logger'),
    ratelimit = require('../middleware/ratelimit'),
    Sockets = {},
    Namespaces = {};

var io;




Sockets.init = function(server) {
  // Default socket.io config
  var config = {
    log: true,
    'log level': process.env.NODE_ENV === 'development' ? 2 : 1,
    transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket'],
    'browser client minification': true,
    resource: nconf.get('relative_path') + '/socket.io'
  };

  // .server will point to the wildcard instance listening
  io = socketioWildcard(SocketIO).listen(server, config);
  Sockets.server = io;

  // load any modules in the current dir, they add to socket functionality.
  fs.readdir(__dirname, function(err, files) {
    files.splice(files.indexOf('index.js'), 1);
    async.each(files, function(lib, next) {
      if (lib.substr(lib.length - 3) === '.js') {
        lib = lib.slice(0, -3);
        Namespaces[lib] = require('./' + lib);
      }
      next();
    });
  });

  io.sockets.on('connection', function(socket) {
    var hs = socket.handshake,
    sessionID;

    if (!hs) {
      return;
    }

    // Validate the session, if present
    socketCookieParser(hs, {}, function(err) {
      if(err) {
        return winston.error(err.message);
      }
      sessionID = socket.handshake.signedCookies['express.sid'];
      db.sessionStore.get(sessionID, function(err, sessionData) {
        /* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
        logger.io_one(socket);

        socket.join('online');
        socket.emit('event:connect', {
          status: 1,
          username: 'guest' // TODO: choose your username / active users view
        });
      });
    });

    socket.on('disconnect', function() {
      // todo: do we care?
    });

    // Handles dispatching socket messages to handlers in the Namespaces array.
    socket.on('*', function(payload, callback) {
      if (!payload.name) {
        return winston.warn('[socket.io] Empty method name');
      }

      if (ratelimit.isFlooding(socket)) {
        winston.warn('[socket.io] Too many emits! Disconnecting. Message : ' + payload.name);
        return socket.disconnect();
      }

      // The namespace is the name before a period.
      // The method in the namespace follows
      var parts = payload.name.toString().split('.'),
      namespace = parts[0],
      methodToCall = parts.reduce(function(prev, cur) {
        if (prev !== null && prev[cur]) {
          return prev[cur];
        } else {
          return null;
        }
      }, Namespaces);
      if(!methodToCall) {
        if (process.env.NODE_ENV === 'development') {
          winston.warn('[socket.io] Unrecognized message: ' + payload.name);
        }
        return;
      }
      if (Namespaces[namespace].before) {
        Namespaces[namespace].before(socket, payload.name, function() {
          callMethod(methodToCall, socket, payload, callback);
        });
      } else {
        callMethod(methodToCall, socket, payload, callback);
      }
    });
  });
};

