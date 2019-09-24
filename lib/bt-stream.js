const BitField = require('bitfield');
const {Readable} = require('stream');
const Pie = require('./pie');

module.exports =  class BTStream {
	constructor({swarm}) {
		this._swarm = swarm;
	}

	/**
	 * @param {string} _hash
	 * @return {Promise<*>}
	 */
	getMetaData(_hash) {
		console.log(`getmetadata`)
		return new Promise((resolve) => {
			let hash = _hash;

			if (hash.includes(`magnet:?xt=urn:btih:`)) {
				hash = hash.substr(`magnet:?xt=urn:btih:`.length);
			}

			this._swarm.once(this._swarm.EVENT_METADATA_LOADED, resolve);
			this._swarm.lookup(hash);
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
		const {pieces, pieceLength: pieceSize} = torrent;
		const lastLength = pieceSize;
		const bitField = new BitField(torrent.pieces.length);

		this._pie = new Pie({swarm: this._swarm, pieces, pieceSize, bytesOffset, firstOffset, lastLength, bitField});

		return this._pie.getReadStream();
	}

	downloadFile({torrent, file}) {
		console.log('download file');
		const torrentHash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		const result = this._slicePieces({pieces, pieceSize, file});
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		const {offset: bytesOffset} = file;

		const bitField = new BitField(torrent.pieces.length);
		this._pie = new Pie({swarm: this._swarm, pieces: targetPieces, pieceSize, torrentHash, bytesOffset, firstOffset, lastLength, bitField});

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
		console.log('download file by path');
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
				return this.downloadFile({torrent, file});
		} else {
			return this._createEmptyReadableStream();
		}
	}

	destroy() {
		if (this._pie) {
			this._pie.destroy();
			this._pie = null;
		}
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
};
