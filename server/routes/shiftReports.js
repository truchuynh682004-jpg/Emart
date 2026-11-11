const express = require("express");
const router = express.Router();

const shiftReportController = require("../controllers/ShiftReportController");

// Lấy danh sách báo cáo kết ca
router.get("/", shiftReportController.getAllShiftReports);

// Lấy chi tiết báo cáo
router.get("/:id", shiftReportController.getShiftReportById);

// Nhân viên gửi báo cáo kết ca
router.post("/", shiftReportController.createShiftReport);

// Chủ cửa hàng xác nhận hoặc từ chối
router.put("/:id/status", shiftReportController.updateShiftReportStatus);

module.exports = router;