const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')
const moment = require('moment');
const dotenv = require('dotenv').config({ path: './.env'});

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false}).then((con) => {
    // console.log(con.connections);
    console.log("DB connection successful.");
  })
  .catch((err) => console.log(err));
mongoose.set('debug', true);


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// 5f60bff4a64c71002e0aa90b
// the user's id is going to be the mongoDB assigned id

// mongoose schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  exercises: {
    type: Array, 
  }
})

// mongoose model
const userModel = mongoose.model(`users`, userSchema);

// POST NEW USER ✔
app.post("/api/exercise/new-user", (req, res) => {
  // capture the submitted name ✔
  console.log("post request received");
  const submittedUsername = req.body.username;
  console.log(submittedUsername);
  // check whether submitted name already exists in db ✔
 userModel.findOne({username: submittedUsername}, (err, user) => {
   if (err) {console.log(err)} else {
     console.log(user);
  // if submitted name does not exist in db, create a new user ✔
      if (user === null) {
      userModel.create({username: submittedUsername, exercises: []}, (err, response) => {
        if (err) { 
          console.log(err)
         } else {
            userModel.findOne({username: submittedUsername}, (err, result, next) => { console.log(`FINAL RESULT: ${result}`) 
            res.send({username: result.username, _id: result._id})
            });
        }
      })             
      }
    // if submitted name does exist in db, send error message
      else {
        res.send("Username already taken")
      }
    }
  })
})

// POST NEW EXERCISE FOR USER
app.post("/api/exercise/add", (req, res) => {

  // capture the submitted exercise data
  const submittedUserId = req.body.userId;
  const submittedDescription = req.body.description;
  const submittedDuration = req.body.duration;
  let submittedDate;
  // if no date is submtitted, then use today's date
  if (req.body.date === undefined || req.body.date === "") {
    submittedDate = new Date().toISOString().split('T')[0];
  } else {
    submittedDate = req.body.date;
  }
  const formattedDate = moment.utc(submittedDate).format("ddd MMM D YYYY")
  // const submittedDate = req.body.date; // optional, if not date is supplied use the current date
  const newExercise = {description: submittedDescription, duration: submittedDuration, date: submittedDate}

  // exercises is an array of objects, push new exercise objects here
  userModel.findByIdAndUpdate(submittedUserId, {$push: { exercises: newExercise}}, {safe: true, upsert: true}, (err, result) => {
    if (err) {
      console.log(err)
    } else {
      res.send({"_id": submittedUserId, "username": result.username, "date": new Date(submittedDate).toDateString(), "duration": parseInt(submittedDuration), "description": submittedDescription})
    }
  })
})

// GET ALL USERS ✔
app.get("/api/exercise/users", (req, res) => {
  // return an array of all users - id and username only ✔
  userModel.find({}, "_id, username", (err, docs) => {
    if (err) {
      console.log(err);
    } else {
      res.send([docs])
    }
  })
})

// GET USER EXERCISE LOG
app.get("/api/exercise/log", (req, res) => {

  const submittedUserId = req.query.userId;

  if (req.query.to) {
    console.log(req.query.to);
  }
  if (req.query.from) {
    console.log(req.query.from)
  }
  if (req.query.limit) {
    console.log(req.query.limit)
  }

  userModel.findById({_id: submittedUserId}, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`RESULT IS ${result}`);
      // convert duration to a number in each log entry ✔
      let formattedLogResult = [];

      for (var i = 0; i < result.exercises.length; i++) {
        let newDuration = parseInt(result.exercises[i].duration);
        let stringDate = new Date(result.exercises[i].date).toDateString()
        // let nonstringDate = result.exercises[i].date;
        formattedLogResult.push({description: result.exercises[i].description, duration: newDuration, date: stringDate})
      }
      // if limit query, send back number of results specified by limit 
      if (req.query.limit) {
        formattedLogResult = formattedLogResult.slice(0, req.query.limit)
      }
      if (req.query.from || req.query.to) {
        // defaults
        let fromDate = new Date(0);
        let toDate = new Date()

        if (req.query.from) {
          fromDate = new Date(req.query.from)
        }
        if (req.query.to) {
          toDate = new Date(req.query.to)
        }
        // convert to unix timestamps for comparison
        fromDate = fromDate.getTime()
        toDate = toDate.getTime()

        formattedLogResult = formattedLogResult.filter((session) => {
          // create timestamps from each session
          let sessionDate = new Date(session.date).getTime()

          return sessionDate >= fromDate && sessionDate <= toDate;
        })
      }

      res.json({"_id": result._id, "username": result.username, log: formattedLogResult, count: result.exercises.length})
    }
  })
})

// Not found middleware... blocking the post requests...
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;
  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
