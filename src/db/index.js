import mongoose from "mongoose";

const connectDB= async () => {
    try {
        const connectionnInstance= await mongoose.connect(`${process.env.MONGODB_URI}`)
        console.log(`\n MONGO DB CONNECTED !! DB HOST ${connectionnInstance.connection.host}`)
    } catch (error) {
        console.log("Mongo DB error :",error);
        process.exit(1);
    }
}

export default connectDB