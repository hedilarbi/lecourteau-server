const { Schema, model } = require("mongoose");


const orderSchema = new Schema({
   customer_id:{
    type:Schema.Types.ObjectId,
    ref:"Customer"
   },
   items:[
    {
        item_id:{
            type:Schema.Types.ObjectId,
    ref:"MenuItem"
        },
        topping:[{
            type:Schema.Types.ObjectId,
            ref:"Topping"
        }],
        size:String,
        price:Number,
        note:String
    }
   ],
   total_price:Number,
   type:String,
   address:String,
   status:String,
   createdAt:Date

})


module.exports = model('Order', orderSchema)