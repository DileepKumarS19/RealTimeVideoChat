import { Router } from "express";
import { addToHistory, getUserHistory, login, register } from "../controllers/users.controller.js";



const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/addToActivity").post(addToHistory);
router.route("/allActivity").get(getUserHistory);


export default router;