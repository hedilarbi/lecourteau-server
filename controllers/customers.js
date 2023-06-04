const Customer = require('../models/Customer')


const createCustomer = async(req,res) => {
    const {phone_number} = req.body
    try {
        const verifyPhone = await Customer.findOne({ phone_number });
        if (verifyPhone) {
          return res
            .status(403)
            .json({ message: "Un compte existe déja avec ce numéro" });
        }
        const newCustomer = new Customer({
            phone_number,
            createdAt:new Date().toISOString()
        })
        const response = await newCustomer.save()
        res.status(200).json(response)
      } catch (err) {
        res.status(500).json({success: false, error:err.message})
      }
}


const updateCustomer = async (req,res) => {
    const {phone_number,email,profile_img,name} = req.body
    const {id} = req.params
    try{
        const response = await Customer.findByIdAndUpdate(id,{phone_number,email,profile_img,name},{new:true})
        res.status(200).json(response)
    }catch (err) {
        res.status(500).json({success: false, error:err.message})
      }
}


const deleteCustomer = async (req,res) => {
    const {id} = req.params
    try{
        await Customer.findByIdAndDelete(id)
        res.status(200).json({success:true})
    }catch (err) {
        res.status(500).json({success: false, error:err.message})
      }
}


const getCustomers = async (req,res) => {
    try{
        const response = await Customer.find()
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
}


const getCustomer = async(req,res) => {
    const {id} = req.params
    try{
        const response = await Customer.findById(id)
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
}



module.exports = {createCustomer,updateCustomer,deleteCustomer,getCustomer,getCustomers}