const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

// console.log(process.env.DB_PASS)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = "mongodb+srv://<db_username>:<db_password>@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("carsDoctor");
    const carServices = database.collection("services");
    const bookingCollections = database.collection("bookings");
    app.get('/services', async (req, res) => {
        const service = await carServices.find().toArray();
        res.send(service);
    })
    
    app.get('/services/:id', async(req, res)=>{
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
    app.get('/bookings', async (req, res) => {
        console.log(req.query.email);
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
    await client.db("admin").command({ ping: 1 });
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