
const fs = require("fs");
const path = require("path");
const { sql, connectDB } = require("../database/connection");

// Node.js container sees the shared host folder at /backup.
// SQL Server container sees the same folder at /var/opt/mssql/backup.
const BACKUP_ROOT =
    process.env.BACKUP_ROOT || path.join(process.cwd(), "backup");

const BACKUP_FULL_DIR = path.join(BACKUP_ROOT, "Full");

const BACKUP_SQL_ROOT =
    process.env.BACKUP_SQL_ROOT || BACKUP_ROOT;

const BACKUP_SQL_FULL_DIR = path.posix.join(
    BACKUP_SQL_ROOT.replace(/\\/g, "/"),
    "Full"
);

const TARGET_DATABASE = "StorePOS";
const TARGET_DATA_FILE_PATH = "/var/opt/mssql/data/StorePOS.mdf";
const TARGET_LOG_FILE_PATH = "/var/opt/mssql/data/StorePOS_log.ldf";

// Kiểm tra thư mục Backup
function checkBackupDirectory() {
    if (!fs.existsSync(BACKUP_ROOT)) {
        throw new Error(
            `Không tìm thấy thư mục Backup: ${BACKUP_ROOT}`
        );
    }

    if (!fs.existsSync(BACKUP_FULL_DIR)) {
        fs.mkdirSync(BACKUP_FULL_DIR, { recursive: true });
    }

    try {
        fs.accessSync(
            BACKUP_FULL_DIR,
            fs.constants.R_OK | fs.constants.W_OK
        );
    } catch (error) {
        throw new Error(
            "Ứng dụng không có quyền đọc hoặc ghi thư mục Backup."
        );
    }
}

// Kiểm tra tên file Backup
function isValidBackupFileName(fileName) {
    return (
        typeof fileName === "string" &&
        /^[a-zA-Z0-9_-]+\.bak$/i.test(fileName) &&
        path.basename(fileName) === fileName
    );
}

