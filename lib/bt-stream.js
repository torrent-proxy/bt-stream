const BitField = require('bitfield');
const DHT = require('bittorrent-dht');
const bncode = require('bncode');
const hat = require('hat');
const parseTorrent = require('parse-torrent');
const peerWireSwarm = require('peer-wire-swarm');

const { Readable } = require('stream');

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
		const exchange = exchangeMetadata(
			{
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
	downloadTorrent({torrent}) {
		console.log('download torrent');

		const bytesOffset = 0;
		const firstOffset = 0;
		const {pieces, pieceLength: pieceSize, infoHash: torrentHash} = torrent;
		const lastLength = pieceSize;
		const bitField = new BitField(torrent.pieces.length);

		this._pie = new Pie({pieces, pieceSize, torrentHash, bytesOffset, firstOffset, lastLength, bitField});

		return this._pie.getReadStream();
	}

	downloadFile({torrent, file}) {
		const torrentHash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		const result = this._slicePieces({pieces, pieceSize, file});
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		const {offset: bytesOffset} = file;

		const bitField = new BitField(torrent.pieces.length);
		this._pie = new Pie({pieces: targetPieces, pieceSize, torrentHash, bytesOffset, firstOffset, lastLength, bitField});

		return this._pie.getReadStream();
	}

	downloadFileByName({torrent, filename}) {
		const file = torrent.files.find((file) => file.name === filename);

		if (file) {
				return this.downloadFile({torrent, file});
			} else {
				return this._createEmptyReadableStream();
			}
	}

	downloadFileByPath({torrent, filePath}) {
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
				return this.downloadFile({torrent, file});
			} else {
				return this._createEmptyReadableStream();
			}
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

	_slicePieces({pieces, pieceSize, file}) {
		const {offset} = file;
		const offsetPieces = Math.floor(offset / pieceSize);
		const filePiecesCount = Math.round(file.length / pieceSize);

		const _pieces = pieces.slice(offsetPieces, offsetPieces + filePiecesCount);
		const firstOffset =  offset % pieceSize;
		const lastLength = (file.length - firstOffset) % pieceSize;

		return {
			pieces: _pieces,
			firstOffset,
			lastLength
		};
	}

	_createEmptyReadableStream() {
		const stream = new Readable();
		setImmediate(() => stream.emit('error', new Error('File not found')));
		return stream;
	}

	_onPeer(peer, infoHash, from) {
		this._swarm.add(peer.host + ':' + peer.port)
	}
};
