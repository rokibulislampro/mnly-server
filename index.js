const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
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
    'https://mnly.store',
    'https://www.mnly.store',
    'http://localhost:3000'
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
    const { _id, ...filteredOrder } = orderData;

    const itemsList = filteredOrder.items
      .map(
        (item, i) => `
          <tr style="text-align:right; background:#ffffff;">
            <td>${i + 1}</td>
            <td>${item.color}</td>
            <td>${item.size}</td>
            <td>${item.qty}</td>
            <td>৳${item.price}</td>
            <td><strong>৳${item.lineTotal}</strong></td>
          </tr>
        `
      )
      .join('');

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2d3748; background-color:#f8fafc; padding:20px;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          
          <div style="background:#2b6cb0; color:white; padding:15px 25px;">
            <h2 style="margin:0;">🛒 New Order Received!</h2>
            <p style="margin:5px 0 0;">Order ID: <strong>${
              filteredOrder.orderId
            }</strong></p>
          </div>

          <div style="padding:25px;">
            <p><strong>Site Name:</strong> ${filteredOrder.siteName.toUpperCase()}</p>
            <p><strong>Product Title:</strong> ${filteredOrder.title}</p>

            <h3 style="margin-top:25px; color:#2b6cb0;">👤 Customer Details</h3>
            <table style="width:100%; margin-top:8px; border-collapse:collapse;">
              <tr><td><strong>Name:</strong></td><td>${
                filteredOrder.customer.name
              }</td></tr>
              <tr><td><strong>Phone:</strong></td><td>${
                filteredOrder.customer.phone
              }</td></tr>
              <tr><td><strong>Address:</strong></td><td>${
                filteredOrder.customer.address
              }</td></tr>
              <tr><td><strong>Area:</strong></td><td>${
                filteredOrder.customer.area
              }</td></tr>
              <tr><td><strong>Note:</strong></td><td>${
                filteredOrder.customer.notes || 'N/A'
              }</td></tr>
            </table>

            <h3 style="margin-top:30px; color:#2b6cb0;">🧾 Order Summary</h3>
            <table border="0" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px; border:1px solid #e2e8f0;">
              <thead style="background:#edf2f7; color:#2d3748;">
                <tr style="text-align:right;">
                  <th>#</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
                <tr style="background:#f7fafc; border-top:2px solid #cbd5e0;">
                  <td colspan="4"></td>
                  <td style="text-align:right;"><strong>Subtotal:</strong></td>
                  <td style="text-align:right;"><strong>৳${
                    filteredOrder.subtotal
                  }</strong></td>
                </tr>
                <tr style="background:#f7fafc;">
                  <td colspan="4"></td>
                  <td style="text-align:right;"><strong>Shipping Fee:</strong></td>
                  <td style="text-align:right;"><strong>৳${
                    filteredOrder.shippingFee
                  }</strong></td>
                </tr>
                <tr style="background:#edf2f7;">
                  <td colspan="4"></td>
                  <td style="text-align:right;"><strong>Total Quantity:</strong></td>
                  <td style="text-align:right;"><strong>${
                    filteredOrder.totalQty
                  } ${filteredOrder.unit}</strong></td>
                </tr>
                <tr style="background:#e2e8f0;">
                  <td colspan="4"></td>
                  <td style="text-align:right; font-weight:bold; color:#2b6cb0;">Grand Total:</td>
                  <td style="text-align:right; font-weight:bold; color:#2b6cb0;">৳${
                    filteredOrder.total
                  }</td>
                </tr>
                <tr style="background:#cbd5e0;">
                  <td colspan="4"></td>
                  <td style="text-align:right;"><strong>Status:</strong></td>
                  <td style="text-align:right;"><strong>${
                    filteredOrder.status
                  }</strong></td>
                </tr>
              </tbody>
            </table>

            <p style="margin-top:25px;">Please process this order accordingly.</p>
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.EMAIL,
      to: process.env.EMAIL,
      subject: `New Order Received - ${filteredOrder.orderId}`,
      html: htmlBody,
    });

    console.log('✅ Admin email sent:', info.response);
    return true;
  } catch (error) {
    console.error('❌ Error sending admin email:', error);
    return false;
  }
};

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Multer Setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function run() {
  try {
    // await client.connect();
    console.log('Connected to MongoDB');

    const userCollection = client.db('mnly').collection('user');
    const productCollection = client.db('mnly').collection('product');
    const orderCollection = client.db('mnly').collection('order');
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

    // Get product by ID
    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(product);
    });

    // Get product by siteName (simple version, no error handling)
    app.get('/product/s/:siteName', async (req, res) => {
      const siteName = req.params.siteName;
      const product = await productCollection.findOne({
        siteName: { $regex: `^${siteName}$`, $options: 'i' },
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

    //   app.put('/product/:id', async (req, res) => {
    //     const id = req.params.id;
    //     // const filter = { _id: id };
    //     const filter = { _id: new ObjectId(id) };
    //     const updateDoc = { $set: req.body };
    //     const result = await productCollection.updateOne(filter, updateDoc);
    //     res.send(result);
    //   });

    app.put(
      '/product/:id',
      upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'chart', maxCount: 1 },
        { name: 'shipPartner', maxCount: 1 },
        { name: 'bannerFile', maxCount: 1 },
        { name: 'video', maxCount: 1 },
        { name: 'itemImage', maxCount: 1 },
      ]),
      async (req, res) => {
        try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };

          const existingProduct = await productCollection.findOne(filter);
          if (!existingProduct) throw new Error('Product not found');

          // Create clean body object
          const bodyData = { ...req.body };

          Object.keys(bodyData).forEach(key => {
            if (!key.trim()) delete bodyData[key];
          });

          let updatedItems = existingProduct.item || [];

          if (bodyData.item) {
            updatedItems = JSON.parse(bodyData.item);
          }

          if (req.files && req.files.itemImage) {
            const index = Number(req.body.imageIndex);

            // Delete imageIndex so DB never stores it
            delete bodyData.imageIndex;

            if (!isNaN(index) && updatedItems[index]) {
              const file = req.files.itemImage[0];
              const uploadResponse = await imagekit.upload({
                file: file.buffer,
                fileName: file.originalname,
              });

              updatedItems[index].image = uploadResponse.url;
            }
          }

          bodyData.item = updatedItems;

          let banner = existingProduct.banner || { image: '', status: false };

          // If new banner image uploaded
          if (req.files && req.files.bannerFile) {
            const file = req.files.bannerFile[0];
            const uploadResponse = await imagekit.upload({
              file: file.buffer,
              fileName: file.originalname,
            });
            banner.image = uploadResponse.url;
          }

          // Update banner status only (do not overwrite image if not given)
          if (bodyData.banner) {
            try {
              const parsedBanner = JSON.parse(bodyData.banner);
              if (parsedBanner.status !== undefined) {
                banner.status = parsedBanner.status;
              }
            } catch (err) {
              // ignore parse error
            }
          }

          bodyData.banner = banner;

          const otherFiles = ['logo', 'chart', 'shipPartner', 'video'];
          for (let field of otherFiles) {
            if (req.files && req.files[field]) {
              const file = req.files[field][0];
              const uploadResponse = await imagekit.upload({
                file: file.buffer,
                fileName: file.originalname,
              });
              bodyData[field] = uploadResponse.url;
            }
          }

          if (bodyData.status !== undefined) {
            bodyData.status = bodyData.status === 'true';
          } else {
            delete bodyData.status;
          }

          if (bodyData.features)
            bodyData.features = bodyData.features.split(',');

          if (bodyData.theme) bodyData.theme = bodyData.theme.split(',');

          const result = await productCollection.updateOne(filter, {
            $set: bodyData,
          });

          res.send({ success: true, result });
        } catch (err) {
          console.error(err);
          res.status(500).send({ success: false, error: err.message });
        }
      }
    );

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

    // Reviews APIs
    app.get('/review', async (req, res) => {
      const review = await reviewCollection.find().toArray();
      res.send(review);
    });

    // Add review
    app.post('/review', upload.single('file'), async (req, res) => {
      try {
        const { siteName } = req.body;
        if (!req.file || !siteName)
          return res.status(400).send({ error: 'File and siteName required' });

        // Upload to ImageKit
        const result = await imagekit.upload({
          file: req.file.buffer,
          fileName: `${Date.now()}-${req.file.originalname}`,
          folder: '/reviews',
        });

        const newReview = {
          image: result.url,
          siteName,
          date: new Date().toLocaleDateString('en-US'),
          time: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        const dbResult = await reviewCollection.insertOne(newReview);
        res.send({ ...newReview, _id: dbResult.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Image upload failed' });
      }
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
