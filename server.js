const User = require('./models/user');
//const Achievement = require('./models/achievement');
const bodyParser = require('body-parser');
const config = require('./config');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const BasicStrategy = require('passport-http').BasicStrategy;
const express = require('express');
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

mongoose.Promise = global.Promise;

// ---------------- RUN/CLOSE SERVER -----------------------------------------------------
let server = undefined;

function runServer(urlToUse) {
    return new Promise((resolve, reject) => {
        mongoose.connect(urlToUse, err => {
            if (err) {
                return reject(err);
            }
            server = app.listen(config.PORT, () => {
                console.log(`Listening on localhost:${config.PORT}`);
                resolve();
            }).on('error', err => {
                mongoose.disconnect();
                reject(err);
            });
        });
    });
}

if (require.main === module) {
    runServer(config.DATABASE_URL).catch(err => console.error(err));
}

function closeServer() {
    return mongoose.disconnect().then(() => new Promise((resolve, reject) => {
        console.log('Closing server');
        server.close(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    }));
}

// ---------------USER ENDPOINTS-------------------------------------
// POST -----------------------------------
// creating a new user
app.post('/users/create', (req, res) => {
    //get name,email,password from the body object
    let name = req.body.name;
    let email = req.body.email;
    let password = req.body.password;
    //exludes spaces from email and passwords
    email = email.trim();
    password = password.trim();
    //generate encryption key
    bcrypt.genSalt(10, (err, salt) => {
        if (err) {
            return res.status(500).json({
                message: 'Internal server error'
            });
        }
        //using encryption key from above, genberate an encrypted password
        bcrypt.hash(password, salt, (err, hash) => {
            if (err) {
                return res.status(500).json({
                    message: 'Internal server error'
                });
            }
            //using the details above and encrpyed password, send them to mongo schema(user.js)
            User.create({
                name,
                email,
                password: hash,
            }, (err, item) => {
                //if theres an error saving user to db
                if (err) {
                    return res.status(500).json({
                        message: 'Internal Server Error'
                    });
                }
                //if the user is saved successfully
                if (item) {
                    return res.json(item);
                }
            });
        });
    });
});

// signing in a user
app.post('/users/signin', function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    User
        .findOne({
            email: req.body.email
        }, function (err, items) {
            if (err) {
                return res.status(500).json({
                    message: "Internal server error"
                });
            }
            if (!items) {
                // bad username
                return res.status(401).json({
                    message: "Not found!"
                });
            } else {
                items.validatePassword(req.body.password, function (err, isValid) {
                    if (err) {
                        console.log('There was an error validating the password.');
                    }
                    if (!isValid) {
                        return res.status(401).json({
                            message: "Not found"
                        });
                    } else {
                        var logInTime = new Date();
                        return res.json(items);
                    }
                });
            };
        });
});


// -------------ACHIEVEMENT ENDPOINTS------------------------------------------------
// POST -----------------------------------------
// creating a new achievement
app.post('/new/create', (req, res) => {
    let achieveWhat = req.body.achieveWhat;
    achieveWhat = achieveWhat.trim();
    let achieveHow = req.body.achieveHow;
    let achieveWhy = req.body.achieveWhy;
    let achieveWhen = req.body.achieveWhen;
    let user = req.body.user;

    Achievement.create({
        user,
        achieveWhat,
        achieveHow,
        achieveWhen,
        achieveWhy
    }, (err, item) => {
        if (err) {
            return res.status(500).json({
                message: 'Internal Server Error'
            });
        }
        if (item) {
            console.log(`Achievement \`${achieveWhat}\` added.`);
            return res.json(item);
        }
    });
});

// PUT --------------------------------------
app.put('/achievement/:id', function (req, res) {
    let toUpdate = {};
    let updateableFields = ['achieveWhat', 'achieveHow', 'achieveWhen', 'achieveWhy'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    Achievement
        .findByIdAndUpdate(req.params.id, {
            $set: toUpdate
        }).exec().then(function (achievement) {
            return res.status(204).end();
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Internal Server Error'
            });
        });
});

// GET ------------------------------------
// accessing all of a user's achievements
app.get('/achievements/:user', function (req, res) {
    Achievement
        .find()
        .sort('achieveWhen')
        .then(function (achievements) {
            let achievementOutput = [];
            achievements.map(function (achievement) {
                if (achievement.user == req.params.user) {
                    achievementOutput.push(achievement);
                }
            });
            res.json({
                achievementOutput
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal server error'
            });
        });
});

// accessing a single achievement by id
app.get('/achievement/:id', function (req, res) {
    Achievement
        .findById(req.params.id).exec().then(function (achievement) {
            return res.json(achievement);
        })
        .catch(function (achievements) {
            console.error(err);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        });
});

// DELETE ----------------------------------------
// deleting an achievement by id
app.delete('/achievement/:id', function (req, res) {
    Achievement.findByIdAndRemove(req.params.id).exec().then(function (achievement) {
        return res.status(204).end();
    }).catch(function (err) {
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    });
});

// MISC ------------------------------------------
// catch-all endpoint if client makes request to non-existent endpoint
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Not Found'
    });
});

exports.app = app;
exports.runServer = runServer;
exports.closeServer = closeServer;
