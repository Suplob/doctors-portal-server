const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server side of doctors portal");
});

const serviceAccount = require("./doctors-portal-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function verifyToken(req, res, next) {
  if (req.headers.authorization.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dsdfh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();

    const orderCollection = client.db("doctors-portal").collection("orders");
    const usersCollection = client.db("doctors-portal").collection("users");

    app.get("/order", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      const result = await orderCollection
        .find({ email: email, date: date })
        .toArray();
      res.json(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const user = await usersCollection.findOne({ email: email });
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }

      res.json({ admin: isAdmin });
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
      console.log(result);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      console.log(result);
      res.json(result);
    });

    app.put("/user", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };

      const updateDoc = { $set: user };
      const result = usersCollection.updateOne(filter, updateDoc, options);

      res.json(result);
    });

    app.put("/user/addAdmin", verifyToken, async (req, res) => {
      const requster = req.decodedEmail;

      if (requster) {
        const user = await orderCollection.findOne({ email: requster });
        if (user.role === "admin") {
          const user = req.body;
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(401).json({ message: "you are not authorized" });
      }
    });
  } finally {
  }
}

run().catch(console.dir());

app.listen(PORT, () => {
  console.log(PORT);
});
