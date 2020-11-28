const {createBTStream} = require('./bt-stream-factory');
const BTStream = require('./bt-stream');


const DHT_PORT = 8080;
const HASH = '52b278c6769eb2edb9773ff6fe0923598ff42fea';
// const HASH = '2dca8e028d7ff766162a9cbc2002ce8c6ca04555';
// const HASH = 'cb54c5f53e2b4bacdadb2d44293b9cae4df69790';


describe(`BTStreamFactory`, () => {
	it('createBTStream', () => {
		const btStream = createBTStream({dhtPort: DHT_PORT, hash: HASH});

		expect(btStream instanceof BTStream).toEqual(true);

		btStream.destroy();
	});
});
