var Blast = require('protoblast')(false), // Protoblast without native mods
    http  = require('http'),
    zlib  = require('zlib'),
    StbChannel = require('./stb_channel'),
    URL   = Blast.Bound.URL,
    Str   = Blast.Bound.String,
    Obj   = Blast.Bound.Object,
    Fn    = Blast.Bound.Function;

/**
 * The Stbroker class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   config
 */
var Broker = Fn.inherits('Informer', function Stbroker(config) {

	if (!config || typeof config != 'object') {
		throw new Error('Stbroker config needs to be an object');
	}

	// The portal url will be resolved later
	this.portal_url = null;

	// The token will be requested
	this.token = null;

	// The origin domain
	this.origin = null;

	// Debug
	this.debug = config.debug || false;

	// The base for creating requests
	this.base = config.base;

	// The action path
	this.action_path = config.action_path || '/server/load.php';

	// The mac_address to identify as
	this.mac_address = config.mac_address;

	// The start url
	this.start_url = config.start_url;

	// Get stream from renewed channel list?
	this.renew_channel_list = config.renew_channel_list;

	// Begin resolving
	this.getPortalUrl();

	// Get the token ASAP
	this.getToken();
});


/**
 * The user agent to use during requests
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setProperty('user_agent', 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3');

/**
 * Return a cookie string to set
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function createCookie() {
	return 'mac=' + encodeURIComponent(this.mac_address) + '; stb_lang=en; timezone=Europe%2FKiev';
});

/**
 * Safely parse a json string
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function safe_parse(str) {

	var result = null;

	try {
		result = JSON.parse(str);
	} catch (err) {}

	return result;
});

/**
 * Create a basic HTTP request
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}    options
 * @param    {Function}  callback
 */
Broker.setMethod(function http_request(options, callback) {

	var that = this,
	    config = {},
	    req,
	    url;

	if (options.url) {
		url = URL.parse(options.url);

		config.host = url.hostname;
		config.path = url.pathname + url.search;
		config.port = url.port;
	}

	if (options.headers) {
		config.headers = options.headers;
	}

	if (options.headers == null) {
		options.headers = {};
	}

	// Allow gzip-compressed responses
	options.headers['Accept-Encoding'] = 'gzip';

	// Accept json responses
	options.headers['accept'] = 'application/json';

	// Set the user agent string
	options.headers['User-Agent'] = this.user_agent;

	if (this.debug) {
		if (options.redirect_count) {
			console.log('Creating redirected request using', config);
		} else {
			console.log('Creating request using', config);
		}
	}

	// Create the request
	req = http.request(config, function gotResponse(res) {

		var output,
		    gzip,
		    body = '';

		// Set the request options on the response object
		res.request_options = options;

		// Follow redirects if there are any
		if (res.statusCode > 299 && res.statusCode < 400) {

			// Store this url as the first url, if it hasn't been set yet
			if (options.first_url == null) {
				options.first_url = url;
			}

			// Set the redirect count
			if (options.redirect_count == null) {
				options.redirect_count = 0;
			}

			options.redirect_count++;

			options.url = res.headers['location'];
			options.headers.referrer = '' + url;

			if (that.debug) {
				console.log('Redirection nr', options.redirect_count, 'to', options.url);
			}

			return that.http_request(options, callback);
		}

		// If an error occurs, call the callback with it
		res.on('error', function gotResponseError(err) {
			callback(err, res);
		});

		// If the response is gzipped, unzip it
		if (res.headers['content-encoding'] == 'gzip') {
			gzip = zlib.createGunzip();
			res.pipe(gzip);
			output = gzip;
		} else {
			output = res;
		}

		// Listen for data to stream in
		output.on('data', function gotData(data) {
			body += data.toString('utf-8');
		});

		output.on('end', function ended() {
			callback(null, res, body);
		});
	});

	// Listen for request errors
	req.on('error', function onRequestError(err) {
		callback(err);
	});

	// Initiate the request
	req.end();
});

