
const express = require("express");
const router = express.Router();

const customerController = require("../controllers/CustomerController");

router.get("/", customerController.getAll);
router.get("/:id", customerController.getById);
router.post("/", customerController.create);
router.put("/:id", customerController.update);
router.delete("/:id", customerController.remove);

module.exports = router;
