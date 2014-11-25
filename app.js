"use strict";

var fs		= require('fs'),
		nconf = require('nconf');

// nconf should use command-line args, then env vriables, then a config file.
nconf.argv().env();

global.env = process.env.NODE_ENV || 'production';


