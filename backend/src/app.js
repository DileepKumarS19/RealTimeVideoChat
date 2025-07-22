import express from "express";
import mongoose from "mongoose";
import { createServer } from "node:http";
import {connectToSocket} from "./controllers/manageSocketio.js"

import userRoutes from "./routes/users.routes.js"

import { Server } from "socket.io";
import cors from "cors";
// import { json } from "node:stream/consumers";


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: true}));

app.set("port", (process.env.PORT || 8000));

app.get("/home", (req, res) => {
    return res.json({"hello": "world"});
});

app.use("/api/v1/users", userRoutes);


const start = async()=> {
    app.set("mongo_user")
    const connectionDb = await mongoose.connect("mongodb+srv://dileepkumardilideepu:Dileep19102002@cluster0.rkrtwz0.mongodb.net/");
    console.log(`Database conneted to ${connectionDb.connection.host}`);
    server.listen(app.get("port"), ()=>{
        console.log("App is Listening on Port 8000");
    });
};

start();