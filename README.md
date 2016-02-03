stbroker
========

Communicate with an STB portal, as if it had a real API.

[![NPM version](http://img.shields.io/npm/v/stbroker.svg)](https://npmjs.org/package/stbroker) 
[![Flattr this git repo](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=skerit&url=https://github.com/skerit/stbroker&title=stbroker&language=&tags=github&category=software)

## Install

Install it for use in your own application:

`npm install stbroker`

## What is this?

Many IPTV providers require their users to buy an expensive set-top-box in order to watch their streams.
You can use this little library to work around that, and directly get the url of the channel's stream.

## How to use it

```javascript

var iptv = new Stbroker({
	// The mac address you gave your iptv provider, can be made up
	mac_address: '00:1A:79:47:9A:3F',

	// The url to the portal (sometimes this is all you need)
	start_url: 'http://www.your-iptv-provider-url.net/welcome',

	// The following is not strictly needed
	// The root of the portal (sometimes this is a subfolder, so it can be /somethingelse/)
	base: 'http://www.your-iptv-provider-url.net',

	// The path where actions are requested (like handshakes, channel lists, ...)
	action_path: '/action.php'
});

// Get all the available channels
iptv.getChannels(function gotChannels(err, channels) {
	console.log('Channels:', channels);

	channels[0].getStreamUrl(function gotUrl(err, url) {
		console.log('Here\'s your stream url:', url);
	});
});

```