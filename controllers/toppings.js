const Topping = require('../models/Topping')


const createTopping = async (req, res) => {
    const { name, image,description,price } = req.body;
  
    try {
    
      const newTopping = new Topping({
        name,
        image,
        description,
        price
      });
      const response = await newTopping.save();
      res.status(201).json(response);
    } catch (err) {
        res.status(500).json({success: false, error:err.message})
  };
}

  const getToppings = async (req, res) => {
    try {
      const response = await Topping.find();
      res.status(200).json(response);
    } catch (err) {
        res.status(500).json({success: false, error:err.message})
    }
  };

  const getTopping = async(req,res) =>{
    const {id} = req.params
    try{
        const response = await Topping.findById(id)
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
  }

 const updateTopping =  async(req,res) =>{
    const {name,image,description,price} = req.body
    const {id} = req.params
    try{
        const response = await Topping.findByIdAndUpdate(id,{name,description,image,price},{new:true})
        res.json(response)
    }catch(err){
        res.status(500).json({success: false, error:err.message})
    }
 }


 const deleteTopping = async(req,res) =>{
  const {id} = req.params

  try{
     await Topping.findByIdAndDelete(id)
    res.status(202).json({message:"success"})
  }catch(err){
    res.status(500).json({success: false, error:err.message})
  }
 }


 module.exports = {createTopping,getToppings,deleteTopping,updateTopping,getTopping}