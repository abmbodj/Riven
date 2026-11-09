const { AsyncLocalStorage } = require('node:async_hooks');

const context = new AsyncLocalStorage();

function runWithWorkerContext(value, callback) {
    return context.run(value, callback);
}

function currentWorkerContext() {
    return context.getStore();
}

module.exports = { runWithWorkerContext, currentWorkerContext };
