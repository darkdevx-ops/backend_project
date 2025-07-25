import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN, //defining origin from app is allowed to access
  credentials:true
}))

app.use(express.json({limit:"16kb"}))  //for taking data from json

app.use(express.urlencoded({extended:true, limit: "16kb"})) //for taking data from url

app.use(express.static("public"))   //for storing file and folder in public folder

app.use(cookieParser()) //for accesing cookie and set cookie

export { app }