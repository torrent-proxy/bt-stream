const {Readable} = require('stream');
const Pie = require('./pie');
const {slicePieces} = require('./utils');
const log = require('./logger')('BTStream');

const createEmptyReadableStream = () => {
	const stream = new Readable();
	setImmediate(() => stream.emit('error', new Error('File not found')));
	return stream;
};


module.exports = class BTStream {
	constructor({swarm}) {
		this._swarm = swarm;
	}

	/**
	 * @param {string} _hash
	 * @return {Promise<*>}
	 */
	getMetaData(_hash) {
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
	 * @param {{files: [],}} torrent
	 * @param {string} filePath
	 * @param {number} from Offset from file start position
	 * @returns {*}
	 */
	downloadFile({torrent, file, from, to}) {
		const torrentHash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		const result = slicePieces({pieces, pieceSize, file, from, to});
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		this._pie = new Pie({
			swarm: this._swarm,
			torrentHash,
			pieces: targetPieces,
			pieceSize,
			pieceIndexOffset: pieces.findIndex((it) => it === targetPieces[0]),
			firstOffset,
			lastLength,
		});

		return this._pie.getReadStream();
	}

	downloadFileByName({torrent, filename, offset}) {
		const file = torrent.files.find((file) => file.name === filename);

		if (file) {
				return this.downloadFile({torrent, file, from: offset});
		} else {
			// TODO: Зачем эта функциональность? Тут же стоит бросить исключение.
			return createEmptyReadableStream();
		}
	}

	/**
	 * @param {{files: [],}} torrent
	 * @param {string} filePath
	 * @param {number} offset Offset from file start position
	 * @returns {*}
	 */
	downloadFileByPath({torrent, filePath, offset, to}) {
		log('download file by path::0', {offset});
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
			return this.downloadFile({torrent, file, from: offset, to});
		} else {
			// TODO: Зачем эта функциональность? Тут же стоит бросить исключение.
			return createEmptyReadableStream();
		}
	}

	destroy() {
		if (this._pie) {
			this._pie.destroy();
			this._pie = null;
		}

		this._swarm.destroy();
	}
};
