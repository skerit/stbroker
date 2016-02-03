var Blast = __Protoblast,
    Fn    = Blast.Bound.Function;

/**
 * The StbChannel class:
 * A wrapper for returned channel data
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Stbroker}   stbroker         Parent stbroker instance
 * @param    {Object}     data             Object containing the single channel data
 */
var Channel = Fn.inherits('Informer', function StbChannel(stbroker, data) {

	/**
	 * The parent Stbroker instance
	 * @type   {Stbroker}
	 */
	this.stbroker = stbroker;

	/**
	 * The id of the channel, as defined by the provider
	 * @type   {String}
	 */
	this.id = data.id;

	/**
	 * The number of the channel
	 * @type   {Number}
	 */
	this.number = parseInt(data.number);

	/**
	 * The XMLTV id, if available
	 * @type   {String}
	 */
	this.xmltv_id = data.xmltv_id;

	/**
	 * The TV Genre id
	 * @type   {Number}
	 */
	this.tv_genre_id = parseInt(data.tv_genre_id);

	/**
	 * The modified timestamp
	 * @type   {Date}
	 */
	this.modified = null;

	/**
	 * Is it HD?
	 * @type   {Boolean}
	 */
	this.is_hd = false;

	if (data.hd == 1 || data.hd === true || data.hd == 'true') {
		this.is_hd = true;
	}

	if (data.modified) {
		this.modified = new Date(data.modified);
	}

	/**
	 * How many hours have been archived
	 * @type   {Number}
	 */
	this.archive_duration = parseInt(data.tv_archive_duration);

	/**
	 * The raw data object
	 */
	this.data = data;
});

/**
 * Get some data property from the raw channel object
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Channel.setMethod(function get(name) {
	return this.data[name];
});

/**
 * Get the stream url
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Channel.setMethod(function getStreamUrl(callback) {
	this.stbroker.getPlaylist(this.data, function gotUrl(err, url) {

		if (err) {
			return callback(err);
		}

		callback(null, url);
	});
});

module.exports = Channel;