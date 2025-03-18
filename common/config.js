require("dotenv").config();

const config = {
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    server: process.env.DATABASE_SERVER,
    database: process.env.DATABASE_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

module.exports = config;