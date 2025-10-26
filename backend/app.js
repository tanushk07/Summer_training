require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const hbs = require("hbs");
const apiRoutes = require("./routes/api");
const app = express();
const port = process.env.PORT;
const cors = require("cors");

//10.2060.1.22
// Set up session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine setup
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views/partials"));

// Body parser middleware
// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// CORS middleware — allow requests from React frontend
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Set user in locals
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Register HBS helpers
hbs.registerHelper("ifEquals", (arg1, arg2, options) => {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper("ifCond", (v1, v2, options) => {
  return v1 === v2 ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

// Routes
app.use("/", apiRoutes);

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
