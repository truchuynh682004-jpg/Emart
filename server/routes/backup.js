
const express = require("express");
const router = express.Router();

const {
    getBackupList,
    createBackup,
    verifyBackup,
    restoreBackup
} = require("../controllers/BackupController");

// Lấy danh sách bản Backup
router.get("/", getBackupList);

// Tạo bản Backup mới
router.post("/create", createBackup);

// Kiểm tra tính hợp lệ của bản Backup
router.post("/verify", verifyBackup);

// Khôi phục database từ file Backup
router.post("/restore", restoreBackup);

module.exports = router;
