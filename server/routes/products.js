const express = require("express");

const router = express.Router();

const productController = require("../controllers/ProductController");
const upload = require("../middleware/uploadMiddleware");

router.get("/", productController.getAll);
router.get("/deleted", productController.getDeleted);
router.post("/", upload.single("image"), productController.create);
router.put("/:id", upload.single("image"), productController.update);
router.put("/:id/fefo-discount", productController.applyFefoDiscount);
router.put("/:id/fefo-restore", productController.restoreFefoPrice);
router.delete("/:id", productController.remove);
router.put("/:id/restore", productController.restore);

module.exports = router;