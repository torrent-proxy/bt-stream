const log = require('./logger')('Module');

describe(`logger`, () => {
	it('Should implement interface', () => {
		expect(typeof log).toEqual('function');
		expect(typeof log.debug).toEqual('function');
		expect(typeof log.error).toEqual('function');
		expect(typeof log.info).toEqual('function');
		expect(typeof log.warn).toEqual('function');
		expect(typeof log.setPrefix).toEqual('function');

		// Inside module
		// log('Message'); // Module:: Message
		// log.info('Message'); // INFO: Module:: Message
		// log.warn('Message'); // WARN: Module:: Message
		// log.debug('Message'); // DEBUG: Module:: Message
		// log.error('Message'); // ERROR: Module:: Message

		// Inside module with param
		// log.setPrefix(() => {
		// 	return `ID::${this.id}`;
		// });
		// log('Message'); // Module:: ID: 42: Message
		// log.info('Message'); // INFO: ID::42: Module:: Message
		// log.warn('Message'); // WARN: ID::42: Module:: Message
		// log.debug('Message'); // DEBUG: ID::42: Module:: Message
		// log.error('Message'); // ERROR: ID::42: Module:: Message
	});
});
