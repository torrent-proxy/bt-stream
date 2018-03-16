module.exports = class PieceLoader {
	constructor({wires, chunkSize, pieceIndex, offset, length, s}) {
		this._swarm = s;
		this._wires = wires.map((wire) => ({wire, status: 0}));
		this._offset = offset;
		this._chunkSize = chunkSize;
		this._chunksCount = Math.ceil((length - offset) / chunkSize);
		this._pieceIndex = pieceIndex;
		this._requests = [];
		this._piece = {};
	}

	work() {
		const freePieces = this.getFreeChunksIndex();
		if (!freePieces.length) {
			return;
		}

		this._wires.forEach((wire, i) => {
			if (wire.status) {
				return;
			}

			// this._piece[i] = 1;
			return this._loadBlock(wire, this._offset + freePieces[i] * this._chunkSize, this._chunkSize, i)
				.then((block) => {
					this._piece[freePieces[i]] = block;
					console.log(this._chunkSize, 'finish', Object.keys(this._piece).length, 'from', this._chunksCount);
					this.work();
				})
				.catch((err) => {
					console.error(err);
					wire.wire.emit('error', err);
					this._wires = this._wires.filter((wire) => wire !== wire);
					this.work();
					return null;
				})
		});
	}

	addWires(wires) {
		this._wires = this._wires.concat(wires.map((wire) => ({wire, status: 0})));
		console.log('add wires', this._wires.length);
		this.work();
	}

	/**
	 * @return {number}
	 */
	getLoadedChunksCount() {
		return Object.keys(this._piece).length;
	}

	/**
	 * @return {Array<number>}
	 */
	getFreeChunksIndex() {
		const result = [];
		for (let i = 0; i < this._chunksCount; i++) {
			if (!this._piece[i]) {
				result.push(i);
			}
		}
		return result;
	}

	_loadBlock(wire, offset, length) {
		wire.status = 1;
		return new Promise((resolve, reject) => {
			setTimeout(() => reject('timeout'), 1000 * 3);
			wire.wire.request(this._pieceIndex, offset, length, (err, block) => {
				if (err) {
					console.error(err);
					wire.status = 0;
					reject(err);
				} else {
					wire.status = 0;
					resolve(block);
				}
			})
		});
	}

	// _loadPiece(wires, pieceIndex) {
	// 	console.log('load piece', 'done', this._donePieces, 'need', this._requests.length);
	// 	const offset = (this._donePieces + this._requests.length) * this._chunkSize;
	// 	let tryCount = 0;
	//
	// 	if (offset < this._chunksCount) {
	// 		const length = offset + this._chunkSize < this._chunksCount ?
	// 			this._chunkSize : this._chunksCount - offset;
	//
	// 		const interestedPieceIndex = this._interestedPieceIndex;
	// 		const request = this._loadBlock(wire, interestedPieceIndex, offset, length, 0)
	// 			.then((block) => {
	// 				this.addPieces(block, offset, length);
	// 				this._donePieces++;
	// 				this._requests = this._requests.filter((_request) => _request !== request);
	//
	// 				return {block, offset, length};
	// 			})
	// 			.catch((err) => {
	// 				tryCount++;
	// 				console.log('error1:', err);
	// 				this._swarm.remove(wire.peerAddress);
	//
	// 				const nextWire = this._swarm.wires[tryCount];
	//
	// 				if (nextWire) {
	// 					console.log('next wire');
	// 					return this._loadBlock(nextWire, interestedPieceIndex, offset, length);
	// 				} else {
	// 					throw err;
	// 				}
	// 			});
	//
	// 		this._requests.push(request);
	//
	// 		request.then(() => {
	// 			const chunksCount = Math.ceil(this._donePieces / this._chunkSize);
	// 			const done = this._donePieces;
	// 			const percent = done / chunksCount;
	//
	// 			console.log(percent + '% [' + this._interestedPieceIndex + 1 + '/' + this._torrent.pieces.length + ']');
	//
	// 			this._loadPiece(wire);
	// 		});
	//
	// 		if (wire.peerChoking === false && wire.requests.length < MAX_REQUESTS) {
	// 			this._loadPiece(wire);
	// 		}
	// 	} else {
	// 		if (!this._waitPiece) {
	// 			this._waitPiece = Promise.all(this._requests);
	//
	// 			this._waitPiece.then(() => {
	// 				const pieHash = this.sha1();
	//
	// 				{
	// 					console.log(pieHash);
	// 					console.log(this._torrent.pieces[this._interestedPieceIndex]);
	// 					console.log('verify:', pieHash === this._torrent.pieces[this._interestedPieceIndex]);
	// 					console.log(this._interestedPieceIndex + 1 + '/' + this._torrent.pieces.length);
	// 				}
	//
	// 				if (this._interestedPieceIndex === this._torrent.pieces.length - 1) {
	// 					this._rs.end(this.getPie());
	// 				} else {
	// 					this._rs.write(this.getPie());
	//
	// 					this._requests = [];
	// 					this._waitPiece = null;
	// 					this._interestedPieceIndex += 1;
	//
	// 					this._loadPiece(wire);
	// 				}
	// 			});
	// 		}
	// 	}
	// }
	//
	// _loadBlock(wire, interestedPieceIndex, offset, length) {
	// 	console.log('load chunk', interestedPieceIndex, offset, length);
	// 	return new Promise((resolve, reject) => {
	// 		wire.request(interestedPieceIndex, offset, length, (err, block) => {
	// 			if (err) {
	// 				reject(err);
	// 			} else {
	// 				resolve(block);
	// 			}
	// 		});
	// 	});
	// }

}
