const slicePieces = ({pieces, pieceSize, file, from}) => {
	const offset = file.offset + from;
	const length = file.length - from;
	const offsetPieces = Math.floor(offset / pieceSize);

	const _pieces = pieces.slice(offsetPieces, Math.ceil((length + offset) / pieceSize));
	const firstOffset = offset % pieceSize;
	const lastLength = (length + firstOffset) % pieceSize || pieceSize;

	return {
		pieces: _pieces,
		firstOffset,
		lastLength
	};
};

module.exports = {
	slicePieces,
};
