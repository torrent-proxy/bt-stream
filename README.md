# bt-stream
BitTorrent read-stream implementation without writing to storage

Example

```javascript
const BTStream = require('bt-stream');
const fs = require('fs');

const DHT_PORT = 8080;
const HASH = '4309ff009fb1648b2d1e9f67f240bd0dcfe3b0fc';//require('url').parse(req.url, true).query.hash;

const btStream = new BTStream({ dhtPort: DHT_PORT });
const torrent = await btStream.getMetaData(HASH);

console.log('Metadata downloaded:');
console.log('Files:', torrent.files);
console.log('Pieces count:', torrent.pieces.length);
console.log('Piece length:', torrent.pieceLength);
console.log('hash=', torrent.infoHash);

const readStream = await btStream.downloadTorrent(torrent);

const writeStream = fs.createWriteStream(FILE_PATH);
readStream.pipe(writeStream);
```