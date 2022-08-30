const crypto = require('crypto');

/**
 * @param piece
 * @returns {Buffer}
 */
const createBuffer = (piece) => {
	const buffersPieces = Object
		.keys(piece)
		.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
		.map((key) => piece[key]);

	// const length = buffersPieces.reduce((acc, cur) => {
	// 	// console.log('cur.length', cur.length)
	// 	return acc + cur.length;
	// }, 0);

	// console.log('size', size);
	// console.log('length', length);
	// console.log('length::after', length - buffersPieces[buffersPieces.length - 1].length);

	return Buffer.concat(buffersPieces);
};

/**
 * @returns {string}
 */
const sha1 = (data) => {
	return crypto.createHash('sha1')
		.update(data)
		.digest('hex');
};


/**
 * @param buffer
 * @param referenceHash
 * @returns {boolean}
 */
const verifyPiece = (buffer, referenceHash) => {
	const pieceHash = sha1(buffer);
	return pieceHash === referenceHash;
};


module.exports = {
	createBuffer,
	verifyPiece,
};
