const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// CORS Configuration
const corsOptions = {
  origin: [
    'https://staging.d12hcd9va1ufc7.amplifyapp.com',
    'https://mnly.store',
    'https://www.mnly.store',
    'http://localhost:3000',
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mnly.fbefq8d.mongodb.net/?retryWrites=true&w=majority&appName=mnly`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
  secure: false,
  requireTLS: true,
});


// Function to Send Email to Admin Only
const sendOrderEmail = async orderData => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL,
      to: 'mnlypremium@gmail.com',
      subject: `New Order Received - ${orderData.orderId}`,
      text: `New order received from MNLY!\n
      Customer Name: ${orderData.customer.name}
      Phone: ${orderData.customer.phone}
      Address: ${orderData.customer.address}\n
      Please process the order accordingly.`,
    });

    console.log('Admin email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Error sending admin email:', error);
    return false;
  }
};


async function run() {
  try {
    // await client.connect();
    console.log('Connected to MongoDB');

    const userCollection = client.db('mnly').collection('user');
    const productCollection = client.db('mnly').collection('product');
    const orderCollection = client.db('mnly').collection('order');
    const aboutCollection = client.db('mnly').collection('about');
    const reviewCollection = client.db('mnly').collection('review');

    // JWT API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ token });
    });

    // Middleware to verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Forbidden access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Admin API
    app.get(
      '/user/admin/:email',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Unauthorized access' });
        }

        const user = await userCollection.findOne({ email });
        const admin = user?.role === 'admin';
        res.send({ admin });
      }
    );

    // User APIs
    app.get('/user', verifyToken, async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });

    // Get a single user by ID
    app.get('/user/:id', async (req, res) => {
      const id = req.params.id;
      const user = await userCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(user);
    });

    app.get('/user/email/:email', async (req, res) => {
      const email = req.params.email;
      console.log('Fetching data for email:', email); // log
      try {
        const user = await userCollection.findOne({ email });
        if (user) {
          console.log('User data found:', user); // log
          res.send(user);
        } else {
          res.status(404).send({ message: 'User not found' });
        }
      } catch (error) {
        res.status(500).send({ message: 'Server error', error });
      }
    });

    // Create a new user
    app.post('/user', async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // Delete a user
    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Product APIs
    app.get('/product', async (req, res) => {
      const product = await productCollection.find().toArray();
      res.send(product);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(product);
    });

    // app.put('/product/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const updateDoc = { $set: req.body };
    //   const result = await productCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });


    app.put('/product/:id', async (req, res) => {
      const id = req.params.id;
      // const filter = { _id: id };
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: req.body };
      const result = await productCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Order APIs
    app.get('/order', async (req, res) => {
      const order = await orderCollection.find().toArray();
      res.send(order);
    });

    app.get('/order/:id', async (req, res) => {
      const id = req.params.id;
      const order = await orderCollection.findOne({ _id: new ObjectId(id) });
      res.send(order);
    });

    app.post('/order', async (req, res) => {
      const orderData = req.body;
      console.log('Received order data:', orderData);

      try {
        const result = await orderCollection.insertOne(orderData);

        if (result.insertedId) {
          let emailSent = false;

          try {
            emailSent = await sendOrderEmail(orderData);
          } catch (emailErr) {
            console.error('Email sending failed:', emailErr);
          }

          return res.status(201).json({
            success: true,
            message: emailSent
              ? 'Order placed successfully & email sent'
              : 'Order placed successfully but email failed',
            emailSent,
            result,
          });
        } else {
          return res.status(500).json({
            success: false,
            message: 'Failed to save order in database',
          });
        }
      } catch (error) {
        console.error('Error placing order:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to place order',
          error: error.message,
        });
      }
    });

    app.put('/order/:id', async (req, res) => {
      const orderId = req.params.id;
      const { status, type, updateDate, updateTime } = req.body;

      try {
        const filter = { _id: new ObjectId(orderId) };
        const updateDoc = {
          $set: {
            status: status,
            type: type,
            updateDate: updateDate,
            updateTime: updateTime,
          },
        };

        const result = await orderCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.status(200).send({
            message: 'Order updated successfully',
            data: { status, type, updateDate, updateTime },
          });
        } else {
          res
            .status(404)
            .send({ message: 'Order not found or no changes made' });
        }
      } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).send({
          error: 'Failed to update order status',
          details: error.message,
        });
      }
    });

    app.delete('/order/:id', async (req, res) => {
      const id = req.params.id;
      const result = await orderCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Site About APIs
    app.get('/about', async (req, res) => {
      const about = await aboutCollection.find().toArray();
      res.send(about);
    });

    app.get('/about/:id', async (req, res) => {
      const id = req.params.id;
      const about = await aboutCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(about);
    });

    app.put('/about/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { ...req.body } };
      delete updateDoc.$set._id;

      const result = await aboutCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/about/:id', async (req, res) => {
      const id = req.params.id;
      const result = await aboutCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Reviews APIs
    app.get('/review', async (req, res) => {
      const review = await reviewCollection.find().toArray();
      res.send(review);
    });

    // Add review
    app.post('/review', async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    // Delete review
    app.delete('/review/:id', async (req, res) => {
      const id = req.params.id;
      const result = await reviewCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Ping MongoDB
    // await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Uncomment the following line if you want to close the connection after every request
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Mnly server is running');
});

app.listen(port, () => console.log(`Server running on port ${port}`));
