/**
 * @param {string[]} pieces Array of piece
 * @param {number} pieceSize Size one piece
 * @param {{offset: number, length: number}} file File in torrent
 * @param {number} from Offset for file
 * @returns {{pieces: string[], firstOffset: number, lastLength: number}}
 */
const slicePieces = ({pieces, pieceSize, file, from, to}) => {
	const offset = file.offset + from;
	const length = (to || file.length) - from;
	const offsetPieces = Math.floor(offset / pieceSize);

	const _pieces = pieces.slice(offsetPieces, Math.ceil((length + offset) / pieceSize));
	const firstOffset = offset % pieceSize;
	// TODO: Разобраться, нужно ли это (+1) или нет
	const lastLength = ((length + firstOffset) % pieceSize) + 1 || pieceSize;

	return {
		pieces: _pieces,
		firstOffset,
		lastLength
	};
};

module.exports = {
	slicePieces,
};
