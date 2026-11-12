const express = require("express");
const router = express.Router();

const authController = require("../controllers/AuthController");

router.post("/login", authController.login);

// API đổi mật khẩu
router.post("/change-password", authController.changePassword);

// API cập nhật thông tin chủ cửa hàng
router.put("/update-owner-profile", authController.updateOwnerProfile);

module.exports = router;