/**
 * Basic request making method
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function _request(_options, callback) {

	var that = this,
	    passed_options,
	    options;

	if (typeof _options == 'string') {
		passed_options = {url: _options};
	} else {
		passed_options = _options;
	}

	options = Obj.merge({}, passed_options);

	// Create the HTTP request
	this.http_request(options, function gotResponse(err, response, body) {

		var data;

		if (err) {
			console.log('ERROR: ' + err);
			return callback(err);
		}

		// If the response is a json string, try to parse it
		if (response.headers['content-type'] && (~response.headers['content-type'].indexOf('json') || ~response.headers['content-type'].indexOf('javascript'))) {
			body = that.safe_parse(body);
		}

		if (that.debug) {
			console.log('\nSENTHEADER\n=========\n' + response.req._header + 'ENDHEADER\n========\n');
		}

		if (typeof body == 'string' && body.indexOf('Authorization failed') > -1) {
			console.log('ERR:', body);
			return callback(new Error(body));
		}

		if (typeof body == 'object') {
			return callback(err, body.js, body.text);
		} else {
			return callback(err, response, body);
		}

	});
});

/**
 * Cookie request
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function _crequest(_options, callback) {

	var c_options,
	    options;

	c_options = {
		headers: {
			Cookie: this.createCookie(),
			'X-User-Agent': 'Model: MAG254; Link: WiFi'
		}
	};

	if (this.referrer) {
		c_options.headers.Referrer = this.referrer;
	}

	options = Obj.merge({}, c_options, _options);

	this._request(options, callback);
});

/**
 * Token request
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function _trequest(_options, callback) {

	var that = this,
	    c_options,
	    options;

	this.getToken(function gotToken(err, token, token_is_new) {

		if (err) {
			if (callback) return callback(err);
			that.emit('error', err);
		}

		c_options = {
			headers: {
				'Authorization': 'Bearer ' + token
			}
		};

		options = Obj.merge({}, c_options, _options);

		that._crequest(options, function gotResponse(err, response, body) {

			// Detect authorization failures
			if (typeof body == 'string' && body.indexOf('Authorization failed') > -1) {

				// If the token is new, we can't solve this problem
				if (token_is_new) {
					return callback(new Error(body));
				}

				// Clear out the token
				that.token = null;

				// Re-request the token
				that.getToken(gotToken);
			}

			callback(err, response, body);
		});
	});
});

/**
 * Get the real portal url, following any redirects
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getPortalUrl(url, callback) {

	var that = this,
	    options;

	if (typeof url == 'function') {
		callback = url;
		url = null;
	}

	if (typeof url != 'string') {
		url = this.start_url;
	}

	if (this.portal_url) {
		if (callback) callback(null, this.portal_url);
		return;
	}

	options = {
		url: url
	};

	// Create the request to the start url, follow regular http redirects
	this._request(options, function gotStartPage(err, response, body) {

		var response_url,
		    js_redirect,
		    url;

		if (err) {
			return that.emit('error', err);
		}

		response_url = response.request_options.url;

		// Look for javascript redirects
		js_redirect = /location\.href\s*\=\s*['"](.+?)['"]/.exec(body);

		if (js_redirect && js_redirect[1]) {
			response_url = js_redirect[1];
		}

		// Store the complete portal url
		that.portal_url = response_url;

		// Parse the url
		if (typeof response_url == 'string') {
			url = URL.parse(response_url);
		} else {
			url = response_url;
		}

		// Turn the response_url back into a string
		response_url = '' + response_url;

		if (that.debug) {
			console.log('Portal url is', JSON.stringify(response_url));
		}

		// Store the origin
		that.origin = url.origin;

		if (!that.base) {
			// Store the base path
			that.base = Str.before(response_url, '/c/');

			if (that.base) {
				// Store the portal refer page
				that.referrer = that.base + '/c/';
			} else {
				that.base = response_url;
				that.referrer = response_url;
			}
		}

		// Inform we've got the url
		that.emit('gotPortalUrl', response_url);

		if (callback) callback(null, response_url);
	});
});

/**
 * Get the url to a certain command
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String}   action
 * @param    {Object}   options
 *
 * @return   {URL}
 */
Broker.setMethod(function getActionUrl(action, options) {

	var url = URL.parse(this.base + this.action_path),
	    key;

	if (!options) {
		options = {};
	}

	if (!options.type) {
		options.type = 'stb';
	}

	// The type is always stv
	url.addQuery('type', options.type);

	// Unset the type
	options.type = null;

	// Add the action
	url.addQuery('action', action);

	// It's always a js http request
	if (options.jshttp !== false) {
		url.addQuery('JsHttpRequest', '1-xml');
	}

	if (options.params) {
		for (key in options.params) {
			url.addQuery(key, options.params[key]);
		}
	}

	return url;
});

