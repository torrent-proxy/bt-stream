const http = require('http');
const BTStream = require('./lib/bt-stream');
const fs = require('fs');



// const server = http.createServer();

// server.on('request', (req, res, next) => {
	const torrentHash = '4309ff009fb1648b2d1e9f67f240bd0dcfe3b0fc';//require('url').parse(req.url, true).query.hash;
	console.log('req hash=', torrentHash);

	const btStream = new BTStream(torrentHash);

	btStream.getMetaData()
		.then((torrent) => {
			console.log('Metadata downloaded:');
			console.log('Files:', torrent.files);
			console.log('Pieces count:', torrent.pieces.length);
			console.log('Piece length:', torrent.pieceLength);
			console.log('hash=', torrent.infoHash);

			const file = torrent.files;
			const rs = btStream.downloadTorrent(torrent);

			// res.statusCode = 200;
			// res.setHeader('Content-Type', 'application/octet-stream');
			// res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
			// res.setHeader('Content-Length', file.length);

			const fsWriteStream = fs.WriteStream('/tmp/123');
			rs.pipe(fsWriteStream);
			rs.on('error', (err) => console.error('err', err));
			rs.on('data', () => ({}))
			// setInterval(() => console.log('rs', rs), 5000);
		});
// });

// server.on('error', console.error);
//
// server.listen(9191);


