const {Readable} = require('stream');
const Pie = require('./pie');
const {slicePieces} = require('./utils');

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
	 * @param torrent
	 * @return {PassThrough}
	 */
	downloadTorrent({torrent}) {
		const bytesOffset = 0;
		const firstOffset = 0;
		const {pieces, pieceLength: pieceSize} = torrent;
		const lastLength = pieceSize;

		this._pie = new Pie({swarm: this._swarm, pieces, pieceSize, bytesOffset, firstOffset, lastLength});

		return this._pie.getReadStream();
	}

	downloadFile({torrent, file, from}) {
		const torrentHash = torrent.infoHash;
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;

		const result = slicePieces({pieces, pieceSize, file, from});
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		const bytesOffset = file.offset;

		// TODO: создание pie происходит в двух местах. Сократить до одного.
		this._pie = new Pie({swarm: this._swarm, pieces: targetPieces, pieceSize, torrentHash, bytesOffset, firstOffset, lastLength});

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

	downloadFileByPath({torrent, filePath, offset}) {
		console.log('download file by path::0', {offset});
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
			return this.downloadFile({torrent, file, from: offset});
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
