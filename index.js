import dotenv from 'dotenv'
dotenv.config({path: './.env'})

import connectDB from './src/db/index.js'
import { app } from './src/app.js'
import cors from "cors"

app.use(cors({
    origin:'htp"//localhost:5173',
    credentials:true
}))

connectDB().then(()=>{
    app.listen(process.env_PORT|| 8000 ,()=>{
        console.log(`Server running on port : ${process.env.PORT}`)
    })
})
.catch((err)=>{console.log("Mongodb connection failed ",err)})