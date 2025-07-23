import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage(){

    const router = useNavigate();
    return (
        <>
            <div className="landingPageContainer">
                <nav>
                    <div className="navHeader">
                        <h2>Apna Video Call</h2>
                    </div>
                    <div className="navList">
                        <p onClick={() => {
                            router("/guest")
                        }}>Join as Guest</p>
                        <p onClick={() => {
                            router("/auth")
                        }}>Register</p>
                        <div onClick={() => {
                            router("/auth")
                        }} role="button">
                            <p>Login</p>
                        </div>
                    </div>
                </nav>
                <div className="landingMainContainer">
                    <div>
                        <h1><span style={{color:"#FF9839"}}>Connect</span> with your Loved Ones</h1>
                        <h4>Cover a distance by Apna video call</h4>
                        <div role="button">
                            <Link to={"/auth"}>Get Started</Link>
                        </div>
                    </div>
                    <div>
                        <img src="/mobile.png" alt="mobile-img"></img>
                    </div>
                </div>
            </div>
        </>
    )
}