// Chuyển đường dẫn thành chuỗi SQL an toàn
function sqlString(value) {
    return String(value).replace(/'/g, "''");
}

// Tạo timestamp
function makeTimestamp() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

// Tạo đường dẫn mà SQL Server container nhìn thấy
function getSqlBackupPath(fileName) {
    return path.posix.join(
        BACKUP_SQL_FULL_DIR,
        fileName
    );
}

// Lấy danh sách bản Backup
async function getBackupList(req, res) {
    try {
        checkBackupDirectory();

        const files = fs.readdirSync(BACKUP_FULL_DIR, {
            withFileTypes: true
        })
            .filter(entry =>
                entry.isFile() &&
                entry.name.toLowerCase().endsWith(".bak")
            )
            .map(entry => {
                const fullPath = path.join(
                    BACKUP_FULL_DIR,
                    entry.name
                );

                const stat = fs.statSync(fullPath);

                return {
                    fileName: entry.name,
                    size: stat.size,
                    createdAt: stat.mtime
                };
            })
            .sort((a, b) =>
                b.createdAt - a.createdAt
            );

        return res.json({
            success: true,
            data: files
        });

    } catch (error) {
        console.error("Lỗi lấy danh sách Backup:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Tạo bản Backup mới
async function createBackup(req, res) {
    try {
        checkBackupDirectory();

        const pool = await connectDB();

        if (!pool) {
            throw new Error(
                "Không thể kết nối SQL Server."
            );
        }

        const fileName =
            `StorePOS_${makeTimestamp()}.bak`;

        const appFilePath = path.join(
            BACKUP_FULL_DIR,
            fileName
        );

        const sqlFilePath =
            getSqlBackupPath(fileName);

        await pool.request().query(`
            BACKUP DATABASE [${TARGET_DATABASE}]
            TO DISK = N'${sqlString(sqlFilePath)}'
            WITH CHECKSUM, INIT, STATS = 10;
        `);

        // Kiểm tra file Backup có xuất hiện trong thư mục dùng chung không
        if (!fs.existsSync(appFilePath)) {
            throw new Error(
                "SQL Server báo Backup thành công nhưng ứng dụng không nhìn thấy file. Hãy kiểm tra Docker volume và quyền ghi."
            );
        }

        return res.json({
            success: true,
            message: "Backup database thành công.",
            data: {
                fileName,
                filePath: appFilePath,
                size: fs.statSync(appFilePath).size
            }
        });

    } catch (error) {
        console.error("Lỗi Backup:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Kiểm tra tính hợp lệ của bản Backup
async function verifyBackup(req, res) {
    try {
        checkBackupDirectory();

        const { fileName } = req.body || {};

        if (!isValidBackupFileName(fileName)) {
            return res.status(400).json({
                success: false,
                message: "Tên file Backup không hợp lệ."
            });
        }

        const appFilePath = path.join(
            BACKUP_FULL_DIR,
            fileName
        );

        if (!fs.existsSync(appFilePath)) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy file Backup."
            });
        }

        const pool = await connectDB();

        const sqlFilePath =
            getSqlBackupPath(fileName);

        await pool.request().query(`
            RESTORE VERIFYONLY
            FROM DISK = N'${sqlString(sqlFilePath)}'
            WITH CHECKSUM;
        `);

        return res.json({
            success: true,
            message: "File Backup hợp lệ."
        });

    } catch (error) {
        console.error("Lỗi kiểm tra Backup:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Khôi phục database từ file Backup
async function restoreBackup(req, res) {
    let masterPool = null;
    let databaseSetSingleUser = false;
    let restoreCompleted = false;
    let safetyBackupFileName = null;

    try {
        checkBackupDirectory();

        const {
            fileName,
            confirmRestore
        } = req.body || {};

        // Khóa chức năng khôi phục database thật
        if (
            process.env.ENABLE_PRODUCTION_RESTORE !== "true"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Chức năng khôi phục database thật hiện đang bị khóa."
            });
        }

        if (confirmRestore !== true) {
            return res.status(400).json({
                success: false,
                message:
                    "Bạn chưa xác nhận khôi phục dữ liệu."
            });
        }

        if (!isValidBackupFileName(fileName)) {
            return res.status(400).json({
                success: false,
                message: "Tên file Backup không hợp lệ."
            });
        }

        const appFilePath = path.join(
            BACKUP_FULL_DIR,
            fileName
        );

        if (!fs.existsSync(appFilePath)) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy file Backup."
            });
        }

        const sqlFilePath =
            getSqlBackupPath(fileName);

        // Kết nối riêng vào database master
        const masterConfig = {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            port: Number(process.env.DB_PORT || 1433),
            database: "master",

            options: {
                encrypt: false,
                trustServerCertificate: true
            },

            connectionTimeout: 15000,
            requestTimeout: 0
        };

        masterPool =
            await new sql.ConnectionPool(
                masterConfig
            ).connect();

        // Kiểm tra tính hợp lệ của file Backup
        await masterPool.request().query(`
            RESTORE VERIFYONLY
            FROM DISK = N'${sqlString(sqlFilePath)}'
            WITH CHECKSUM;
        `);

        // Đọc cấu trúc file Backup
        const fileListResult =
            await masterPool.request().query(`
                RESTORE FILELISTONLY
                FROM DISK = N'${sqlString(sqlFilePath)}';
            `);

        const backupFiles =
            fileListResult.recordset || [];

        const dataFile = backupFiles.find(
            file => file.Type === "D"
        );

        const logFile = backupFiles.find(
            file => file.Type === "L"
        );

        if (!dataFile || !logFile) {
            throw new Error(
                "File Backup không chứa đủ file dữ liệu và file nhật ký."
            );
        }

        // Tạo bản Backup dự phòng trước khi khôi phục
        safetyBackupFileName =
            `StorePOS_BeforeRestore_${makeTimestamp()}.bak`;

        const safetySqlPath =
            getSqlBackupPath(safetyBackupFileName);

        await masterPool.request().query(`
            BACKUP DATABASE [${TARGET_DATABASE}]
            TO DISK = N'${sqlString(safetySqlPath)}'
            WITH CHECKSUM, INIT, STATS = 10;
        `);

        // Kiểm tra bản Backup dự phòng
        await masterPool.request().query(`
            RESTORE VERIFYONLY
            FROM DISK = N'${sqlString(safetySqlPath)}'
            WITH CHECKSUM;
        `);

        // Chuyển database sang SINGLE_USER
        await masterPool.request().query(`
            ALTER DATABASE [${TARGET_DATABASE}]
            SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        `);

        databaseSetSingleUser = true;

        // Khôi phục dữ liệu vào database StorePOS
        await masterPool.request().query(`
            RESTORE DATABASE [${TARGET_DATABASE}]
            FROM DISK = N'${sqlString(sqlFilePath)}'
            WITH
                REPLACE,
                RECOVERY,
                CHECKSUM,
                MOVE N'${sqlString(dataFile.LogicalName)}'
                    TO N'${sqlString(TARGET_DATA_FILE_PATH)}',
                MOVE N'${sqlString(logFile.LogicalName)}'
                    TO N'${sqlString(TARGET_LOG_FILE_PATH)}',
                STATS = 10;
        `);

        restoreCompleted = true;

        // Đưa database về MULTI_USER
        await masterPool.request().query(`
            ALTER DATABASE [${TARGET_DATABASE}]
            SET MULTI_USER;
        `);

        databaseSetSingleUser = false;

        return res.json({
            success: true,
            message:
                "Khôi phục database StorePOS thành công.",
            data: {
                fileName,
                safetyBackupFileName,
                database: TARGET_DATABASE
            }
        });

    } catch (error) {
        console.error("Lỗi Restore:", error);

        // Nếu có lỗi, cố gắng đưa database về MULTI_USER
        if (databaseSetSingleUser && masterPool) {
            try {
                await masterPool.request().query(`
                    ALTER DATABASE [${TARGET_DATABASE}]
                    SET MULTI_USER;
                `);

                databaseSetSingleUser = false;

            } catch (restoreModeError) {
                console.error(
                    "Không thể chuyển database về MULTI_USER:",
                    restoreModeError
                );
            }
        }

        return res.status(500).json({
            success: false,
            message: restoreCompleted
                ? "Database StorePOS đã được khôi phục nhưng có lỗi khi hoàn tất cấu hình. Vui lòng kiểm tra SQL Server."
                : error.message
        });

    } finally {
        if (masterPool) {
            try {
                await masterPool.close();
            } catch (error) {
                console.error(
                    "Lỗi đóng kết nối master:",
                    error
                );
            }
        }
    }
}

module.exports = {
    getBackupList,
    createBackup,
    verifyBackup,
    restoreBackup
};
