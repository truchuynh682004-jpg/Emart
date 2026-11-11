const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/EmployeeController");

// Lấy danh sách nhân viên
router.get("/", employeeController.getAll);

// Xem chi tiết nhân viên
router.get("/:id", employeeController.getById);

// Thêm nhân viên
router.post("/", employeeController.create);

// Cập nhật thông tin nhân viên
router.put("/:id", employeeController.update);

// Khóa / mở tài khoản nhân viên
router.put("/:id/status", employeeController.updateStatus);

// Xóa nhân viên
router.delete("/:id", employeeController.remove);

module.exports = router;