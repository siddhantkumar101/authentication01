import express from 'express'
import userRouter from './routes/user.routes.js'
import cors from "cors"
import cookieParser from 'cookie-parser';

const app=express();

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(cookieParser())

app.use("/api/v1/users",userRouter)

export {app}