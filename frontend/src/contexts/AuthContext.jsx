import { children, createContext, useContext, useState } from "react";
import { StatusCodes } from "http-status-codes";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';



export const AuthContext = createContext({});

const client = axios.create({
    baseURL: "http://localhost:8000/api/v1/users"
});

export const AuthProvider = ({children}) => {
    const authContext = useContext(AuthContext);

    const [ userData, setUserData] = useState(authContext);


    const handleRegister = async (name, username, password)=> {
        try{
            let request =  await client.post("/register", {
                name: name,
                username: username,
                password: password,
            })
            if(request.status === StatusCodes.CREATED){
                return request.data.message;
            }
        }catch (err){
            throw err;
        }
     }

     const router = useNavigate();

     const handleLogin = async(username, password) => {
        try{
            let request = await client.post("/login", {
            username: username,
            password: password,
            });
            if(request.status === StatusCodes.OK){
                localStorage.setItem("token", request.data.token);
            }


            }catch(err){
                throw err;
            }
        
     }

    // const router = useNavigate();

    const getHistoryOfUSer = async () => {
        try{
            let request = await client.get("/allActivity", {
                params:{
                    token: localStorage.getItem("token")
                }
            });
            return request.data;
        }catch(err){
            throw err
        }
    }

    const addToUserHistory = async (meetingcode) => {
       
        try{
            let request = await client.post("/addToActivity", {
                token: localStorage.getItem("token"),
                meetingCode: meetingcode
            });

            return request;
        }catch(e){
            throw e;
        }
    }


    const data = {
        userData, setUserData,handleRegister, addToUserHistory, getHistoryOfUSer, handleLogin
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )


}