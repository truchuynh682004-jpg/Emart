const express = require("express");

const router = express.Router();

const productController = require("../controllers/ProductController");

router.get("/", productController.getAll);
router.get("/deleted", productController.getDeleted);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.put("/:id/fefo-discount", productController.applyFefoDiscount);
router.put("/:id/fefo-restore", productController.restoreFefoPrice);
router.delete("/:id", productController.remove);
router.put("/:id/restore", productController.restore);

module.exports = router;