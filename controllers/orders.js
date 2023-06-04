const Order = require ("../models/Order")


const createOrder = async (req,res) =>{
    const {customer_id,items,total_price} = req.body
    try {
        const newOrder = new Order({
            customer_id,items,total_price,createdAt: new Date().toISOString(),
        })
        const response = await newOrder.save();
        res.status(201).json(response);
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
}


const getOrders = async (req,res) => {
    try {
        const response = await Order.find()
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})

    }
}

const getOrder = async ( req,res) => {
    const {id} = req.params
    try {
        const response = await Order.findById(id)
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})

    }
}

module.exports = {createOrder,getOrders,getOrder}