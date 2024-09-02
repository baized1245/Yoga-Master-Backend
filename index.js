const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json());

// JWT verification middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Invalid authorization" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB connection setup
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@mern.zy6vr7t.mongodb.net/?retryWrites=true&w=majority&appName=Mern`;

// Create a MongoClient instance with Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Database and collections setup
    const database = client.db("yoga-master");
    const usersCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const cartCollection = database.collection("cart");
    const paymentsCollection = database.collection("payments");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");

    // Root route
    app.get("/", (req, res) => {
      res.send("Level 2 student, BH.Sadhin");
    });

    // Generate JWT token for a user
    app.post("/api/set-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET, {
        expiresIn: "30d",
      });
      res.send({ token });
    });

    // Middleware to verify if the user is an admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (user.role === "admin") {
        next();
      } else {
        return res.status(401).send({ message: "Unauthorized access" });
      }
    };

    // Middleware to verify if the user is an instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (user.role === "instructor") {
        next();
      } else {
        return res.status(401).send({ message: "Unauthorized access" });
      }
    };

    // Routes for managing users

    // Create a new user
    app.post("/new-user", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Get user by ID
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Get user by email (requires JWT verification)
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // Delete a user (requires admin role)
    app.delete("/delete-user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update a user's info (requires admin role)
    app.put("/update-user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updateUser = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          name: updateUser.name,
          email: updateUser.email,
          role: updateUser.role,
          address: updateUser.address,
          about: updateUser.about,
          photoUrl: updateUser.photoUrl,
          skills: updateUser.skills || null,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Routes for managing classes

    // Create a new class (requires instructor role)
    app.post("/new-class", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });

    // Get all approved classes
    app.get("/classes", async (req, res) => {
      const result = await classesCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    // Get classes by instructor email
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const result = await classesCollection
          .find({ instructorEmail: email })
          .toArray();
        res.send(result);
      }
    );

    // Manage all classes
    app.get("/classes-manage", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Update class status and reason (requires admin role)
    app.patch(
      "/change-status/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { status, reason } = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: { status, reason },
        };
        const result = await classesCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    // Get approved classes
    app.get("/approved-classes", async (req, res) => {
      const result = await classesCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    // Get single class details
    app.get("/class/:id", async (req, res) => {
      const id = req.params.id;
      const result = await classesCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update class details
    app.put(
      "/update-class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const updateClass = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            name: updateClass.name,
            description: updateClass.description,
            price: updateClass.price,
            availableSeats: parseInt(updateClass.availableSeats),
            videoLink: updateClass.videoLink,
            status: "pending",
          },
        };
        const result = await classesCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    // Cart routes

    // Add an item to the cart
    app.post("/add-to-cart", verifyJWT, async (req, res) => {
      const newCartItem = req.body;
      const result = await cartCollection.insertOne(newCartItem);
      res.send(result);
    });

    // Get cart item by class ID
    app.get("/cart-item/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      const result = await cartCollection.findOne({
        classId: id,
        userMail: email,
      });
      res.send(result);
    });

    // Get all cart items for a user by email
    app.get("/cart/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const carts = await cartCollection
        .find({ userMail: email }, { projection: { classId: 1 } })
        .toArray();
      const classIds = carts.map((cart) => new ObjectId(cart.classId));
      const result = await classesCollection
        .find({ _id: { $in: classIds } })
        .toArray();
      res.send(result);
    });

    // Delete a cart item by class ID
    app.delete("/delete-cart-item/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await cartCollection.deleteOne({ classId: id });
      res.send(result);
    });

    // Routes for managing payments

    // Create a payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Save payment details
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);

      // Update the enrolled collection with payment details
      const updateResult = await enrolledCollection.insertOne(payment);

      // Update class seats availability
      const filter = { _id: new ObjectId(payment.classId) };
      const updateDoc = {
        $inc: {
          availableSeats: -1,
        },
      };
      const updatedSeats = await classesCollection.updateOne(filter, updateDoc);

      // Remove the item from the cart
      const cartResult = await cartCollection.deleteOne({
        classId: payment.classId,
      });

      res.send({ result, updateResult, updatedSeats, cartResult });
    });

    // Get all payments
    app.get("/payments", async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    });

    // Get payment by email
    app.get("/payments/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const result = await paymentsCollection.find({ email }).toArray();
      res.send(result);
    });

    // Route for retrieving the enrolled classes by user email
    app.get("/enrolled-classes/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const enrolledClasses = await enrolledCollection
        .find({ email })
        .toArray();
      const classIds = enrolledClasses.map(
        (enrollment) => new ObjectId(enrollment.classId)
      );
      const result = await classesCollection
        .find({ _id: { $in: classIds } })
        .toArray();
      res.send(result);
    });

    // Route for retrieving enrolled details
    app.get(
      "/enrolled-details",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const result = await enrolledCollection.find().toArray();
        res.send(result);
      }
    );

    // Route for updating user status
    app.patch("/update-user-status/:email", async (req, res) => {
      const email = req.params.email;
      const { status } = req.body;
      const filter = { email };
      const updatedDoc = {
        $set: { status },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Handle not found route
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: "Not Found",
      });
    });

    console.log("Connected to MongoDB!");

    // Start the Express server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } finally {
    // Optionally close the client connection
    // await client.close();
  }
}

run().catch(console.dir);
