const {Readable} = require('stream');
const Pie = require('./pie');
const {slicePieces} = require('./utils');
const log = require('./logger')('BTStream');

const createEmptyReadableStream = () => {
	const stream = new Readable();
	stream._read = () => null;
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
		const pieces = torrent.pieces;
		const pieceSize = torrent.pieceLength;


		const result = slicePieces({pieces, pieceSize, file, from, to});
		// TODO: lastLength какой-то некорректный.
		// Нужно вообще его переосмыслить, потому что дальше должен передаваться реальный последний кусок, а не тот, который мы отрезаем.
		// Возможно нужно взять из прошлой реализации
		const {firstOffset, lastLength, pieces: targetPieces} = result;

		const {length, pieceLength, lastPieceLength} = torrent;
		log('download file::', 'torrent', {length, pieceLength, lastPieceLength});
		log('download file::', `result`, {firstOffset, lastLength});

		const bytesOffset = file.offset;
		const pieceOffset = pieces.indexOf(targetPieces[0]) + Math.floor(bytesOffset / pieceSize);

		// TODO: создание pie происходит в двух местах. Сократить до одного.
		this._pie = new Pie({
			swarm: this._swarm, pieces: targetPieces, pieceSize, pieceOffset, firstOffset, lastLength
		}, {from: firstOffset, to: lastLength});

		return this._pie.getReadStream();
	}

	downloadFileByName({torrent, filename, from, to}) {
		const file = torrent.files.find((file) => file.name === filename);

		if (file) {
				return this.downloadFile({torrent, file, from, to});
		} else {
			// TODO: Зачем эта функциональность? Тут же стоит бросить исключение.
			return createEmptyReadableStream();
		}
	}

	downloadFileByPath({torrent, filePath, from, to}) {
		console.log('download file by path::0', {from, to});
		const file = torrent.files.find((file) => file.path === filePath);

		if (file) {
			return this.downloadFile({torrent, file, from, to});
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
