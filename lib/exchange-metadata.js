const bncode = require('bncode');
const crypto = require('crypto');

const METADATA_BLOCK_SIZE = 1 << 14;
const METADATA_MAX_SIZE = 1 << 22;
const EXTENSIONS = {
	m: {
		ut_metadata: 1
	}
};

/**
 * @enum {number}
 */
const MSG_TYPE = {
	REQUEST: 0,
	DATA: 1,
	REJECT: 2
};

/**
 * @param {Buffer} data
 * @return {*}
 */
function sha1(data) {
	return crypto.createHash('sha1').update(data).digest('hex');
}

/**
 * @param {Object} wire
 * @return {Promise}
 */
function handleHandshake(wire) {
	return new Promise((resolve, reject) => {
		wire.once('extended', (id, data) => {
			let handshake = {};

			try {
				handshake = bncode.decode(data);
			} catch (err) {
				reject(err);
			}

			if (id || !handshake['m'] || handshake['m']['ut_metadata'] === undefined) {
				reject();
			}

			resolve(handshake);
		});
	});
}

/**
 * @param {Object} wire
 * @param {function(number, Buffer)} cb
 */
function handleExtended(wire, cb) {
	wire.on('extended', cb);
}

/**
 * @param {Buffer} data
 * @return {Promise}
 */
function parseExtendedMessage(data) {
	let delimiter = null;
	let message = null;

	try {
		delimiter = data.toString('ascii').indexOf('ee');
		let dataSlice = null;

		if (delimiter === -1) {
			dataSlice = data.slice(0, data.length);
		} else {
			dataSlice = data.slice(0, delimiter + 2);
		}

		message = bncode.decode(dataSlice);
	} catch (err) {
		return Promise.reject(err);
	}

	return Promise.resolve(message);
}

function handleRequest(wire, channel, metadata, message) {
	const piece = message.piece;

	if (!metadata) {
		wire.extended(channel, {
			msg_type: MSG_TYPE.REJECT,
			piece: piece
		});
	} else {
		const offset = piece * METADATA_BLOCK_SIZE;
		const metadataBuffer = metadata.slice(offset, offset + METADATA_BLOCK_SIZE);
		const dataMessageBuffer = bncode.encode({
			msg_type: MSG_TYPE.DATA,
			piece: piece
		});

		wire.extended(channel, Buffer.concat([dataMessageBuffer, metadataBuffer]));
	}
}

function handleReject() {
	console.log('extended message type REJECT');
}

function sendRequestsForPieces(wire, channel, pieceIndexes) {
	pieceIndexes.forEach((index) => {
		wire.extended(channel, {
			msg_type: MSG_TYPE.REQUEST,
			piece: index
		});
	});
}

function getUnhandledPieceIndexes(metadataPieces, size) {
	let pieces = [];

	for (let i = 0; i * METADATA_BLOCK_SIZE < size; i++) {
		if (!metadataPieces[i]) {
			pieces.push(i);
		}
	}

	return pieces;
}

module.exports = (engine, callback) => {
	let metadataPieces = [];

	return (wire) => {
		handleHandshake(wire)
			.then((handshakeData) => {
				const channel = handshakeData['m']['ut_metadata'];
				const size = handshakeData['metadata_size'];

				handleExtended(wire, (id, data) => {
					if (id !== EXTENSIONS.m.ut_metadata) {
						return;
					}

					let metadata = engine.metadata;

					parseExtendedMessage(data)
						.then((message) => {
							const piece = message.piece;

							if (piece < 0) {
								return false;
							}

							switch (message.msg_type) {
								case MSG_TYPE.REQUEST:
									handleRequest(wire, channel, metadata, message);
									break;
								case MSG_TYPE.DATA:
									const delimiter = data.toString('ascii').indexOf('ee');
									const pieceBuffer = data.slice(delimiter + 2);

									metadataPieces[piece] = pieceBuffer;

									const hasUnhandledPieces = getUnhandledPieceIndexes(metadataPieces, size).length !== 0;

									if (!metadata && !hasUnhandledPieces) {
										let metadata = Buffer.concat(metadataPieces);

										if (engine.infoHash.toLowerCase() === sha1(metadata)) {
											engine.metadata = metadata;

											return true;
										} else {
											metadataPieces = [];
											metadata = null;
										}
									}

									break;
								case MSG_TYPE.REJECT:
									handleReject();
									break;
							}

							return false;
						})
						.then((metadataUpdated) => {
							if (metadataUpdated) {
								callback(engine.metadata);
							}
						}, (err) => {
							console.error('handling message', err);
						});
				});

				const sizeGraterThanMax = size > METADATA_MAX_SIZE;

				if (sizeGraterThanMax || !size || metadata) {
					return;
				}

				sendRequestsForPieces(wire, channel, getUnhandledPieceIndexes(metadataPieces, size));
			}, (err) => {
				console.error('handshake err', err);
			});

		const metadata = engine.metadata;

		if (!wire.peerExtensions.extended) {
			return;
		}

		if (metadata) {
			wire.extended(0, {
				m: {
					ut_metadata: 1
				},
				metadata_size: metadata.length
			});
		} else {
			wire.extended(0, {
				m: {
					ut_metadata: 1
				}
			});
		}
	}
};
