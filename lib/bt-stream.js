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
		this._pies = [];
	}

	/**
	 * @param {string} _hash
	 * @return {Promise<*>}
	 */
	getMetaData(_hash) {
		if (this._metadata) {
			return Promise.resolve(this._metadata);
		}

		return new Promise((resolve) => {
			let hash = _hash;

			if (hash.includes(`magnet:?xt=urn:btih:`)) {
				hash = hash.substr(`magnet:?xt=urn:btih:`.length);
			}

			this._swarm.once(this._swarm.EVENT_METADATA_LOADED, (metadata) => {
				this._metadata = metadata;
				resolve(metadata);
			});

			this._swarm.lookup(hash);
		});
	}

	/**
	 * @param {{files: [],}} torrent
	 * @param {string} filePath
	 * @param {number} from Offset from file start position
	 * @returns {*}
	 */
	downloadFile({torrent, file, from}) {
		const torrentHash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		const result = slicePieces({pieces, pieceSize, file, from});
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		const pie = new Pie({
			swarm: this._swarm,
			torrentHash,
			pieces: targetPieces,
			pieceSize,
			pieceIndexOffset: pieces.findIndex((it) => it === targetPieces[0]),
			firstOffset,
			lastLength,
		});

		this._pies.push(pie);

		return pie.getReadStream();
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
	downloadFileByPath({torrent, filePath, offset}) {
		log('download file by path::0', {offset});
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
			return this.downloadFile({torrent, file, from: offset});
		} else {
			// TODO: Зачем эта функциональность? Тут же стоит бросить исключение.
			return createEmptyReadableStream();
		}
	}

	destroy() {
		this._pies.forEach(it => it.destroy());
		this._pies.length = 0;

		this._swarm.destroy();
	}
};
