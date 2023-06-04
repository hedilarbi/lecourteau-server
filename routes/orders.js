const express = require("express");
const {createOrder,getOrders,getOrder} = require('../controllers/orders')
const router = express.Router();


router.get('/',getOrders)
router.post('/create',createOrder)
router.get('/:id',getOrder)


module.exports = router;