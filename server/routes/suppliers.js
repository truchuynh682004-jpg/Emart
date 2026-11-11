const express = require("express");

const router = express.Router();

const supplierController = require("../controllers/SupplierController");

router.get("/", supplierController.getAll);

router.post("/", supplierController.create);

router.put("/:id", supplierController.update);

router.delete("/:id", supplierController.remove);


module.exports = router;