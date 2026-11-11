
const sql = require("mssql");
require("dotenv").config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT || 1433),
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

let poolPromise;

async function connectDB() {
    try {
        if (poolPromise) {
            return await poolPromise;
        }

        poolPromise = sql.connect(config);

        const pool = await poolPromise;

        console.log("====================================");
        console.log("Kết nối SQL Server thành công!");
        console.log("Database:", config.database);
        console.log("Server:", config.server);
        console.log("====================================");

        return pool;

    } catch (err) {
        poolPromise = null;

        console.error("===== SQL SERVER ERROR =====");
        console.error("Name:", err.name);
        console.error("Code:", err.code);
        console.error("Message:", err.message);
        console.error("============================");

        throw err;
    }
}

module.exports = {
    sql,
    connectDB
};
