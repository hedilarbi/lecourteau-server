
const MenuItem = require ('../models/MenuItem')

const createMenuItem = async (req,res) =>{
    const { name,
        image,
        prices,
        description,
        components,
        customization} = req.body
      try{
        const newMenuItem = new MenuItem({
            name,
            image,
            prices,
            description,
            components,
            customization
        })
        const response = await newMenuItem.save()
        res.status(200).json(response)
      }  catch(err){
        res.status(500).json({success: false, error:err.message})
      }
}


const updateMenuItem = async(req,res) =>{
    const {  name,
        image,
        prices,
        description,
        components,
        customization} = req.body
    const {id} = req.params
    try{
        const response = MenuItem.findByIdAndUpdate(id,{ name,
            image,
            prices,
            description,
            components,
            customization},{new:true})
        res.status(202).json(response)    
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }

}

const getMenuItems = async (req,res) => {
    try{
        const response = await MenuItem.find()
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
}


const getMenuItem = async (req,res) => {
    const{id} = req.params
    try{
        const response = await MenuItem.findById(id)
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
}

const deleteMenuItem = async (req,res) =>{
    const {id} = req.params
try{
    const response = await MenuItem.findById(id)
    res.status(200).json(response)
}catch(err){
    res.status(500).json({success: false, error:err.message})
}
}

module.exports = {createMenuItem,updateMenuItem,getMenuItem,getMenuItems,deleteMenuItem}