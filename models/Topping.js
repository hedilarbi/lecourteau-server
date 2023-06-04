const { Schema, model } = require("mongoose");


const toppingSchema = new Schema({
    name:String,
    image:String,
    description:String,
    price:Number
})


module.exports = model('Topping', toppingSchema)