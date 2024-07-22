import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { userRouter } from '../routes/user.js';
import { authRouter } from '../routes/auth.js';
import 'dotenv/config';
import passport from 'passport'
import session from 'express-session';
import initializePassport from '../passport-config.js';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

const baseUrl = process.env.NODE_ENV === 'production'
  ? process.env.FRONT_END_URL_PRODUCTION
  : process.env.FRONT_END_URL_DEVELOPMENT;

main().catch((error) => {
  console.log("promise error ->", error);
})

async function main() {
  try {
    await mongoose.connect(`mongodb+srv://${process.env.USER}:${process.env.DB_PASSWORD}@organicshopcluster.vcdzuqc.mongodb.net/?retryWrites=true&w=majority&appName=organicShopCluster`)
  } catch (error) {
    console.log("async error ->", error);
  }
}

const server = express();

server.use(bodyParser.json());

server.use(bodyParser.urlencoded({ extended: true }));

server.use(morgan('dev'));

// console.log("baseurl->", baseUrl);
const corsOptions = {
  origin: baseUrl,
  credentials: true
};

server.use(cors(corsOptions));

// Ensure preflight requests are handled
server.options('*', cors(corsOptions));

console.log("environment->", process.env.NODE_ENV);

server.set('trust proxy', 1);

server.use(cookieParser());
server.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

initializePassport();

server.use(passport.authenticate('session'));

server.use('/users', userRouter);

server.use('/auth', authRouter);

server.listen(8080, () => {
  console.log('server started on port 8080');
})