const express = require("express");
const {
  createVedette,
  getVedettes,
  deleteVedette,
  triVedettes,
} = require("../controllers/vedette");
const router = express.Router();

router.post("/", createVedette);
router.get("/", getVedettes);
router.delete("/:id", deleteVedette);
router.put("/tri", triVedettes);

module.exports = router;
