const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const BasicStrategy = require("passport-http").BasicStrategy;
const JwtStrategy = require("passport-jwt").Strategy;
const extractJwt = require("passport-jwt").ExtractJwt;
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-New-Access-Token"],
    exposedHeaders: ["X-New-Access-Token"],
  })
);

let posts = ["Early bird catches the worm"];

const users = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "user" },
];

const refreshTokens = {};

const ACCESS_SECRET_KEY = "secretkey";
const REFRESH_SECRET_KEY = "refreshsecretkey";

const optionsForJwtValidation = {
  jwtFromRequest: extractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: ACCESS_SECRET_KEY,
};

app.use(bodyParser.json());
app.use(cookieParser());

passport.use(
  new BasicStrategy(function (username, password, done) {
    //mock db check
    const user = users.find(
      (u) => u.username === username && u.password === password
    );
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  })
);

passport.use(
  new JwtStrategy(optionsForJwtValidation, function (jwt_payload, done) {
    const user = users.find((u) => u.username === jwt_payload.username);
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  })
);

const recycleAccessToken = (req, res, next) => {
  const token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];

  if (token) {
    try {
      jwt.verify(token, ACCESS_SECRET_KEY, (err, decoded) => {
        const newAccessToken = jwt.sign(
          {
            username: decoded.username,
            role: decoded.role,
          },
          ACCESS_SECRET_KEY,
          { expiresIn: "30s" }
        );

        res.setHeader("X-New-Access-Token", newAccessToken);
      });
    } catch (error) {
      return res.status(403).json({ message: "Invalid access token." });
    }
  }

  next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role === "admin") {
    next();
  } else {
    return res
      .status(403)
      .json({ message: "Access denied. Admin role required." });
  }
};

// Routes
app.post(
  "/signin",
  passport.authenticate("basic", { session: false }),
  (req, res) => {
    const accessToken = jwt.sign(
      {
        username: req.user.username,
        role: req.user.role,
      },
      ACCESS_SECRET_KEY,
      { expiresIn: "30s" }
    );

    const refreshToken = jwt.sign(
      {
        username: req.user.username,
      },
      REFRESH_SECRET_KEY,
      { expiresIn: "7d" }
    );

    // save refresh token
    refreshTokens[req.user.username] = refreshToken;

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: accessToken,
      user: {
        username: req.user.username,
      },
    });
  }
);

app.post("/refresh", (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token not found." });
  }

  jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token." });
    }

    if (refreshTokens[decoded.username] !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token." });
    }
    const accessToken = jwt.sign(
      {
        username: decoded.username,
        role: decoded.role,
      },
      ACCESS_SECRET_KEY,
      { expiresIn: "30s" }
    );

    res.json({ accessToken });
  });
});

app.get(
  "/posts",
  passport.authenticate("jwt", { session: false }),
  recycleAccessToken,
  (req, res) => {
    res.status(200).json({ posts });
  }
);

app.post(
  "/posts",
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  recycleAccessToken,
  (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }
    posts.push(message);
    res.status(201).json({ message: "Post added successfully", posts });
  }
);

app.post("/logout", (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, decoded) => {
      if (!err && decoded.username) {
        delete refreshTokens[decoded.username];
      }
    });
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  res.status(200).json({ message: "Successfully logged out." });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
