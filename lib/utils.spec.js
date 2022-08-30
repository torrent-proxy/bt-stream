const {slicePieces} = require('./utils');


describe('utils', () => {
	describe('slicePieces', () => {
		it('Should return correct structure', () => {
			const pieces = new Array(10).fill(``).map((it, i) => String(i));
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 0,
					length: 10,
				},
				from: 0,
				to: 10,
			});

			expect(typeof result.firstOffset).toEqual(`number`);
			expect(typeof result.lastLength).toEqual(`number`);
			expect(result.pieces instanceof Array).toBeTruthy();
		});

		it('Should return correct result::Example 1::with out any offset', () => {
			const pieces = new Array(10).fill(``).map((it, i) => String(i));
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 0,
					length: 10,
				},
				from: 0,
				to: 10,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: pieces.slice(),
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 2::with file offset', () => {
			const pieces = new Array(10).fill(``).map((it, i) => String(i));
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 1,
					length: 9, // 10 - 1 : piecesLength - offset
				},
				from: 0,
				to: 9,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: pieces.slice(1),
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 3::with file offset and not full', () => {
			const pieces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 1,
					length: 8, // 10 - 1 : piecesLength - offset
				},
				from: 0,
				to: 8,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: ['1', '2', '3', '4', '5', '6', '7', '8'],
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 4::with file offset and not zero from', () => {
			const pieces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 2,
					length: 7, // 10 - 1 : piecesLength - offset
				},
				from: 1,
				to: 7,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: ['3', '4', '5', '6', '7', '8'],
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 5::with file offset and not zero from', () => {
			const pieces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
			const result = slicePieces({
				pieces,
				pieceSize: 1,
				file: {
					offset: 2,
					length: 6, // 10 - 1 : piecesLength - offset
				},
				from: 1,
				to: 6,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: ['3', '4', '5', '6', '7'],
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 6::with file offset and not zero from', () => {
			const pieces = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
			const result = slicePieces({
				pieces,
				pieceSize: 2,
				file: {
					offset: 2,
					length: 12, // 10 - 1 : piecesLength - offset
				},
				from: 1,
				to: 12,
			});

			const output = {
				firstOffset: 1,
				lastLength: 2,
				pieces: ['11', '22', '33', '44', '55', '66'],
			};

			expect(result).toMatchObject(output);
		});


		it('Should return correct result::Example 7::with file offset and not zero from', () => {
			const pieces = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
			const result = slicePieces({
				pieces,
				pieceSize: 2,
				file: {
					offset: 2,
					length: 11, // 10 - 1 : piecesLength - offset
				},
				from: 1,
				to: 11,
			});

			const output = {
				firstOffset: 1,
				lastLength: 1,
				pieces: ['11', '22', '33', '44', '55', '66'],
			};

			expect(result).toMatchObject(output);
		});

		it('Should return correct result::Example 8::with file offset and not zero from', () => {
			const pieces = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
			const result = slicePieces({
				pieces,
				pieceSize: 3,
				file: {
					offset: 2,
					length: 11, // 10 - 1 : piecesLength - offset
				},
				from: 1,
				to: 11,
			});

			const output = {
				firstOffset: 0,
				lastLength: 1,
				pieces: ['111', '222', '333', '444'],
			};

			expect(result).toMatchObject(output);
		});

		describe('Check arg [to]', () => {
			it('Should return correct result::Example 3::with file offset and not full', () => {
				const pieces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
				const result = slicePieces({
					pieces,
					pieceSize: 1,
					file: {
						offset: 1,
						length: 8, // 10 - 1 : piecesLength - offset
					},
					from: 0,
					to: 7,
				});

				const output = {
					firstOffset: 0,
					lastLength: 1,
					pieces: ['1', '2', '3', '4', '5', '6', '7'],
				};

				expect(result).toMatchObject(output);
			});

			it('Should return correct result::Example 8::with file offset and not zero from', () => {
				const pieces = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
				const result = slicePieces({
					pieces,
					pieceSize: 3,
					file: {
						offset: 2,
						length: 11, // 10 - 1 : piecesLength - offset
					},
					from: 1,
					to: 7,
				});

				const output = {
					firstOffset: 0,
					lastLength: 3,
					pieces: ['111', '222'],
				};

				expect(result).toMatchObject(output);
			});
		});
	});
});
