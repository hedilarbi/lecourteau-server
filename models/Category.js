const { Schema, model } = require("mongoose");


const categorySchema = new Schema({
    name:String,
    image:String,
    description:String
})


module.exports = model('Category', categorySchema)