const express = require("express");
const {createCustomer,updateCustomer,deleteCustomer,getCustomer,getCustomers} = require('../controllers/customers')
const router = express.Router();


router.get('/',getCustomers)
router.post('/create',createCustomer)
router.put('/update/:id',updateCustomer)
router.delete('/delete/:id',deleteCustomer)
router.get('/:id',getCustomer)


module.exports = router;