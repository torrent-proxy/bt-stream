const exchangeMetadata = require('./lib/exchange-metadata');
const peerWireSwarm = require('peer-wire-swarm');
const hat = require('hat');
const bncode = require('bncode');
const parseTorrent = require('parse-torrent');
const DHT = require('bittorrent-dht');
const Bitfield = require('bitfield');
const crypto = require('crypto');
const http = require('http');


const ID = '-FRIDGE-' + hat(48);
const DEFAULT_PORT = 6881;

function statePromise(promise) {
	// Don't modify any promise that has been already modified.
	if (promise.isResolved) return promise;

	// Set initial state
	var isPending = true;
	var isRejected = false;
	var isFulfilled = false;

	// Observe the promise, saving the fulfillment in a closure scope.
	var result = promise.then(
		function (v) {
			isFulfilled = true;
			isPending = false;
			return v;
		},
		function (e) {
			isRejected = true;
			isPending = false;
			throw e;
		}
	);

	result.isFulfilled = function () {
		return isFulfilled;
	};
	result.isPending = function () {
		return isPending;
	};
	result.isRejected = function () {
		return isRejected;
	};
	return result;
}

function getMetadata(hash) {
	const deferred = (() => {
		let resolver = null;

		const promise = new Promise((resolve, reject) => {
			resolver = resolve;
		});

		return {resolver, promise};
	})();

	const exchange = exchangeMetadata({
		infoHash: hash
	}, (metadata) => {
		const buf = bncode.encode({
			info: bncode.decode(metadata),
			'announce-list': []
		});

		const torrent = parseTorrent(buf);
		deferred.resolver(torrent);
	});

	const dht = new DHT();
	const swarm = peerWireSwarm(hash, ID, {size: 100, speed: 10});

	const onSwarmWire = (wire) => {
		exchange(wire);
	};

	const onDHTPeer = (peer, infoHash, from) => {
		swarm.add(peer.host + ':' + peer.port);
	};

	swarm.on('wire', onSwarmWire);
	dht.on('peer', onDHTPeer);

	dht.listen(DEFAULT_PORT, () => {
		console.log('DHT start listening on port.');
	});
	swarm.listen(DEFAULT_PORT);

	dht.lookup(hash);

	return deferred.promise
		.then((torrent) => {
			swarm.destroy();
			dht.destroy();

			return torrent;
		});
}


function sha1(data) {
	return crypto.createHash('sha1').update(data).digest('hex');
}

const MAX_REQUESTS = 10;
const CHUNK_SIZE = 16384;

function downloadTorrent(torrent, rs) {
	const bitfield = new Bitfield(torrent.pieces.length);
	const hash = torrent.infoHash;
	const dht = new DHT();
	const swarm = peerWireSwarm(hash, ID, {size: 100, speed: 10});

	const onPeer = (peer, infoHash, from) => {
		swarm.add(peer.host + ':' + peer.port);
	};

	let piece = Buffer.alloc(torrent.pieceLength);
	let requests = [];
	let interestedPieceIndex = 0;
	let waitPiece = null;

	dht.on('peer', onPeer);

	swarm.on('wire', (wire) => {
		wire.port(DEFAULT_PORT);
		wire.bitfield(bitfield);

		wire.on('unchoke', () => {
			const interestedPieces = [interestedPieceIndex];
			const haveInterested = interestedPieces.every((index) => wire.peerPieces[index]);

			if (haveInterested) {
				wire.interested();
			}

			if (wire.amInterested === true && wire.peerChoking === false) {

				(function requestBlock() {
					const offset = requests.length * CHUNK_SIZE;
					if (offset < torrent.pieceLength) {

						const pendingRequest = statePromise(new Promise((resolve, reject) => {
							const length = offset + CHUNK_SIZE < torrent.pieceLength ? CHUNK_SIZE : torrent.pieceLength - offset;

							const req = (function request(w, i, offset, length, tryCount) {
								return new Promise((resolve, reject) => {
									w.request(i, offset, length, (err, block) => {
										if (err) {
											swarm.remove(w.peerAddress);

											const nextWire = swarm.wires[tryCount];

											if (nextWire) {
												request(w, i, offset, length, tryCount).then(resolve, reject);
											} else {
												reject();
											}
										} else {
											block.copy(piece, offset, 0, length);
											resolve();
										}
									});
								});
							})(wire, interestedPieceIndex, offset, length, 0);

							req.then(resolve, reject);
						}));

						requests.push(pendingRequest);

						pendingRequest.then(() => {
							const chunksCount = Math.ceil(torrent.pieceLength / CHUNK_SIZE);
							const done = requests.filter((req) => req.isFulfilled()).length;
							const percent = (done * 100) / chunksCount;

							//console.log(percent + '% [' + interestedPieceIndex + 1 + '/' + torrent.pieces.length + ']');

							requestBlock();
						});

						if (wire.peerChoking === false && wire.requests.length < MAX_REQUESTS) {
							requestBlock();
						}
					} else {
						if (!waitPiece) {
							waitPiece = Promise.all(requests);

							waitPiece.then(() => {
								const pieceHash = sha1(piece);
								console.log(pieceHash);
								console.log(torrent.pieces[interestedPieceIndex]);
								console.log('verify:', pieceHash === torrent.pieces[interestedPieceIndex]);
								console.log(interestedPieceIndex + 1 + '/' + torrent.pieces.length);

								if (interestedPieceIndex === torrent.pieces.length - 1) {
									rs.end(piece);
								} else {
									rs.write(piece);
									requests = [];
									waitPiece = null;
									interestedPieceIndex += 1;
									requestBlock();
								}
							});
						}
					}
				})();
			}
		});
	});

	dht.listen(DEFAULT_PORT);
	swarm.listen(DEFAULT_PORT);

	dht.lookup(hash);
}

const server = http.createServer();

server.on('request', (req, res, next) => {
	const rs = new require('stream').PassThrough();
	const torrentHash = require('url').parse(req.url, true).query.hash;
	console.log('req hash=', torrentHash);

	getMetadata(torrentHash)
		.then((torrent) => {
			console.log('Metadata downloaded:');
			console.log('Files:', torrent.files);
			console.log('Pieces count:', torrent.pieces.length);
			console.log('Piece length:', torrent.pieceLength);
			console.log('hash=', torrent.infoHash);

			const file = torrent.files;
			downloadTorrent(torrent, rs);

			res.statusCode = 200;

			res.setHeader('Content-Type', 'application/octet-stream');
			res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
			res.setHeader('Content-Length', file.length);

			rs.pipe(res);
		});
});

server.on('error', console.error);

server.listen(9191);
