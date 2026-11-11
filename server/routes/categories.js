const express = require("express");

const router = express.Router();

const categoryController = require("../controllers/CategoryController");


// GET /api/categories
router.get("/", categoryController.getAll);


// POST /api/categories
router.post("/", categoryController.create);


// PUT /api/categories/:id
router.put("/:id", categoryController.update);


// DELETE /api/categories/:id
router.delete("/:id", categoryController.remove);


module.exports = router;