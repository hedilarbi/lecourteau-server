const express = require("express");
const {createTopping,getToppings,deleteTopping,updateTopping,getTopping} = require('../controllers/toppings')
const router = express.Router();

router.get('/',getToppings)
router.post('/create',createTopping)
router.put('/update/:id',updateTopping)
router.delete('/delete/:id',deleteTopping)
router.get('/:id',getTopping)



module.exports = router;