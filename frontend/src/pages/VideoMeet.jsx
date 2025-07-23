import React, { useEffect, useRef, useState } from "react";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ChatIcon from "@mui/icons-material/Chat";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import { useNavigate } from 'react-router-dom';

import { TextField, Button, IconButton, Badge } from "@mui/material";
import { io } from "socket.io-client";
import styles from "../styles/videoComponent.module.css";

const server_url = "http://localhost:8000";

var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState();
  const [audio, setAudio] = useState();
  const [screen, setScreen] = useState();
  const [modal, setModal] = useState();
  const [screenAvailable, setScreenAvailable] = useState();
  const [showModal, setShowModal] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessages, setNewMessages] = useState();
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setVideoAvailable(!!videoPermission);

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioAvailable(!!audioPermission);

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });

        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (err) {
      console.error("Error getting permissions:", err);
    }
  };

  const getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error(e);
    }

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    // Add tracks to all existing connections
    Object.keys(connections).forEach((id) => {
      if (id === socketIdRef.current) return;

      // Remove old tracks
      connections[id].getSenders().forEach((sender) => {
        connections[id].removeTrack(sender);
      });

      // Add new tracks
      stream.getTracks().forEach((track) => {
        connections[id].addTrack(track, stream);
      });

      connections[id]
        .createOffer()
        .then((description) => {
          return connections[id].setLocalDescription(description);
        })
        .then(() => {
          
          socketRef.current.emit(
            "signal",
            id,
            JSON.stringify({ sdp: connections[id].localDescription })
          );
        })
        .catch((e) => console.error("Error creating offer:", e));
    });

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false); 
        setAudio(false);

        try {
          const tracks = localVideoRef.current?.srcObject?.getTracks();
          tracks?.forEach((track) => track.stop());
        } catch (e) {
          console.error(e);
        }

        const blackSilence = () => new MediaStream([black(), silence()]);
        window.localStream = blackSilence();
        localVideoRef.current.srcObject = window.localStream;

        Object.keys(connections).forEach((id) => {
          // Similar track replacement as above for black/silence
          connections[id].getSenders().forEach((sender) => {
            connections[id].removeTrack(sender);
          });
          window.localStream.getTracks().forEach((track) => {
            connections[id].addTrack(track, window.localStream);
          });

          connections[id]
            .createOffer()
            .then((description) => {
              return connections[id].setLocalDescription(description);
            })
            .then(() => {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              );
            })
            .catch((e) => console.error(e));
        });
      };
    });
  };

  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video, audio })
        .then((stream) => getUserMediaSuccess(stream))
        .catch((e) => console.error("Error getting user media:", e));
    } else {
      try {
        const tracks = localVideoRef.current?.srcObject?.getTracks();
        tracks?.forEach((track) => track.stop());
      } catch (err) {
        console.error(err);
      }
    }
  };

  let addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages, 
      {sender: sender, data: data}
    ]);

    if(socketIdSender !== socketIdRef.current){
      setNewMessages((prevMessages) => prevMessages + 1);
    }
  }


  const connectToSocketServer = () => {
    socketRef.current = io(server_url, { secure: false });

    socketRef.current.on("signal", (fromId, message) => {
      const signal = JSON.parse(message);

      if (fromId === socketIdRef.current) return;

      // Initialize connection if it doesn't exist
      if (!connections[fromId]) {
        connections[fromId] = new RTCPeerConnection(peerConfigConnections);

        // ICE candidate handling
        //ANSWERE for signal
        connections[fromId].onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit(
              "signal",
              fromId,
              JSON.stringify({ ice: event.candidate })
            );
          }
        };

        // Handle remote stream
        connections[fromId].ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setVideos((prev) => {
              const existing = prev.find((v) => v.socketId === fromId);
              if (existing) {
                return prev.map((v) =>
                  v.socketId === fromId ? { ...v, stream: event.streams[0] } : v
                );
              } else {
                return [
                  ...prev,
                  {
                    socketId: fromId,
                    stream: event.streams[0],
                    autoPlay: true,
                    playsInline: true,
                  },
                ];
              }
            });
          }
        };

        // Add local stream tracks to new connection
        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => {
            connections[fromId].addTrack(track, window.localStream);
          });
        }
      }

      // Handle SDP signal
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              return connections[fromId].createAnswer();
            }
          })
          .then((description) => {
            if (description) {
              return connections[fromId].setLocalDescription(description);
            }
          })
          .then(() => {
            if (signal.sdp.type === "offer") {
              socketRef.current.emit(
                "signal",
                fromId,
                JSON.stringify({ sdp: connections[fromId].localDescription })
              );
            }
          })
          .catch((e) => console.error("Signal error:", e));
      }

      // Handle ICE candidate
      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.error("Error adding ICE candidate:", e));
      }
    });

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          // Don't connect to yourself
          if (socketListId === socketIdRef.current) return;

          // Avoid re-creating connections
          if (connections[socketListId]) return;

          // 1. Create a new RTCPeerConnection
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );

          // 2. Set up ICE candidate handler
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // 3. Handle incoming media streams
          connections[socketListId].ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              setVideos((prevVideos) => {
                const existing = prevVideos.find(
                  (v) => v.socketId === socketListId
                );
                if (existing) {
                  return prevVideos.map((v) =>
                    v.socketId === socketListId
                      ? { ...v, stream: event.streams[0] }
                      : v
                  );
                } else {
                  return [
                    ...prevVideos,
                    {
                      socketId: socketListId,
                      stream: event.streams[0],
                      autoPlay: true,
                      playsInline: true,
                    },
                  ];
                }
              });
            }
          };

          // 4. Add local media tracks
          if (window.localStream) {
            window.localStream.getTracks().forEach((track) => {
              connections[socketListId].addTrack(track, window.localStream);
            });
          } else {
            const blackSilence = new MediaStream([black(), silence()]);
            window.localStream = blackSilence;
            blackSilence.getTracks().forEach((track) => {
              connections[socketListId].addTrack(track, blackSilence);
            });
          }

          // 5. Only the new user (id) creates offer
          if (id === socketIdRef.current) {
            // i.e., I am the new client, I create offers to all existing clients
            connections[socketListId]
              .createOffer()
              .then((offer) =>
                connections[socketListId].setLocalDescription(offer)
              )
              .then(() => {
                socketRef.current.emit(
                  "signal",
                  socketListId,
                  JSON.stringify({
                    sdp: connections[socketListId].localDescription,
                  })
                );
              })
              .catch((e) => console.error("Error creating initial offer:", e));
          }
        });
      });

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
        if (connections[id]) {
          connections[id].close();
          delete connections[id];
        }
      });
    });
  };

  let routeTo = useNavigate();


  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  useEffect(() => {
    getPermissions();
  }, []);

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [audio, video]);

  let handleVideo = () => {
    setVideo(!video);
  };

  let handelAudio = () => {
    setAudio(!audio);
  };

  let getDisplayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      // Remove old tracks
      const senders = connections[id].getSenders();
      senders.forEach((sender) => connections[id].removeTrack(sender));

      // Add new screen tracks
      stream.getTracks().forEach((track) => {
        connections[id].addTrack(track, stream);
      });

      connections[id]
        .createOffer()
        .then((description) => connections[id].setLocalDescription(description))
        .then(() => {
          socketRef.current.emit(
            "signal",
            id,
            JSON.stringify({ sdp: connections[id].localDescription })
          );
        })
        .catch((e) => console.log("Offer error:", e));
    }

    // Handle when screen sharing ends
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false);

        try {
          const tracks = localVideoRef.current?.srcObject?.getTracks();
          tracks?.forEach((track) => track.stop());
        } catch (e) {
          console.error(e);
        }

        const blackSilence = () => new MediaStream([black(), silence()]);
        window.localStream = blackSilence();
        localVideoRef.current.srcObject = window.localStream;

        getUserMedia(); // Switch back to camera/audio
      };
    });
  };

  let getDisplayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDisplayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);
  
  let handleScreen = () => {
    setScreen(!screen);
  };

  let sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  }

  let handleEndCall = () => {
    try{
      let tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());

    }catch(e){console.log(e)}

    routeTo("/home");
  }

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            id="outlined-basic"
            label="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <div>
            <video ref={localVideoRef} autoPlay playsInline></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal ? (
            <div className={styles.chatRoom}>
              <div className={styles.chattingContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                    
                    { messages.length > 0 ? messages.map((item, index) => {
                     
                      return(
                        <div key={index} style={{marginBottom: "20px"}}>

                          <p style={{fontWeight: "bold"}}>{item.sender}</p>
                          <p>{item.data}</p>
                        </div>
                      )
                    }) : <p>No new messages yet</p>}

                </div>
                <div className={styles.chattingArea}>
                
                  <TextField value={message} onChange={e => setMessage(e.target.value)} id="outlined-basic" label="Enter your message" />
                  <Button variant="contained" onClick={sendMessage}>Send</Button>
                </div>
              </div>
            </div>
          ) : (
            <></>
          )}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handelAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : (
              <></>
            )}
            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton
                onClick={() => setShowModal(!showModal)}
                style={{ color: "white" }}
              >
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
          <video
            className={styles.meetUserVideo}
            ref={localVideoRef}
            autoPlay
            playsInline
          ></video>
          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
