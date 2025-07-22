import mongoose from "mongoose";
const connection = mongoose;
import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnLine = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {          /// gives error like cannot read http something like that
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Something is connected");
    socket.on("join-call", (path) => {
      if (connections[path] === undefined) {   //first client is adding into meeting, their socketid is stored in connections named array which has path as its key and socketid as value of dict
        connections[path] = [];
      }
      connections[path].push(socket.id);
      timeOnLine[socket.id] = new Date();

      for (let i = 0; i < connections[path].length; i++) {
        io.to(connections[path][i]).emit(
          "user-joined",
          socket.id,  // this is sending message for all the users in that room
          connections[path]
        );
      }
      if (messages[path] !== undefined) {
        for (let i = 0; i < messages[path].length; ++i) {
          io.to(socket.id).emit(
            "chat-message", // checking for any unread message and sending to everyone in the room
            messages[path][i]["data"],
            messages[path][i]["sender"],
            messages[path][i]["socket-id-sender"]
          );
        }
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomUsers]) => {
          if (!isFound && roomUsers.includes(socket.id)) {
            return [roomKey, true];
          } // checking for the correct room of the client using thier socketid by .reduce function
          return [room, isFound];
        },
        ["", false]
      );

      if (found) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }

        messages[matchingRoom].push({
          sender: sender,
          data: data,
          "socket-id-sender": socket.id,
        });

        console.log("message", matchingRoom, ":", sender, data);

        connections[matchingRoom].forEach((clientId) => {
          io.to(clientId).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    socket.on("disconnect", () => {
      var diffTime = Math.abs(timeOnLine[socket.id] - new Date());

      let correctRoom = null;

      
      const clonedConnections = JSON.parse(JSON.stringify(connections));

      // Loop through the clone
      for (const [room, clients] of Object.entries(clonedConnections)) {
        if (Array.isArray(clients) && clients.includes(socket.id)) {
          correctRoom = room;

          // Emit to actual live room (from real data, not the clone)
          connections[correctRoom].forEach((clientId) => {
            io.to(clientId).emit("user-left", socket.id);
          });

          
          if (Array.isArray(connections[correctRoom])) {
            const index = connections[correctRoom].indexOf(socket.id);
            if (index !== -1) {
              connections[correctRoom].splice(index, 1);
            }
            if (connections[correctRoom].length === 0) {
              delete connections[correctRoom];
            }
          }
          break; // no need to continue loop
        }
      }
    });
  });

  return io;
};
