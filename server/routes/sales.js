
const express = require("express");
const router = express.Router();
const salesController = require("../controllers/SalesController");

router.post("/checkout", salesController.checkout);
router.get("/invoices", salesController.getAllInvoices);
router.get("/invoices/:id", salesController.getInvoiceDetails);

module.exports = router;
