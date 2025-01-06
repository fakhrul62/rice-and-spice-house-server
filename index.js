import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

//========================= MONGODB CONNECTION

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wwkoz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    //Get the database and collection on which to run the operation
    const menuCollection = client.db("riceDB").collection("menus");
    const reviewCollection = client.db("riceDB").collection("reviews");

    //menus api
    app.get("/menus", async(req, res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })
    //reviews api
    app.get("/reviews", async(req, res)=>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })


  } finally {}
}
run().catch(console.dir);

//================================================

app.get("/", (req, res) => {
  res.send("Rice and Spice House IS RUNNING...");
});
app.listen(port, () => {
  console.log("Rice and Spice House is running on port: ", port);
});
