import dotenv from "dotenv";
import {ManhwaNotifier} from "./controller/ManhwaNotifier.mjs";

process.setMaxListeners(20);
dotenv.config();
// Initialize Discord Bot
new ManhwaNotifier();