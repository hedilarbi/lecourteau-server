const express = require("express");
const {createMenuItem,updateMenuItem,getMenuItem,getMenuItems,deleteMenuItem} = require('../controllers/menuItems')
const router = express.Router();


router.get('/',getMenuItems)
router.post('/create',createMenuItem)
router.put('/update/:id',updateMenuItem)
router.delete('/delete/:id',deleteMenuItem)
router.get('/:id',getMenuItem)



module.exports = router;