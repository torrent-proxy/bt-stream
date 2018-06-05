# bt-stream
BitTorrent read-stream implementation without writing to storage

Example

```javascript
const BTStream = require('bt-stream');
const fs = require('fs');

const torrentHash = '4309ff009fb1648b2d1e9f67f240bd0dcfe3b0fc';//require('url').parse(req.url, true).query.hash;
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

		const fsWriteStream = fs.WriteStream('/tmp/123');
		rs.pipe(fsWriteStream);
		rs.on('error', (err) => console.error('err', err));
		rs.on('data', () => ({}))
	});
```