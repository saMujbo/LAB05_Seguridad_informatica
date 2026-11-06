const { createChatServer } = require('../../server');
const { server, io } = createChatServer();
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.once('message', async () => {
  try {
    await new Promise(resolve => io.close(resolve));
    await require('../../telemetry').shutdown();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
