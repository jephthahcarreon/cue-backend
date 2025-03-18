const sql = require("mssql");
const config = require("./config");

const connectionPool = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        return pool;
    })
    .catch(err => {
        throw(err);
    });

module.exports = {sql, connectionPool}