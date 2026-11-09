const { Pool } = require('pg');

function createWorkerPool(connectionString) {
    return new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
}

module.exports = { createWorkerPool };
