var Client = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

function play(host, url, type, volume, node, msg) {

	try {

		var client = new Client();

		client.connect(host, function () {

			if (volume) {
				console.log('connected, launching app on %s with url %s, type %s and volume %s', host, url, type, volume);
			} else {
				console.log('connected, launching app on %s with url %s and type %s', host, url, type);
			}

			client.launch(DefaultMediaReceiver, function (err, player) {
				var media = {

					// Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
					contentId: url,
					contentType: type,
					streamType: 'BUFFERED' // or LIVE    
				};

				if (typeof volume !== 'undefined') {

					if (volume > 0) {
						var obj = {
							level: volume / 100
						};
					} else {
						var obj = {
							muted: true
						};
					}

					client.setVolume(obj, function (err, newvol) {
						if (err) {
							console.log("there was an error setting the volume")
							node.error("Chromecast error: there was an error setting the volume");
							msg.error = "there was an error setting the volume";
							node.send(msg);
							return node.status({
								shape: "dot",
								fill: "red",
								text: "error: there was an error setting the volume"
							});
						}
						console.log("volume changed to %s", Math.round(newvol.level * 100))
					});

				}

				if (player) {

					player.on('status', function (status) {
						console.log('status broadcast playerState=%s', status.playerState);
					});

					player.load(media, {autoplay: true}, function (err, status) {
						if (status) {
							console.log('media loaded playerState=%s', status.playerState);
							node.status({});
						}
						if (err) {
							console.log('media loaded error= %s', err);
							msg.error = " " + err;
							node.send(msg);
							node.error("Chromecast error: " + err);
							return node.status({
								shape: "dot",
								fill: "red",
								text: " " + err
							});

						}

						client.close();

					});

				}

				node.send(msg);

			});

		});

		client.on('error', function (err) {
			msg.error = " " + err;
			node.send(msg);
			node.error("Chromecast " + err);

			client.close();

			return node.status({
				shape: "dot",
				fill: "red",
				text: " " + err
			});
		});

	} catch (err) {
		node.status({
			shape: "dot",
			fill: "red",
			text: " " + err
		});
		node.error("Chromecast error: " + err);
	}

}

module.exports = function (RED) {
	'use strict';

	function Node(n) {

		RED.nodes.createNode(this, n);

		var node = this;

		this.on('input', function (msg) {

			var creds = RED.nodes.getNode(n.creds),
				payload = typeof msg.payload === 'object' ? msg.payload : {};

			var attrs = ['ip', 'url', 'contentType', 'volume'];
			for (var attr of attrs) {
				if (n[attr]) {
					payload[attr] = n[attr];
				}
			}

			if (payload.ip && payload.url && payload.contentType) {
				try {
					play(payload.ip, payload.url, payload.contentType, payload.volume, node, msg);
				} catch (err) {
					node.status({
						shape: "dot",
						fill: "red",
						text: " " + err
					});
					node.error("Chromecast error: " + err);
				}
			}

			//node.send(msg);

		});
	}

	RED.nodes.registerType('chromecast-play', Node);
};
