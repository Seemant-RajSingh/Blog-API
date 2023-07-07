const exp = require('express')
const cors = require('cors')

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const User = require('./models/user')
const Post = require('./models/post')
const app = exp()

dotenv.config()

const multer = require('multer');
// for uploading post files(title, summary, etc.) on create post or image?
const uploadMiddleware = multer({ dest: 'uploads/' })
const fs = require('fs');


const salt = bcrypt.genSaltSync(10) // 10?
const secret = process.env.SECRET   // secret key/pwd?



// allows data from diff domains (here port 3000) and also include credentials, cookies etc
app.use(cors({credentials: true, origin: 'http://localhost:3000'}))
//to access posted data (using express parser)
app.use(exp.json())
// using cookie-parser (cookies can be sent by client and sent back to client)
app.use(cookieParser())
app.use('/uploads', exp.static(__dirname + '/uploads'));



// database connection
mongoose.connect(process.env.MONGO_URI)





app.post('/register', async (req, res) => {
    // {username,x} will only show username on reqData tab(inspect) as only passed variables on fetch request can be accessed WITH SAME NAME
    //reqData params should have the exact same name as in fetch request - username and password
    const {username,password} = req.body

    try {
        const userDoc = await User.create({username,
            // bcrypt method 2 - hashSync
          password: bcrypt.hashSync(password,salt)
        })
    
    //apssing the details of the registered user(id, name, pwd, createdAt) to client
    res.json(userDoc)
    }

    catch(e) {
        res.status(400).json(e);
    }

})






app.post('/login', async (req,res) => {
    // getting data from frontend (useStates username and pwd)
    const {username,password} = req.body;
    // userDoc will contaion data from database in same variable name format
    const userDoc = await User.findOne({username});
    // bcrypt method 1 - compareSync - ** ONLY hashed passwords(hashSync) into database return true or false, regular unhased pwds only return false
    const passOk = bcrypt.compareSync(password, userDoc.password);
    
    //res.json(passOk) - returns true for matching HASHED pwds and false otherwise

    //if credentials entered match  - PASSWORD VERIFICATION:
    if (passOk) {
      // create a jwt which will represent a valid, authenticated user (data stored: username, pwd)
        jwt.sign({username, id:userDoc._id}, secret, {}, (err,token) => {
          if (err) throw err;   
          // res.json() - show in response tab(inspect) in json format 
          // generated jw token stored as cookie and both cookie(for browsser) and token(for client js code) sent back to client
          res.cookie('token', token).json({
            id:userDoc._id,
            username
          }) // response as set-cookie with name: token(stores a long string, for correct/wrong credentials) in header tab
        })
      } else {
        res.status(400).json('Wrong credentials');
      }
  });




// TOKEN ESSINTIALLY PASSED AS COOKIE SO AT HEADER.JSX IT CAN BE CHECKED IF USER IS LOGGED IN VIA PROFILE REQUEST?

app.get('/profile', (req,res) => {
  // token created on login requested stored as cookie on browser
    const {token} = req.cookies;
    // {} stands for options(kept empty here)
    // secret(exclusive to server) combines with token payload creating digital signature for jwt to be verifiable
    // info stores username and _id fetched from database if jwt is verified 
    jwt.verify(token, secret, {}, (err,info) => {
      if (err) throw err;
      res.json(info);
    });
  });
  



  app.post('/logout', (req,res) => {
    // .json(data) shows data on inspect -> response tab, here 'ok'
    // emtying the cookie
    res.cookie('token', '').json('ok');
  });



  // /post?
  app.post('/post',uploadMiddleware.single('file'), async (req,res) => {
  
    const {originalname,path} = req.file;
    const parts = originalname.split('.'); // getting extention (part after .)
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path, newPath);

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    })
    res.json(postDoc)
  })
}) 




app.put('/post',uploadMiddleware.single('file'), async (req,res) => {

  let newPath = null;

  if (req.file) {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);

    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });

});





  app.get('/post', async (req, res) => {
    
    res.json(await Post.find()
      .populate('author', ['username'])
      // newest post first
      .sort({createdAt: -1})
      // to show 20 posts at max
      .limit(20)
      )
  })




  app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  })





app.listen(4000, () => {
    console.log("Server started on port 4000")
})


  // req, res data(also seen in inspection tab) is accessible by both frontend and backend