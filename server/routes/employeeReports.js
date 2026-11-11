
const express = require("express");
const router = express.Router();

const employeeReportController = require("../controllers/EmployeeReportController");

// Lấy danh sách báo cáo
router.get("/", employeeReportController.getAllReports);

// Xem chi tiết báo cáo
router.get("/:id", employeeReportController.getReportById);

// Nhân viên gửi báo cáo
router.post("/", employeeReportController.createReport);

// Duyệt hoặc từ chối báo cáo
router.put("/:id/status", employeeReportController.updateReportStatus);

module.exports = router;
