const { Schema, model } = require("mongoose");


const customerSchema = new Schema({
    name:String,
    profile_img:String,
    email:String,
    phone_number:String,
    addresses:[{
        country:String,
        province:String,
        postal_code:String,
        city:String,
        street:String
    }],
    orders:[
        {
            type:Schema.Types.ObjectId,
            ref:"Order"
        }
    ],
    favorites:[
        {
            type:Schema.Types.ObjectId,
            ref:"Menu_Item"
        }
    ],
    createdAt:Date
})


module.exports = model('Customer', customerSchema)