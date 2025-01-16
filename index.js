import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const userCollection = client.db("riceDB").collection("users");
    const menuCollection = client.db("riceDB").collection("menus");
    const reviewCollection = client.db("riceDB").collection("reviews");
    const cartCollection = client.db("riceDB").collection("carts");
    const paymentCollection = client.db("riceDB").collection("payments");

    //jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify token middleware
    const verifyToken = (req, res, next) => {
      // console.log("inside verifyToken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access Brother" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .send({ message: "Unauthorized Access Brother" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //verify admin after verifying token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({
          message: "Forbidden Request Brother. You're not the Admin.",
        });
      }
      next();
    };

    //users api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "User already exists!", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Request Brother" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //menus api
    app.get("/menus", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/menus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.delete("/menus/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/menus/:id", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          price: item.price,
          catgory: item.catgory,
          image: item.image,
          recipe: item.recipe,
        },
      };
      const result = await menuCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    app.post("/menus", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    //reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //carts api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });
    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.get("/payment/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res
          .status(403)
          .send({
            message:
              "Forbidden Request Brother. Check your own payment history.",
          });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    //admin apis
    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menus = await menuCollection.estimatedDocumentCount();
      const payments = await paymentCollection.estimatedDocumentCount();
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$price" }, // Sum the converted 'amount'
          },
        },
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue.toFixed(2): 0;
      res.send({
        users,
        menus,
        payments,
        revenue,
      })
    });

    //------------------------------------------------------------------
    //using aggregate pipeline to get the order status
    app.get("/order-stats",  verifyToken, verifyAdmin, async(req, res)=>{
      const result = await paymentCollection.aggregate([
        {
          $unwind: "$menuItemIds"
        },
        {
          $addFields: {
            menuItemIds: { $toObjectId: "$menuItemIds" }
          }
        },
        {
          $lookup: {
            from: 'menus',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: "$menuItems"
        },
        {
          $group: {
            _id: "$menuItems.category",
            totalAmount: { $sum: { $toDouble: "$menuItems.price" } },
            quantity: { $sum: 1 }
          }
        },
        {
          $project:{
            _id : 0,
            category: "$_id",
            quantity: "$quantity",
            totalAmount: "$totalAmount"
          }
        }
      ]).toArray();
      res.send(result);
    })
    //------------------------------------------------------------------

    //==================================================================
  } finally {
  }
}
run().catch(console.dir);

//================================================

app.get("/", (req, res) => {
  res.send("Rice and Spice House IS RUNNING...");
});
app.listen(port, () => {
  console.log("Rice and Spice House is running on port: ", port);
});
