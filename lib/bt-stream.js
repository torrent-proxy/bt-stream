const DHT = require('bittorrent-dht');
const bncode = require('bncode');
const hat = require('hat');
const parseTorrent = require('parse-torrent');
const peerWireSwarm = require('peer-wire-swarm');

const Deferred = require('./deferred');
const Pie = require('./pie');
const exchangeMetadata = require('./exchange-metadata');

const ID = '-FRIDGE-' + hat(48);

module.exports =  class BTStream {
	/**
	 * @param {{
	 *   dhtPort: number
	 * }} params
	 */
	constructor({ dhtPort }) {
		this._dht = null;
		this._dhtPort = dhtPort;
		this._pie = null;
		this._swarm = null;

		this._onPeer = this._onPeer.bind(this);
	}

	/**
	 * @param {string} hash
	 * @return {Promise<*>}
	 */
	getMetaData(hash) {
		if (this._dht || this._pie || this._swarm) {
			// TODO: Create multiple call available
			throw Error('BTStream instance can work one time only');
		}

		const deferred = new Deferred();
		const onWire = (wire) => {
			const exchange = exchangeMetadata({
					infoHash: hash
				},
				(metadata) => {
					const buf = bncode.encode({
						info: bncode.decode(metadata),
						'announce-list': []
					});

					const torrent = parseTorrent(buf);
					deferred.resolve(torrent);

					swarm.off('wire', onWire);
				}
			);

			exchange(wire);
		};

		this._dht = new DHT();
		this._swarm = peerWireSwarm(hash, ID, {size: 100, speed: 10});

		const dht = this._dht;
		const swarm = this._swarm;

		swarm.on('wire', onWire);
		dht.on('peer', this._onPeer);

		dht.listen(this._dhtPort, () => console.log(`DHT start listening on port ${this._dhtPort}`));
		swarm.listen(this._dhtPort);

		dht.lookup(hash);

		return deferred.promise()
			.then((torrent) => {
				this.destroy();

				return torrent;
			});
	}

	/**
	 * @param torrent
	 * @return {PassThrough}
	 */
	downloadTorrent(torrent) {
		console.log('download torrent');

		this._pie = new Pie(torrent);
		return this._pie.getReadStream();
	}

	downloadFile({torrent, file}) {
		const hash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		// TODO: Работает на торренте с одним файлом, но 4то будет на нескольких файлов?
		// TODO: 4то будет, если один кусок содержит 4асть предыду=его файла?
		const targetPieces = this._slicePieces({pieces, pieceSize, file});

		this._pie = new Pie({pieces: targetPieces, pieceSize, hash});

		return this._pie.getReadStream();
	}

	destroy() {
		if (this._dht) {
			this._dht.off('peer', this._onPeer);
			this._dht.destroy();
		}

		if (this._swarm) {
			this._swarm.destroy();
		}

		if (this._pie) {
			this._pie.destroy();
		}

		this._dht = null;
		this._swarm = null;
		this._pie = null;
	}

	// TODO: вынести в utils и покрыть тестами?
    _slicePieces({pieces, pieceSize, file}) {
        const {offset} = file;
        const offsetPieces = offset / pieceSize;
        const filePiecesCount = Math.round(file.length / pieceSize);

        return pieces.slice(offsetPieces, filePiecesCount);
    }

	_onPeer(peer, infoHash, from) {
		this._swarm.add(peer.host + ':' + peer.port)
	}
};
