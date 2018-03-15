const hat = require('hat');
const peerWireSwarm = require('peer-wire-swarm');
const bncode = require('bncode');
const parseTorrent = require('parse-torrent');
const DHT = require('bittorrent-dht');

const exchangeMetadata = require('./exchange-metadata');
const Deferred = require('./deferred');
const Pie = require('./pie');

const ID = '-FRIDGE-' + hat(48);
const DEFAULT_PORT = 8181;

module.exports =  class BTStream {
	constructor(hash) {
		/**
		 * @type {string}
		 * @private
		 */
		this._hash = hash;
	}

	/**
	 * @return {Promise<*>}
	 */
	getMetaData() {
		console.log('get metadata');
		const deferred = new Deferred();

		const exchange = exchangeMetadata({
				infoHash: this._hash
			},
			(metadata) => {
				const buf = bncode.encode({
					info: bncode.decode(metadata),
					'announce-list': []
				});

				const torrent = parseTorrent(buf);
				deferred.resolve(torrent);
			}
		);

		const dht = new DHT();
		const swarm = peerWireSwarm(this._hash, ID, {size: 100, speed: 10});

		swarm.on('wire', (wire) => exchange(wire));
		dht.on('peer', (peer, infoHash, from) => swarm.add(peer.host + ':' + peer.port));

		dht.listen(DEFAULT_PORT, () => console.log(`DHT start listening on port ${DEFAULT_PORT}`));
		swarm.listen(DEFAULT_PORT);

		dht.lookup(this._hash);

		return deferred.promise()
			.then((torrent) => {
				swarm.destroy();
				dht.destroy();

				return torrent;
			});
	}


	/**
	 * @param torrent
	 * @return {PassThrough}
	 */
	downloadTorrent(torrent) {
		console.log('download torrent');

		const pie = new Pie(torrent);
		return pie.getReadStream();
	}
}
