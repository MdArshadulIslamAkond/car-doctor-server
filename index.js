const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cars-doctor-e99e1.web.app',
    'https://cars-doctor-e99e1.firebaseapp.com'
  ], // replace with your client domain
  credentials: true, // required for cookies
}));
app.use(express.json());

app.use(cookieParser());

// console.log(process.env.DB_PASS)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = "mongodb+srv://carsDoctorUser:sUKtUnIbXFjmtbFn@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middlewares
const logger = async(req, res, next)=>{
  // console.log(`colled:${req.host} ${req.originalUrl}`);
  next();
}

const verifyToken = async(req, res, next)=>{
const token = req.cookies?.token;
if(!token){
  return res.status(401).send({message: 'unauthorized'});
}
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
  //error
if (err){
  // console.log(err);
  return res.status(403).send({message: 'forbidden'});
}
  //if token is valid then it would be decoded
  // console.log('value in the token', decoded);
  req.user = decoded;
  next();
})


}

//cookies configuration
const cookieConfig = {
  httpOnly: true, // to disable accessing cookie via client side js
  secure: process.env.NODE_ENV === "production" ? true : false, // to force https (if you use it)
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // none, strict mode
  // maxAge: 1000000, // ttl in seconds (remove this option and cookie will die when browser is closed)
  // signed: true // if you use the secret with cookieParser
  // {httpOnly: true, secure: false}
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("carsDoctor");
    const carServices = database.collection("services");
    const bookingCollections = database.collection("bookings");

    // auth related api
  
    app.post('/jwt', logger, async(req, res)=>{
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res
      .cookie('token', token, cookieConfig)
      .send({success: true})
      // res.send(token);
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      // console.log('loggin out', user);
      res.clearCookie('token', {...cookieConfig, maxAge: 0});
      res.send({success: true})
    })

    //services related api
    app.get('/services', async (req, res) => {
      const filter = req.query;
      const search = req.query.search;
      // console.log(filter);
      const pipeline = [
      
        {
            $addFields: {
                priceNumeric: { $toDouble: "$price" } // Convert string to double
            }
        },
        {
          $match: {
            priceNumeric: { $lt: 300},
            title: {$regex: search, $options: 'i'},
          }
        },
        {
            $sort: {
                priceNumeric: filter.sort === 'asc' ? 1: -1 // Sort by the numeric price
            }
        }];
        const services = await carServices.aggregate(pipeline).toArray();
        res.send(services);
    })

    app.get('/services/:id', async(req, res)=>{
      console.log(req.params);
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const options = {
            // Include only the `title` and `imdb` fields in the returned document
            projection: {title: 1, service_id: 1, price:1, img:1 },
          };
        const service = await carServices.findOne(query, options);
        if(!service) return res.status(404).send('Service not found');
        res.status(200).send(service);
    })
    app.post('/services', async(req, res)=>{
        const body = req.body;
        const result = await carServices.insertMany(body)
        // res.status(201).json({ message: 'New spot added successfully', insertedId: result.insertedId });
        res.send(result);
    })


    // bookings
    app.get('/bookings', logger, verifyToken, async (req, res) => {
        // console.log(req.query.email);
        // console.log('tok tok token', req.cookies.token);
        // console.log('user in the valid token :', req.user);
        if(req.query.email!== req.user.email) {
          return res.status(403).send({message: 'forbidden'});
        }
        let query = {} 
        if(req.query?.email){
            query = { email: req.query.email}
        }
        const booking = await bookingCollections.find(query).toArray();
        res.send(booking);
    })
    
    app.get('/bookings/:id', async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const options = {
            // Include only the `title` and `imdb` fields in the returned document
            projection: {title: 1, booking_id: 1, customer_name:1, service_id:1, price:1 },
          };
        const booking = await bookingCollections.findOne(query, options);
        if(!booking) return res.status(404).send('Booking not found');
        res.status(200).send(booking);
    })
    app.post('/bookings', async(req, res)=>{
        const body = req.body;
        const result = await bookingCollections.insertOne(body)
        // res.status(201).json({ message: 'New booking added successfully', insertedId: result.insertedId });
        res.send(result);
    });

    app.patch('/bookings/:id', async(req, res)=>{
        const id = req.params.id;
        const body = req.body;
        const query = {_id: new ObjectId(id)};
        // const options = { upsert: true };
        const result = await bookingCollections.updateOne(query, { $set: body });
        if(result.matchedCount === 0) return res.status(404).send('Booking not found');
        res.send({message: 'Booking updated successfully', matchedCount: result.matchedCount, modifiedCount: result.modifiedCount});
    }); //

    app.delete('/bookings/:id', async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await bookingCollections.deleteOne(query);
        if(result.deletedCount === 0) return res.status(404).send('Booking not found');
        res.send({message: 'Booking deleted successfully', deletedCount: result.deletedCount});
    });

    // Send a ping to confirm a successful connection
 
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=>{
    res.send('cars doctor is running');
})


app.listen(port, (req, res)=>{
    console.log(`Car doctor Server running on port ${port}`);
});