/**
 * Request a certain action
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function requestAction(action, options, callback) {

	var that = this,
	    requester,
	    url;

	if (!this.hasBeenSeen('gotPortalUrl')) {
		return this.after('gotPortalUrl', function gotPortal() {
			that.requestAction(action, options, callback);
		});
	}

	if (typeof options == 'function') {
		callback = options;
		options = null;
	}

	if (!options) {
		options = {};
	}

	if (typeof options.reqtype == 'undefined') {
		if (action == 'handshake') {
			options.reqtype = 'cookie';
		} else {
			options.reqtype = 'token';
		}
	}

	if (options.reqtype == 'cookie') {
		requester = this._crequest;
	} else {
		requester = this._trequest;
	}

	options.reqtype = null;

	// Set the url
	url = this.getActionUrl(action, options);

	if (this.debug) {
		console.log('Requesting action url', url, ''+url);
	}

	options.url = ''+url;

	requester.call(this, options, callback);
});

/**
 * Get a token
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getToken(callback) {

	var that = this;

	if (this.token) {
		return callback(null, this.token);
	}

	if (this.token_hinder) {
		return this.token_hinder.push(function gotToken() {
			if (callback) callback(null, that.token);
		});
	}

	if (this.debug) {
		console.log('Requesting a new token ...');
	}

	// Create a hinder (so only 1 request is made)
	this.token_hinder = Fn.hinder(function gettingToken(done) {
		that.requestAction('handshake', function gotHandshake(err, data, text) {

			if (data && data.statusCode == 404) {
				that.emit('error', new Error('Hanshake url is not valid'));
			}

			if (err) {
				this.emit('error', err);
			}

			// Set the token
			that.token = data.token;

			if (that.debug) {
				console.log('Got token:', data.token);
			}

			// Destroy the hinder
			that.token_hinder = null;

			if (callback) callback(null, data.token, true);
			done();
		});
	});
});

/**
 * Get the profile
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getProfile(callback) {

	var that = this,
	    options;

	options = {
		params: {
			hd: 1,
			ver: 'ImageDescription: 0.2.18-r11-pub-254; ImageDate: Wed Mar 18 18:09:40 EET 2015; PORTAL version: 4.9.14; API Version: JS API version: 331; STB API version: 141; Player Engine version: 0x572',
			num_banks: 1,
			stb_type: 'MAG254',
			image_version: 218,
			auth_second_step: 0,
			hw_version: '2.6-IB-00',
			not_valid_token: 0
		}
	};

	this.requestAction('get_profile', options, function gotProfile(err, data, text) {

		if (err) {
			return callback(err);
		}

		that.profile = data;
		callback(null, data);
	});
});

/**
 * Get the localization info
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getLocalization(callback) {

	var that = this,
	    options;

	this.requestAction('get_localization', function gotProfile(err, data, text) {

		if (err) {
			return callback(err);
		}

		callback(null, data);
	});
});

/**
 * Authorize
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getAuthorization(callback) {

	var that = this;

	if (this.authorized) {
		return callback();
	}

	if (this.authorize_hinder) {
		if (callback) this.authorize_hinder.push(callback);
		return;
	}

	this.authorize_hinder = Fn.hinder(function gettingAuth(done) {

		Fn.series(function gettingToken(next) {
			that.getToken(next);
		}, function gettingProfile(next) {
			that.getProfile(next);
		}, function gettingLocalization(next) {
			that.getLocalization(next);
		}, function done(err) {

			// Reset the hinder
			that.authorize_hinder = null;

			if (err) {
				return callback(err);
			}

			that.authorized = true;
			callback();
		});
	});
});

/**
 * Get all the available tv channels
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getChannels(force, callback) {

	var that = this;

	if (typeof force == 'function') {
		callback = force;
		force = false;
	}

	if (force || this.channels) {
		return callback(null, this.channels);
	}

	this.getAuthorization(function gotAuth(err) {

		if (err) {
			return callback(err);
		}

		that.requestAction('get_all_channels', {type: 'itv'}, function gotAllChannels(err, data, text) {

			var channels = [],
			    i;

			if (err) {
				return callback(err);
			}

			for (i = 0; i < data.data.length; i++) {
				channels.push(new StbChannel(that, data.data[i]));
			}

			that.channels = channels;
			callback(null, that.channels);
		});
	});
});

/**
 * Get a channel playlist
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Broker.setMethod(function getPlaylist(channel, callback) {

	var that = this,
	    command,
	    options;

	if (this.renew_channel_list) {
		return this.getChannels(true, function gotChannels(err, channels) {

			var temp,
			    url,
			    i;

			if (err) {
				return callback(err);
			}

			for (i = 0; i < channels.length; i++) {
				temp = channels[i];

				if (temp.id == channel.id) {
					command = temp.cmd;
				}
			}

			if (!command) {
				return callback(new Error('No command found'));
			}

			url = command.after('ffmpeg ');

			if (!url) {
				url = command.replace(/^\w+\s+http/i, 'http');
			}

			if (!url) {
				return callback(new Error('Url could not be extracted from command'));
			}

			callback(null, url);
		});
	}

	command = channel.cmd;

	options = {
		type: 'itv',
		params: {
			cmd: command,
			disable_ad: 0
		}
	};

	this.getAuthorization(function gotAuth(err) {

		if (err) {
			return callback(err);
		}

		that.requestAction('create_link', options, function gotPlaylist(err, data, b) {

			var playlist_url;

			if (err) {
				return callback(err);
			}

			// Data contains:
			// - id
			// - cmd
			// - streamer_id
			// - link_id
			// - load
			// - error

			if (data && data.socket) {
				// 'Data is a response object'
				playlist_url = command.after('ffmpeg ');
			} else {
				// Get the url, remove word before url
				playlist_url = data.cmd.replace(/^\w+\s+http/i, 'http');
			}

			callback(null, playlist_url);
		});
	});
});

module.exports = Broker;