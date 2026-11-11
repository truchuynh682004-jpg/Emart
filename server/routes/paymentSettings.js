
const express = require("express");
const router = express.Router();

const paymentSettingsController = require("../controllers/PaymentSettingsController");

router.get("/", paymentSettingsController.getPaymentSettings);
router.put("/", paymentSettingsController.savePaymentSettings);

module.exports = router;
