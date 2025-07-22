import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import crypto from 'crypto';
import { Meeting } from "../models/meeting.model.js";
import mongoose from "mongoose";

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Please Enter username and password" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (isPasswordCorrect) {
      const token = crypto.randomBytes(20).toString("hex");
      user.token = token;
      await user.save();

      return res.status(StatusCodes.OK).json({ token });
    } else {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid username or password" });
    }
  } catch (e) {
    res.status(400).json({ message: `Something went wrong: ${e}` });
  }
};

const register = async (req, res) => {
  const { name, username, password } = req.body;
  const existingUser = await User.findOne({ username });

  try {
    if (existingUser) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      username,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(StatusCodes.CREATED).json({ message: "New User Registered" });
  } catch (e) {
    console.log(e);
    res.status(400).json({ message: `Something went wrong: ${e}` });
  }
};

// ✅ Move these outside
const getUserHistory = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ token });
    const meetings = await Meeting.find({ user_id: user.username });
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong: ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const { token, meetingCode } = req.body;
  console.log(req.body);

  try {
    const user = await User.findOne({ token: token });

    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode: meetingCode,
    });

    await newMeeting.save();

    res.status(StatusCodes.CREATED).json({ message: "Added code to history" });
  } catch (e) {
    res.json({ message: `Something went wrong: ${e}` });
  }
};

// ✅ Now they can be exported
export { login, register, getUserHistory, addToHistory };
