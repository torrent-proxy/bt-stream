const BitField = require('bitfield');
const DHT = require('bittorrent-dht');
const PassThrough = require('stream').PassThrough;
const crypto = require('crypto');
const peerWireSwarm = require('peer-wire-swarm');
require('color');
const hat = require('hat');

const statePromise = require('./state-promise');

const DEFAULT_PORT = 8181;

const MAX_REQUESTS = 100;
const CHUNK_SIZE = 16384;

const ID = '-FRIDGE-' + hat(48);

module.exports = class Pie {
	constructor(torrent) {
		console.log('new pie');
		this._torrent = torrent;

		/**
		 * @type {number}
		 * @private
		 */
		this._chunksCount = torrent.pieceLength;
		console.log('pie', 1, this._chunksCount);

		/**
		 * @type {Buffer}
		 * @private
		 */
		this._pie = Buffer.alloc(this._chunksCount);
		console.log('pie', 2);

		/**
		 * @type {PassThrough}
		 * @private
		 */
		this._rs = new PassThrough();

		/**
		 * @type {BitField}
		 * @private
		 */
		this._bitfield = new BitField(this._torrent.pieces.length);

		const hash = this._torrent.infoHash;

		/**
		 * @type {Swarm}
		 * @private
		 */
		this._swarm = peerWireSwarm(hash, ID, {size: 1000, speed: 10});

		/**
		 * @type {Array<Promise>}
		 * @private
		 */
		this._requests = [];

		/**
		 * @type {number}
		 * @private
		 */
		this._donePieces = 0;

		/**
		 * @type {number}
		 * @private
		 */
		this._interestedPieceIndex = 0;

		/**
		 * @type {?Promise}
		 * @private
		 */
		this._waitPiece = null;

		this._wire = null;

		const dht = new DHT();

		dht.on('peer', (peer, infoHash, from) => this._swarm.add(peer.host + ':' + peer.port));
		this._swarm.on('wire', (wire) => this._onWire(wire));

		dht.on('error', (err) => console.error('dht error', err));
		this._swarm.on('error', (err) => console.error('swarm error', err));
		dht.listen(DEFAULT_PORT);
		this._swarm.listen(DEFAULT_PORT);

		dht.lookup(hash);

		console.log('pie constructor end')
	}

	/**
	 * @return {PassThrough}
	 */
	getReadStream() {
		return this._rs;
	}

	/**
	 * @param {Buffer} data
	 * @param {number} position
	 * @param {number} count
	 */
	addPieces(data, position, count) {
		console.log('add pieces');
		data.copy(this._pie, position, 0, count);
	}

	/**
	 * @return {string}
	 */
	sha1() {
		return crypto.createHash('sha1')
			.update(this._pie)
			.digest('hex');
	}

	/**
	 * @return {Buffer}
	 */
	getPie() {
		return this._pie;
	}

	_loadPiece(wire) {
		console.log('load piece', this._donePieces, this._requests.length);
		const offset = (this._donePieces + this._requests.length) * CHUNK_SIZE;

	}

	_loadPiece(wire) {
		console.log('load piece', 'done', this._donePieces, 'need', this._requests.length);
		const offset = (this._donePieces + this._requests.length) * CHUNK_SIZE;
		let tryCount = 0;

		if (offset < this._chunksCount) {
			const length = offset + CHUNK_SIZE < this._chunksCount ?
				CHUNK_SIZE : this._chunksCount - offset;

			const interestedPieceIndex = this._interestedPieceIndex;
			const request = this._loadChunk(wire, interestedPieceIndex, offset, length, 0)
				.then((block) => {
					this.addPieces(block, offset, length);
					this._donePieces++;
					this._requests = this._requests.filter((_request) => _request !== request);
				})
				.catch((err) => {
					tryCount++;
					console.log('error1:', err);
					this._swarm.remove(wire.peerAddress);

					const nextWire = this._swarm.wires[tryCount];

					if (nextWire) {
						console.log('next wire');
						return this._loadChunk(nextWire, interestedPieceIndex, offset, length);
					} else {
						throw err;
					}
				});

			this._requests.push(request);

			request.then(() => {
				const chunksCount = Math.ceil(this._donePieces / CHUNK_SIZE);
				const done = this._donePieces;
				const percent = done / chunksCount;

				console.log(percent + '% [' + this._interestedPieceIndex + 1 + '/' + this._torrent.pieces.length + ']');

				this._loadPiece(wire);
			});

			if (wire.peerChoking === false && wire.requests.length < MAX_REQUESTS) {
				this._loadPiece(wire);
			}
		} else {
			if (!this._waitPiece) {
				this._waitPiece = Promise.all(this._requests);

				this._waitPiece.then(() => {
					const pieHash = this.sha1();

					{
						console.log(pieHash);
						console.log(this._torrent.pieces[this._interestedPieceIndex]);
						console.log('verify:', pieHash === this._torrent.pieces[this._interestedPieceIndex]);
						console.log(this._interestedPieceIndex + 1 + '/' + this._torrent.pieces.length);
					}

					if (this._interestedPieceIndex === this._torrent.pieces.length - 1) {
						this._rs.end(this.getPie());
					} else {
						this._rs.write(this.getPie());

						this._requests = [];
						this._waitPiece = null;
						this._interestedPieceIndex += 1;

						this._loadPiece(wire);
					}
				});
			}
		}
	}

	_loadChunk(wire, interestedPieceIndex, offset, length) {
		console.log('load chunk', interestedPieceIndex, offset, length);
		return new Promise((resolve, reject) => {
			wire.request(interestedPieceIndex, offset, length, (err, block) => {
				if (err) {
					reject(err);
				} else {
					resolve(block);
				}
			});
		});
	}

	_onWire(wire) {
		wire.port(DEFAULT_PORT);
		wire.bitfield(this._bitfield);

		wire.on('unchoke', () => this._onUnChoke(wire));
	}

	_onUnChoke(wire) {
		console.log('on un choke');
		const interestedPieces = [this._interestedPieceIndex];
		const haveInterested = interestedPieces.every((index) => wire.peerPieces[index]);

		if (haveInterested) {
			wire.interested();
		}

		if (wire.amInterested === true && wire.peerChoking === false) {
			this._loadPiece(wire);
		}
	}
}
